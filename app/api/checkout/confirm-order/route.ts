import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { resolvePaymentMode, PaymentMode } from "@/lib/payment-mode";
import { processPaidOrder } from "@/lib/order-processor";
import { getOrderById, updateOrderStatus } from "@/lib/firebase-admin";
import { logIncident } from "@/lib/incident-logger";
import { consumePaymentObligation, recordPaymentAuthority } from "@/lib/admin-console/finance/authority";
import { resolvePostalProvenance } from "@/lib/order-record";
import { validateFrozenNoticeOrder } from "@/lib/frozen-notice-order";

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentIntentId, customerEmail } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing required orderId parameter" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: `Order ${orderId} not found` }, { status: 404 });
    }

    const snapshotError = validateFrozenNoticeOrder(order);
    if (snapshotError) {
      return NextResponse.json({ code: snapshotError, error: "The locked notice snapshot failed integrity verification." }, { status: 409 });
    }

    // Idempotency: If the obligation has already advanced, return current state.
    if (
      order.status === "DISPATCHING" ||
      order.status === "PROCESSING_DISPATCH" ||
      order.status === "PROCESSING_HANDWRYTTEN" ||
      order.status === "MAILED"
    ) {
      return NextResponse.json({
        success: true,
        status: order.status,
        orderId,
        lobLetterId: resolvePostalProvenance(order).provider === "lob" ? resolvePostalProvenance(order).reference : undefined,
        alreadyProcessed: true,
      });
    }

    const verifiedPaymentIntentId = paymentIntentId || order.stripePaymentId;

    if (!verifiedPaymentIntentId) {
      await updateOrderStatus(orderId, {
        status: "PAYMENT_VERIFICATION_FAILED",
        fulfillmentError: "Missing PaymentIntent identifier for verification.",
      });
      return NextResponse.json(
        { success: false, error: "Missing paymentIntentId. Payment verification failed." },
        { status: 400 }
      );
    }

    let mode: PaymentMode;
    try {
      mode = resolvePaymentMode();
    } catch (modeErr: unknown) {
      const msg = modeErr instanceof Error ? modeErr.message : "Payment mode configuration error";
      console.error("[Confirm Order Critical] Payment mode error:", msg);
      await logIncident({
        type: "STRIPE",
        severity: "error",
        summary: "Payment Verification Misconfiguration",
        technicalDetails: msg,
      });
      return NextResponse.json(
        { success: false, error: "Payment verification system is not configured." },
        { status: 503 }
      );
    }

    const isMockDevMode = mode === "local_mock";
    let isTest = isMockDevMode;
    let paymentMode: PaymentMode = mode;
    let customerEmailFromStripe: string | undefined;
    let authorityFactId: string | undefined;

    if (!isMockDevMode) {
      // Synchronously verify PaymentIntent directly via Stripe API (Fail Closed)
      let pi;
      try {
        const stripe = getStripeClient();
        pi = await stripe.paymentIntents.retrieve(verifiedPaymentIntentId, { expand: ["latest_charge"] });
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : "Stripe API retrieval error";
        console.error(`[Confirm Order] Failed to retrieve PaymentIntent ${verifiedPaymentIntentId}:`, msg);
        await logIncident({
          type: "STRIPE",
          severity: "error",
          summary: `PaymentIntent Retrieval Failed for Order ${orderId}`,
          technicalDetails: msg,
          metadata: { orderId, paymentIntentId: verifiedPaymentIntentId },
        });

        return NextResponse.json(
          {
            success: false,
            status: "PAYMENT_VERIFICATION_UNAVAILABLE",
            error: "Unable to verify payment with processor. Retry after connectivity is restored.",
          },
          { status: 503 }
        );
      }

      let capturedAtMs: number | undefined;
      if (typeof pi.latest_charge === "object" && pi.latest_charge !== null) {
        capturedAtMs = pi.latest_charge.created * 1000;
      } else if (typeof pi.latest_charge === "string") {
        try {
          const charge = await getStripeClient().charges.retrieve(pi.latest_charge);
          capturedAtMs = charge.created * 1000;
        } catch {
          // Keep the client from advancing without provider-effective capture time.
        }
      }
      if (!capturedAtMs) {
        return NextResponse.json(
          { success: false, status: "PAYMENT_EVIDENCE_INCOMPLETE", error: "Stripe capture evidence is incomplete; retry verification." },
          { status: 503 }
        );
      }

      const authority = await recordPaymentAuthority(pi, {
        eventId: `confirm-retrieve:${pi.id}`,
        eventType: "payment_intent.retrieve.confirm_order",
        eventLivemode: pi.livemode,
        occurredAt: capturedAtMs,
        receivedAt: Date.now(),
      });
      if (!authority.accepted || !authority.paymentFactId) {
        return NextResponse.json(
          {
            success: false,
            status: "PAYMENT_AUTHORITY_REJECTED",
            diagnosticCodes: authority.diagnosticCodes,
          },
          { status: authority.status === "unmatched" ? 404 : 409 }
        );
      }
      authorityFactId = authority.paymentFactId;
      customerEmailFromStripe = pi.receipt_email || undefined;
      isTest = !pi.livemode;
      paymentMode = pi.livemode ? "live" : "stripe_test";
    } else {
      console.log(`[Confirm Order] Mock mode verification active for order ${orderId}`);
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    // Process and fulfill the verified paid order (atomic locking handled in order-processor)
    const result = authorityFactId
      ? await consumePaymentObligation(orderId, authorityFactId, { clientIp, userAgent })
      : await processPaidOrder(
          orderId,
          verifiedPaymentIntentId,
          customerEmail || customerEmailFromStripe || order.customerEmail,
          { clientIp, userAgent, isTest, paymentMode }
        );

    return NextResponse.json({
      success: result.success,
      status: result.status,
      orderId,
      lobLetterId: result.lobLetterId,
      error: result.error,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error confirming order";
    console.error("[Confirm Order Exception]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
