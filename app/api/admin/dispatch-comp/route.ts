import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { saveOrder, updateOrderStatus } from "@/lib/firebase-admin";
import { dispatchLetter } from "@/lib/fulfillment/lob";
import { Order, MailingAddress } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      printedMessage = "Formal Statutory Notice Specimen",
      handwrittenNote = "This is an administrative test notice dispatched via DocketStamp.",
      recipientAddress,
      returnAddress = {
        firstName: "DocketStamp",
        lastName: "Registry",
        street1: "100 N LaSalle St, Suite 2000",
        city: "Chicago",
        state: "IL",
        zip: "60602",
        country: "US",
      },
      compReason = "Administrative Test",
    } = body;

    if (!recipientAddress || !recipientAddress.street1 || !recipientAddress.city || !recipientAddress.state || !recipientAddress.zip) {
      return NextResponse.json({ error: "Complete recipient address is required" }, { status: 400 });
    }

    const orderId = `order_admin_${crypto.randomBytes(12).toString("hex")}`;
    const docketId = `DS-2026-${orderId.slice(-6).toUpperCase()}`;
    const viewToken = `tok_${crypto.randomBytes(12).toString("hex")}`;

    const orderRecord: Order = {
      id: orderId,
      docketId,
      customerEmail: "admin@docketstamp.com",
      printedMessage,
      handwrittenNote,
      recipientAddress: recipientAddress as MailingAddress,
      returnAddress: returnAddress as MailingAddress,
      status: "PAYMENT_RECEIVED",
      amountInCents: 0,
      originalAmountInCents: 1995,
      paymentMethod: "STUDIO_COMP",
      viewToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveOrder(orderRecord);

    const lobResult = await dispatchLetter({
      orderId,
      docketId,
      description: `DocketStamp Admin Notice: ${docketId} (${compReason})`,
      serviceLevel: "CERTIFIED",
      to: {
        name: `${recipientAddress.firstName || ""} ${recipientAddress.lastName || ""}`.trim() || "Recipient",
        address_line1: recipientAddress.street1,
        address_line2: recipientAddress.street2,
        address_city: recipientAddress.city,
        address_state: recipientAddress.state,
        address_zip: recipientAddress.zip,
      },
      from: {
        name: `${returnAddress.firstName || ""} ${returnAddress.lastName || ""}`.trim() || "DocketStamp Registry",
        address_line1: returnAddress.street1,
        address_line2: returnAddress.street2,
        address_city: returnAddress.city,
        address_state: returnAddress.state,
        address_zip: returnAddress.zip,
      },
      file: `<html><body><h1>${printedMessage}</h1><p>${handwrittenNote}</p></body></html>`,
    });

    if (!lobResult.success) {
      await updateOrderStatus(orderId, {
        status: "FAILED",
        fulfillmentError: lobResult.error,
      });
      return NextResponse.json({ error: lobResult.error }, { status: 502 });
    }

    await updateOrderStatus(orderId, {
      status: "PROCESSING_DISPATCH",
      lobLetterId: lobResult.letterId,
      handwryttenOrderId: lobResult.letterId,
    });

    return NextResponse.json({
      success: true,
      orderId,
      docketId,
      letterId: lobResult.letterId,
      trackingNumber: lobResult.trackingNumber,
    });
  } catch (err: any) {
    console.error("[Admin Dispatch Exception]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
