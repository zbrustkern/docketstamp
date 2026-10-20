import {
  firestoreDb,
  getOrdersCollection,
  getOrderById,
  updateOrderStatus,
  getImageCachePoolCollection,
  recordDiscountUsage,
  resolveIncidentsForOrder,
} from "./firebase-admin";
import { dispatchLetter, UspsServiceLevel } from "./fulfillment/lob";
import { assertNotFitnessEntity } from "@/src/lib/docket/guardrails";
import { logIncident } from "./incident-logger";
import { Order } from "./types";
import { sendMetaCapiPurchaseEvent } from "./meta-conversions-api";
import { markMetaCapiTrackedAtOnSuccess } from "./meta-capi-tracking";
import { recordServerTelemetry } from "./metrics-rollup";
import { sendDocketDispatchReceiptEmail } from "./email-alerts";
import { getStripeClient } from "./stripe";
import { resolvePaymentMode } from "./payment-mode";
import { validateFrozenNoticeOrder } from "./frozen-notice-order";

export interface ProcessPaidOrderResult {
  success: boolean;
  status: string;
  lobLetterId?: string;
  error?: string;
  alreadyProcessed?: boolean;
}

export interface ProcessOrderOptions {
  clientIp?: string;
  userAgent?: string;
  isTest?: boolean;
  paymentMode?: "live" | "stripe_test" | "local_mock";
  authorityFactId?: string;
}

export interface SenderValidationResult {
  valid: boolean;
  error?: string;
  isBrandSender?: boolean;
}

export function validatePersonalSender(
  address?: Partial<Order["returnAddress"]> | null
): SenderValidationResult {
  if (!address) {
    return { valid: false, error: "Return address is required." };
  }

  const firstName = (address.firstName || "").trim();
  const lastName = (address.lastName || "").trim();
  const street1 = (address.street1 || "").trim();
  const city = (address.city || "").trim();
  const state = (address.state || "").trim();
  const zip = (address.zip || "").trim();

  if (!firstName) {
    return { valid: false, error: "Personal sender first name is required." };
  }

  const lowerFirst = firstName.toLowerCase();
  const lowerLast = lastName.toLowerCase();
  const isBrandSender =
    lowerFirst.includes("docketstamp") ||
    lowerFirst.includes("western amalgamated") ||
    lowerLast.includes("docketstamp") ||
    lowerLast.includes("western amalgamated");

  if (isBrandSender) {
    return {
      valid: false,
      isBrandSender: true,
      error: "Return address must use personal sender name, not brand name DocketStamp or Western Amalgamated.",
    };
  }

  if (!street1 || !city || !state || !zip) {
    return { valid: false, error: "Complete return address (street, city, state, ZIP) is required." };
  }

  return { valid: true };
}

export class DuplicateDispatchError extends Error {
  public status: string;
  public lobLetterId?: string;
  constructor(status: string, lobLetterId?: string) {
    super(`Order already in state ${status}`);
    this.name = "DuplicateDispatchError";
    this.status = status;
    this.lobLetterId = lobLetterId;
  }
}

/**
 * Atomically and idempotently processes and fulfills a paid order.
 * Uses a Firestore database transaction to acquire an exclusive 'DISPATCHING' lock,
 * completely preventing concurrent double-dispatch races between client confirmation
 * and asynchronous Stripe webhooks.
 */
export async function processPaidOrder(
  orderId: string,
  paymentIntentId: string,
  customerEmail?: string,
  clientContext?: ProcessOrderOptions
): Promise<ProcessPaidOrderResult> {
  let order: Order;

  // Real Stripe PaymentIntents must have a durable finance fact before this
  // legacy inline fulfillment path can acquire its dispatch lock.
  if (paymentIntentId.startsWith("pi_") && !paymentIntentId.startsWith("pi_mock_")) {
    if (!clientContext?.authorityFactId) {
      return {
        success: false,
        status: "PAYMENT_AUTHORITY_REQUIRED",
        error: "Verified payment authority fact is required before fulfillment.",
      };
    }
    const authority = await firestoreDb.collection("payment_facts_v1").doc(clientContext.authorityFactId).get();
    const fact = authority.exists ? (authority.data() as Record<string, unknown>) : null;
    if (
      !fact || fact.kind !== "capture" || fact.verification !== "verified" ||
      fact.orderId !== orderId || fact.providerObjectId !== paymentIntentId || fact.provider !== "stripe" ||
      fact.providerMode !== (clientContext.paymentMode === "stripe_test" ? "test" : clientContext.paymentMode)
    ) {
      return {
        success: false,
        status: "PAYMENT_AUTHORITY_INVALID",
        error: "Verified payment authority fact does not match the order and PaymentIntent.",
      };
    }
  }

  // 1. Atomic Locking via Firestore Transaction:
  // Read and check status atomically, and claim the 'DISPATCHING' lock.
  // This guarantees that even under extreme concurrency, only ONE thread acquires the lock.
  try {
    order = await firestoreDb.runTransaction(async (transaction: any) => {
      const docRef = getOrdersCollection().doc(orderId);
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) {
        throw new Error(`Order ${orderId} not found in database.`);
      }

      const existingOrder = snapshot.data() as Order;
      const snapshotError = validateFrozenNoticeOrder(existingOrder);
      if (snapshotError) {
        throw new Error(`ORDER_NOT_DISPATCHABLE:${snapshotError}`);
      }

      // Check if already dispatched, processing, or actively being dispatched
      if (
        existingOrder.status === "DISPATCHING" ||
        existingOrder.status === "PROCESSING_DISPATCH" ||
        existingOrder.status === "PROCESSING_HANDWRYTTEN" ||
        existingOrder.status === "MAILED" ||
        existingOrder.status === "QUEUED_FOR_FULFILLMENT"
      ) {
        throw new DuplicateDispatchError(
          existingOrder.status,
          existingOrder.lobLetterId
        );
      }

      const finalEmail = customerEmail || existingOrder.customerEmail;

      // Atomically transition status to DISPATCHING lock
      transaction.update(docRef, {
        status: "DISPATCHING",
        stripePaymentId: paymentIntentId,
        customerEmail: finalEmail,
        dispatchStartedAt: Date.now(),
        updatedAt: Date.now(),
        ...(clientContext?.isTest !== undefined || clientContext?.paymentMode
          ? {
              isTest: Boolean(clientContext?.isTest ?? (clientContext?.paymentMode !== "live")),
              paymentMode: clientContext?.paymentMode || "stripe_test",
            }
          : {}),
      });

      return {
        ...existingOrder,
        status: "DISPATCHING",
        stripePaymentId: paymentIntentId,
        customerEmail: finalEmail,
      };
    });
  } catch (err: unknown) {
    if (err instanceof DuplicateDispatchError) {
      console.log(
        `[OrderProcessor] Idempotency lock active: Order ${orderId} is currently '${err.status}' (Lob ID: ${err.lobLetterId || "pending"}). Safely dropping duplicate dispatch.`
      );
      return {
        success: true,
        status: err.status,
        lobLetterId: err.lobLetterId,
        alreadyProcessed: true,
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("ORDER_NOT_DISPATCHABLE:")) {
      return { success: false, status: msg.slice("ORDER_NOT_DISPATCHABLE:".length), error: "Only a complete, integrity-verified frozen notice can be dispatched." };
    }
    if (msg.includes("not found")) {
      return {
        success: false,
        status: "NOT_FOUND",
        error: msg,
      };
    }

    console.error(`[OrderProcessor] Transaction exception for order ${orderId}:`, msg);
    throw err;
  }

  // Record server authority telemetry for verified purchase (order_paid_confirmed + purchase_verified)
  try {
    const rawSessionId =
      order.sessionId ||
      (order.attribution as any)?.sessionId ||
      order.telemetrySessionId ||
      `sess_${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

    const expVersion = order.experienceVersion || "home_v2";
    const entrySrc = (order as any).entrySource || "unknown";

    // 1. Authoritative order_paid_confirmed event for v2 funnel correlation
    await recordServerTelemetry({
      eventName: "order_paid_confirmed",
      sessionId: rawSessionId,
      orderId,
      metadata: {
        amountInCents: order.finalAmountInCents || order.amountInCents || 1995,
        isTest: Boolean(clientContext?.isTest || order.isTest),
        paymentMode: clientContext?.paymentMode || order.paymentMode || "stripe_test",
        noticeSlug: order.noticeType,
        tier: order.serviceLevel,
        entrySource: entrySrc,
        experienceVersion: expVersion,
      },
      experienceVersion: expVersion,
    });

    // 2. purchase_verified event for historical rollup compatibility
    await recordServerTelemetry({
      eventName: "purchase_verified",
      sessionId: rawSessionId,
      orderId,
      metadata: {
        amountInCents: order.finalAmountInCents || order.amountInCents || 1995,
        isTest: Boolean(clientContext?.isTest || order.isTest),
        paymentMode: clientContext?.paymentMode || order.paymentMode || "stripe_test",
        noticeSlug: order.noticeType,
        tier: order.serviceLevel,
        entrySource: entrySrc,
        experienceVersion: expVersion,
      },
      experienceVersion: expVersion,
    });
  } catch (telErr) {
    console.warn("[OrderProcessor] Notice recording order_paid_confirmed telemetry:", telErr);
  }

  // 4. Record discount code usage metrics if applicable
  if (order.discountCode) {
    try {
      await recordDiscountUsage(order.discountCode, order.discountAmountInCents || 0);
    } catch (discErr) {
      console.warn("[OrderProcessor] Notice recording discount code usage:", discErr);
    }
  }

  // S0-06: Reject orders without a personal sender name and return address before fulfillment
  const senderValidation = validatePersonalSender(order.returnAddress);
  if (!senderValidation.valid) {
    const errorMsg = senderValidation.error || "Missing or invalid personal sender return address.";
    console.error(`[OrderProcessor Critical] ${errorMsg} on Order ${orderId}. Halting fulfillment.`);

    await updateOrderStatus(orderId, {
      status: "QUEUED_FOR_FULFILLMENT",
      fulfillmentError: `${errorMsg} Requires operator review.`,
    });

    await logIncident({
      type: "SYSTEM",
      category: "OPERATOR_ACTION",
      severity: "error",
      summary: `Invalid/Missing Sender Address on Order ${orderId}`,
      technicalDetails: `${errorMsg} Automatic dispatch halted to prevent brand-name or missing sender delivery.`,
      metadata: { orderId, returnAddress: order.returnAddress },
    });

    return {
      success: false,
      status: "QUEUED_FOR_FULFILLMENT",
      error: errorMsg,
    };
  }

  const isTestModePayment = Boolean(
    clientContext?.isTest ||
    clientContext?.paymentMode === "stripe_test" ||
    clientContext?.paymentMode === "local_mock"
  );

  let fulfillment: {
    success: boolean;
    order_id?: string;
    trackingNumber?: string;
    url?: string;
    expectedDeliveryDate?: string;
    error?: string;
    details?: unknown;
  };

  // 5. Dispatch to Lob programmatic USPS letter fulfillment with deterministic orderId for idempotency
  const toName = `${order.recipientAddress.firstName || ""} ${order.recipientAddress.lastName || ""}`.trim() || "Receiving Party";
  const fromName = `${order.returnAddress.firstName || ""} ${order.returnAddress.lastName || ""}`.trim() || "Filing Party";
  const docketId = order.docketId || `DS-2026-${orderId.slice(-6).toUpperCase()}`;

  const lobResult = await dispatchLetter({
    orderId,
    docketId,
    description: `DocketStamp Formal Notice: ${docketId}`,
    serviceLevel: (order.serviceLevel as UspsServiceLevel) || "CERTIFIED",
    to: {
      name: toName,
      address_line1: order.recipientAddress.street1,
      address_line2: order.recipientAddress.street2,
      address_city: order.recipientAddress.city,
      address_state: order.recipientAddress.state,
      address_zip: order.recipientAddress.zip,
    },
    from: {
      name: fromName,
      address_line1: order.returnAddress.street1,
      address_line2: order.returnAddress.street2,
      address_city: order.returnAddress.city,
      address_state: order.returnAddress.state,
      address_zip: order.returnAddress.zip,
    },
    file: order.documentHtml as string,
    color: false,
  });

  fulfillment = {
    success: lobResult.success,
    order_id: lobResult.letterId,
    trackingNumber: lobResult.trackingNumber,
    url: lobResult.url,
    expectedDeliveryDate: lobResult.expectedDeliveryDate,
    error: lobResult.error,
    details: lobResult.rawResponse,
  };

  if (!fulfillment.success) {
    const rawError = fulfillment.error || "";
    console.error(`[OrderProcessor] Lob USPS dispatch queued/failed for Order ${orderId}:`, rawError);
    await updateOrderStatus(orderId, {
      status: "QUEUED_FOR_FULFILLMENT",
      fulfillmentError: rawError || "Awaiting postal dispatch queue",
    });

    const isBillingError = /payment|card|balance|credit|funds/i.test(rawError);
    const isAddressError = /address|zip|postal|city|state|street/i.test(rawError);

    const category = isBillingError
      ? "STUDIO_BILLING"
      : isAddressError
      ? "OPERATOR_ACTION"
      : "TRANSIENT";

    const summaryPrefix = isBillingError
      ? "[Postal Supplier Billing] Lob wholesale account depleted"
      : isAddressError
      ? "[Recipient Address Error] USPS address rejected"
      : "USPS postal dispatch gateway failed";

    await logIncident({
      type: "SYSTEM",
      category,
      severity: isBillingError ? "error" : "warning",
      summary: `${summaryPrefix} for Order ${orderId}: ${rawError || "Fulfillment API error"}`,
      technicalDetails: rawError || "Lob letter API error",
      metadata: { orderId, details: fulfillment.details },
    });

    try {
      const rawSessionId =
        (order.attribution as any)?.sessionId ||
        order.sessionId ||
        `sess_${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
      await recordServerTelemetry({
        eventName: "fulfillment_failed",
        sessionId: rawSessionId,
        orderId,
        metadata: {
          error: rawError,
          isTest: isTestModePayment,
        },
        experienceVersion: order.experienceVersion,
      });
    } catch (telErr) {
      console.warn("[OrderProcessor] Notice recording fulfillment_failed telemetry:", telErr);
    }

    return {
      success: false,
      status: "QUEUED_FOR_FULFILLMENT",
      error: rawError,
    };
  }

  if (lobResult.isSimulatedMock === true) {
    const simulationMessage = "Postal dispatch was simulated; no USPS mailing was created.";
    await updateOrderStatus(orderId, {
      status: "QUEUED_FOR_FULFILLMENT",
      postalProvider: "unknown",
      fulfillmentError: simulationMessage,
      ...(clientContext?.isTest !== undefined || clientContext?.paymentMode
        ? {
            isTest: true,
            paymentMode: clientContext?.paymentMode || "local_mock",
          }
        : {}),
    });
    return { success: false, status: "QUEUED_FOR_FULFILLMENT", error: simulationMessage };
  }

  // 6. Update Firestore Order to PROCESSING_DISPATCH
  await updateOrderStatus(orderId, {
    status: "PROCESSING_DISPATCH",
    lobLetterId: fulfillment.order_id,
    postalProvider: "lob",
    postalProviderReference: fulfillment.order_id,
    lobTrackingNumber: fulfillment.trackingNumber,
    lobTrackingUrl: fulfillment.url,
    expectedDeliveryDate: fulfillment.expectedDeliveryDate,
    fulfillmentError: undefined,
    ...(clientContext?.isTest !== undefined || clientContext?.paymentMode
      ? {
          isTest: Boolean(clientContext?.isTest ?? (clientContext?.paymentMode !== "live")),
          paymentMode: clientContext?.paymentMode || "stripe_test",
        }
      : {}),
  } as any);

  // 6b. Best-effort update Stripe PaymentIntent metadata with docket_id & lob_letter_id
  if (paymentIntentId && paymentIntentId.startsWith("pi_") && !paymentIntentId.startsWith("pi_mock_")) {
    try {
      const pMode = resolvePaymentMode();
      if (pMode === "live" || pMode === "stripe_test") {
        const stripeClient = getStripeClient();
        await stripeClient.paymentIntents.update(paymentIntentId, {
          metadata: {
            docket_id: docketId,
            lob_letter_id: fulfillment.order_id || lobResult.letterId || "",
            order_id: orderId,
          },
        });
        console.log(`[OrderProcessor] Patched Stripe PaymentIntent ${paymentIntentId} metadata with Lob Letter ID ${fulfillment.order_id || lobResult.letterId}`);
      }
    } catch (stripeErr) {
      console.warn(`[OrderProcessor] Best-effort Stripe PaymentIntent metadata patch skipped:`, stripeErr);
    }
  }

  // 6c. Send customer transactional dispatch receipt email
  const recipientEmail = customerEmail || order.customerEmail;
  if (recipientEmail) {
    try {
      const serviceLevelLabel =
        order.serviceLevel === "CERTIFIED_RETURN_RECEIPT"
          ? "USPS Certified Mail® + Return Receipt"
          : order.serviceLevel === "FIRST_CLASS"
          ? "Standard First-Class Dispatch"
          : "USPS Certified Mail®";

      const recipientStreet = [order.recipientAddress?.street1, order.recipientAddress?.street2].filter(Boolean).join(", ");
      const recipientCityStateZip = `${order.recipientAddress?.city || ""}, ${order.recipientAddress?.state || ""} ${order.recipientAddress?.zip || ""}`.trim();
      const recipientSummary = `${toName} — ${recipientStreet}, ${recipientCityStateZip}`;

      await sendDocketDispatchReceiptEmail({
        toEmail: recipientEmail,
        docketId,
        serviceLevelLabel,
        recipientName: toName,
        recipientAddressSummary: recipientSummary,
        trackingNumber: fulfillment.trackingNumber,
        orderId,
      });
      console.log(`[OrderProcessor] Sent official docket dispatch receipt email to ${recipientEmail} (Docket: ${docketId})`);
    } catch (receiptEmailErr) {
      console.warn(`[OrderProcessor] Notice sending dispatch receipt email to ${recipientEmail}:`, receiptEmailErr);
    }
  }

  // 7. Auto-resolve any prior incidents for this order
  try {
    await resolveIncidentsForOrder(
      orderId,
      `Self-resolved via successful Lob USPS postal dispatch (Letter ID: ${fulfillment.order_id})`
    );
  } catch (resolveErr) {
    console.warn("[OrderProcessor] Notice auto-resolving prior incidents:", resolveErr);
  }

  // 8. Mark image as CLAIMED in image_cache_pool if matched
  try {
    const cacheSnapshot = await getImageCachePoolCollection()
      .where("imageUrl", "==", order.frontImageUrl)
      .limit(1)
      .get();

    if (!cacheSnapshot.empty) {
      const docId = cacheSnapshot.docs[0].id;
      await getImageCachePoolCollection().doc(docId).update({
        status: "CLAIMED",
      });
    }
  } catch (cacheErr) {
    console.warn("[OrderProcessor] Notice updating cache pool status:", cacheErr);
  }

  // 9. Dispatch Meta Conversions API (CAPI) Purchase Event (deduplicated via event_id: orderId)
  if (!order.metaCapiTrackedAt) {
    try {
      const capiResult = await sendMetaCapiPurchaseEvent({
        order: {
          ...order,
          customerEmail: customerEmail || order.customerEmail,
        },
        clientIp: clientContext?.clientIp,
        userAgent: clientContext?.userAgent,
      });
      await markMetaCapiTrackedAtOnSuccess(capiResult, (timestamp) => updateOrderStatus(orderId, {
        metaCapiTrackedAt: timestamp,
      }));
    } catch (capiErr) {
      console.warn("[OrderProcessor] Notice sending Meta CAPI purchase event:", capiErr);
    }
  }

  // Record server authority telemetry for submitted fulfillment
  try {
    const rawSessionId =
      (order.attribution as any)?.sessionId ||
      order.sessionId ||
      `sess_${orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
    await recordServerTelemetry({
      eventName: "fulfillment_submitted",
      sessionId: rawSessionId,
      orderId,
      metadata: {
        lobLetterId: fulfillment.order_id,
        isTest: isTestModePayment,
      },
      experienceVersion: order.experienceVersion,
    });
  } catch (telErr) {
    console.warn("[OrderProcessor] Notice recording fulfillment_submitted telemetry:", telErr);
  }

  console.log(`[OrderProcessor] Order ${orderId} successfully dispatched! Lob Letter ID: ${fulfillment.order_id}`);

  return {
    success: true,
    status: "PROCESSING_DISPATCH",
    lobLetterId: fulfillment.order_id,
  };
}
