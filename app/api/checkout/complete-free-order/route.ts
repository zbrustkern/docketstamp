import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/firebase-admin";
import { authorizeFreeOrder } from "@/lib/admin-console/postal/free-authority";
import { dispatchAuthorizedObligation, resolvePostalObligation } from "@/lib/admin-console/postal/dispatch";
import { validateFrozenNoticeOrder } from "@/lib/frozen-notice-order";
import { validatePersonalSender } from "@/lib/order-processor";
import { readOrderRecord } from "@/lib/order-record";

const ALREADY_DISPATCHING = new Set(["DISPATCHING", "PROCESSING_DISPATCH", "MAILED", "IN_TRANSIT", "DELIVERED"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });

    const order = await getOrderById(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (validateFrozenNoticeOrder(order)) {
      return NextResponse.json({ code: "LEGACY_ORDER_UNSUPPORTED", error: "Only an integrity-verified frozen notice can be completed." }, { status: 410 });
    }
    const record = readOrderRecord(order);
    if (record.schemaVersion !== 2 || record.kind !== "notice") {
      return NextResponse.json({
        code: "LEGACY_FREE_AUTHORITY_REQUIRES_RECONCILIATION",
        error: "This historical zero-value notice needs operator reconciliation before postal dispatch.",
      }, { status: 409 });
    }
    const senderValidation = validatePersonalSender(order.returnAddress);
    if (!senderValidation.valid) {
      const message = senderValidation.error || "A complete personal return address is required.";
      await updateOrderStatus(orderId, { status: "QUEUED_FOR_FULFILLMENT", fulfillmentError: `${message} Requires operator review.` });
      return NextResponse.json({ success: true, orderId, status: "QUEUED_FOR_FULFILLMENT", warning: "Order is queued for return address review." });
    }
    if ((order.finalAmountInCents ?? order.amountInCents) !== 0 || order.paymentMethod !== "PROMO_CODE") {
      return NextResponse.json({ error: "This order is not an authorized zero-value promotional order." }, { status: 400 });
    }
    if (!order.discountCode || String(body.discountCode || "").trim().toUpperCase() !== order.discountCode.toUpperCase()) {
      return NextResponse.json({ error: "The promotional authorization does not match this order." }, { status: 400 });
    }
    if (ALREADY_DISPATCHING.has(order.status)) {
      return NextResponse.json({ success: true, orderId, status: order.status, lobLetterId: order.lobLetterId, alreadyProcessed: true, viewToken: order.viewToken });
    }

    const actorId = `customer:${order.userId || order.id}`;
    const evidenceRef = `checkout:promo:${order.discountCode}`;
    await authorizeFreeOrder(orderId, { kind: "promo", evidenceRef, actorId });

    const result = await dispatchAuthorizedObligation({
      orderId,
      requestId: `free-checkout:${orderId}`,
      actorId,
      evidenceRef,
      resolveObligation: resolvePostalObligation,
    });
    if (result.status === "accepted") {
      await updateOrderStatus(orderId, {
        status: "PROCESSING_DISPATCH",
        lobLetterId: result.providerLetterId,
        postalProvider: "lob",
        postalProviderReference: result.providerLetterId,
        fulfillmentError: undefined,
      });
      return NextResponse.json({ success: true, orderId, status: "PROCESSING_DISPATCH", lobLetterId: result.providerLetterId, viewToken: order.viewToken });
    }
    if (result.status === "simulated") {
      await updateOrderStatus(orderId, { status: "QUEUED_FOR_FULFILLMENT", fulfillmentError: "Postal dispatch was simulated; no USPS mailing was created." });
      return NextResponse.json({ success: true, orderId, status: "QUEUED_FOR_FULFILLMENT", simulated: true, viewToken: order.viewToken });
    }
    if (result.status === "uncertain") {
      await updateOrderStatus(orderId, { status: "QUEUED_FOR_FULFILLMENT", fulfillmentError: "Postal result is uncertain and requires reconciliation." });
      return NextResponse.json({ success: false, orderId, status: "QUEUED_FOR_FULFILLMENT", code: "POSTAL_RESULT_AMBIGUOUS" }, { status: 202 });
    }
    if (result.status === "blocked") {
      return NextResponse.json({ success: false, orderId, status: result.reason, error: "Free order is not authorized for postal dispatch." }, { status: 409 });
    }
    return NextResponse.json({ success: false, orderId, error: "Postal dispatch result was not recognized." }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete free notice order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
