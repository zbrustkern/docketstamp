import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus, getSystemIncidentsCollection, resolveIncidentsForOrder } from "@/lib/firebase-admin";
import { dispatchLetter } from "@/lib/fulfillment/lob";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { MailingAddress } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized access to fulfillment retry" }, { status: 401 });
    }

    const { orderId, updatedRecipientAddress, incidentId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId parameter" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let recipientToUse = order.recipientAddress;

    // If operator provided an updated or corrected address
    if (updatedRecipientAddress && typeof updatedRecipientAddress === "object") {
      const addressUpdate: MailingAddress = {
        firstName: String(updatedRecipientAddress.firstName || "").trim(),
        lastName: String(updatedRecipientAddress.lastName || "").trim(),
        street1: String(updatedRecipientAddress.street1 || "").trim(),
        street2: String(updatedRecipientAddress.street2 || "").trim(),
        city: String(updatedRecipientAddress.city || "").trim(),
        state: String(updatedRecipientAddress.state || "").trim().toUpperCase(),
        zip: String(updatedRecipientAddress.zip || "").trim(),
      };
      await updateOrderStatus(orderId, { recipientAddress: addressUpdate });
      recipientToUse = addressUpdate;
    }

    console.log(`[Admin] Retrying Lob USPS dispatch for order: ${orderId}...`);

    const toName = `${recipientToUse.firstName || ""} ${recipientToUse.lastName || ""}`.trim() || "Receiving Party";
    const fromName = `${order.returnAddress.firstName || ""} ${order.returnAddress.lastName || ""}`.trim() || "Filing Party";
    const docketId = order.docketId || `DS-2026-${orderId.slice(-6).toUpperCase()}`;

    const lobResult = await dispatchLetter({
      orderId,
      docketId,
      description: `DocketStamp Formal Notice: ${docketId} (Admin Retry)`,
      serviceLevel: (order.serviceLevel as any) || "CERTIFIED",
      to: {
        name: toName,
        address_line1: recipientToUse.street1,
        address_line2: recipientToUse.street2,
        address_city: recipientToUse.city,
        address_state: recipientToUse.state,
        address_zip: recipientToUse.zip,
      },
      from: {
        name: fromName,
        address_line1: order.returnAddress.street1,
        address_line2: order.returnAddress.street2,
        address_city: order.returnAddress.city,
        address_state: order.returnAddress.state,
        address_zip: order.returnAddress.zip,
      },
      file: order.documentHtml || order.printedMessage || `<html><body><h1>Formal Notice ${docketId}</h1><p>${order.handwrittenNote || ""}</p></body></html>`,
      color: false,
    });

    if (!lobResult.success) {
      console.error(`[Admin] Retry dispatch failed for ${orderId}:`, lobResult.error);
      await updateOrderStatus(orderId, {
        status: "QUEUED_FOR_FULFILLMENT",
        fulfillmentError: lobResult.error || "Retry dispatch failed",
      });
      return NextResponse.json(
        {
          success: false,
          error: lobResult.error,
        },
        { status: 400 }
      );
    }

    await updateOrderStatus(orderId, {
      status: "PROCESSING_DISPATCH",
      handwryttenOrderId: lobResult.letterId,
      lobLetterId: lobResult.letterId,
      lobTrackingNumber: lobResult.trackingNumber,
      fulfillmentError: "",
    });

    // Auto-resolve any associated incidents
    try {
      if (incidentId) {
        await getSystemIncidentsCollection().doc(incidentId).update({
          resolved: true,
          resolvedAt: Date.now(),
          resolutionNote: `Resolved via admin retry (Letter ID: ${lobResult.letterId})`,
        });
      }
      await resolveIncidentsForOrder(
        orderId,
        `Resolved via admin postal retry (Letter ID: ${lobResult.letterId})`
      );
    } catch (incErr) {
      console.warn("[Admin] Notice resolving incident during retry:", incErr);
    }

    console.log(`[Admin] Order ${orderId} successfully dispatched! Letter ID: ${lobResult.letterId}`);
    return NextResponse.json({
      success: true,
      letterId: lobResult.letterId,
      handwryttenOrderId: lobResult.letterId,
      status: "PROCESSING_DISPATCH",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error executing retry";
    console.error("[Admin Retry Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
