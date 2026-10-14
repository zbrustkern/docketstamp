import { NextRequest, NextResponse } from "next/server";
import {
  firestoreDb,
  getOrdersCollection,
  getDiscountCodesCollection,
  updateOrderStatus,
  getImageCachePoolCollection,
} from "@/lib/firebase-admin";
import { validateDiscount } from "@/lib/discount";
import { CARD_FLAT_RATE_CENTS } from "@/lib/stripe";
import { dispatchLetter } from "@/lib/fulfillment/lob";
import { logIncident } from "@/lib/incident-logger";
import { validatePersonalSender } from "@/lib/order-processor";
import { Order, DiscountCode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, discountCode, customerEmail } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    // 1. Atomically verify eligibility, claim DISPATCHING lock, and increment promo usage
    let txResult: {
      alreadyProcessed: boolean;
      order: Order;
      status?: string;
      handwryttenOrderId?: string;
    };

    try {
      txResult = await firestoreDb.runTransaction(async (transaction: any) => {
        const orderRef = getOrdersCollection().doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) {
          throw new Error("ORDER_NOT_FOUND");
        }

        const existingOrder = orderDoc.data() as Order;

        if (existingOrder.amountInCents > 0) {
          throw new Error("REQUIRES_PAYMENT");
        }

        // Check if already dispatched, processing, or actively being dispatched
        const isStaleLock =
          existingOrder.status === "DISPATCHING" &&
          existingOrder.dispatchStartedAt &&
          Date.now() - existingOrder.dispatchStartedAt > 5 * 60 * 1000;

        if (
          (existingOrder.status === "DISPATCHING" && !isStaleLock) ||
          existingOrder.status === "PROCESSING_DISPATCH" ||
          existingOrder.status === "PROCESSING_HANDWRYTTEN" ||
          existingOrder.status === "MAILED"
        ) {
          return {
            alreadyProcessed: true,
            order: existingOrder,
            status: existingOrder.status,
            handwryttenOrderId: existingOrder.handwryttenOrderId,
          };
        }

        // Verify discount code
        const codeToVerify = (discountCode || existingOrder.discountCode || "")
          .trim()
          .toUpperCase();
        if (!codeToVerify) {
          throw new Error("NO_DISCOUNT_CODE");
        }

        const discountRef = getDiscountCodesCollection().doc(codeToVerify);
        const discountDoc = await transaction.get(discountRef);
        if (!discountDoc.exists) {
          throw new Error("INVALID_DISCOUNT_CODE");
        }

        const discountData = discountDoc.data() as DiscountCode;
        const validation = validateDiscount(discountData, CARD_FLAT_RATE_CENTS);

        if (!validation.valid || validation.finalAmountInCents !== 0) {
          throw new Error(
            validation.error || "The discount code is no longer eligible for 100% free checkout."
          );
        }

        if (discountData.maxUses && (discountData.usedCount || 0) >= discountData.maxUses) {
          throw new Error("This discount code has reached its maximum usage limit.");
        }

        // Atomically increment discount usage inside transaction
        transaction.update(discountRef, {
          usedCount: (discountData.usedCount || 0) + 1,
          totalDiscountGivenCents:
            (discountData.totalDiscountGivenCents || 0) + CARD_FLAT_RATE_CENTS,
          updatedAt: Date.now(),
        });

        const finalEmail = customerEmail || existingOrder.customerEmail || "";

        // Atomically claim DISPATCHING lock on order
        transaction.update(orderRef, {
          status: "DISPATCHING",
          dispatchStartedAt: Date.now(),
          customerEmail: finalEmail,
          paymentMethod: "PROMO_CODE",
          discountCode: codeToVerify,
          updatedAt: Date.now(),
        });

        return {
          alreadyProcessed: false,
          order: {
            ...existingOrder,
            status: "DISPATCHING",
            customerEmail: finalEmail,
            paymentMethod: "PROMO_CODE",
            discountCode: codeToVerify,
          },
        };
      });
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (msg === "ORDER_NOT_FOUND") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (msg === "REQUIRES_PAYMENT") {
        return NextResponse.json(
          { error: "This order requires payment and cannot be completed as free." },
          { status: 400 }
        );
      }
      if (msg === "NO_DISCOUNT_CODE" || msg === "INVALID_DISCOUNT_CODE") {
        return NextResponse.json(
          { error: "A valid discount code is required for free checkout." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 2. Handle deduplicated replay
    if (txResult.alreadyProcessed) {
      console.log(
        `[Free Order] Idempotency lock active: Order ${orderId} is currently '${txResult.status}'. Dropping duplicate dispatch.`
      );
      return NextResponse.json({
        success: true,
        orderId,
        status: txResult.status,
        handwryttenOrderId: txResult.handwryttenOrderId,
        alreadyProcessed: true,
      });
    }

    const { order } = txResult;

    // 3. Sender validation
    const senderValidation = validatePersonalSender(order.returnAddress);
    if (!senderValidation.valid) {
      const errorMsg = senderValidation.error || "Missing or invalid personal sender return address.";
      console.error(`[Free Order] ${errorMsg} for ${orderId}. Halting fulfillment.`);
      await updateOrderStatus(orderId, {
        status: "QUEUED_FOR_FULFILLMENT",
        fulfillmentError: `${errorMsg} Requires operator review.`,
      });

      await logIncident({
        type: "HANDWRYTTEN",
        category: "OPERATOR_ACTION",
        severity: "error",
        summary: `Invalid/Missing Sender Address on Free Order ${orderId}`,
        technicalDetails: `${errorMsg} Dispatch halted to prevent brand-name or blank sender delivery.`,
        metadata: { orderId, discountCode: order.discountCode },
      });

      return NextResponse.json({
        success: true,
        orderId,
        status: "QUEUED_FOR_FULFILLMENT",
        warning: "Order placed, but fulfillment is queued for studio verification of return address.",
      });
    }

    // 4. Dispatch to Handwrytten robotic pen fulfillment with deterministic orderId
    console.log(
      `[Free Order] Dispatching Order ${orderId} (Promo: ${order.discountCode}) to Handwrytten...`
    );

    let fulfillment: { success: boolean; order_id?: string; error?: string };

    if (order.isTest) {
      console.log(`[Free Order] Test mode order ${orderId}. Skipping live Lob dispatch.`);
      fulfillment = {
        success: true,
        order_id: `test_free_ds_${orderId}`,
      };
    } else {
      const toName = `${order.recipientAddress.firstName || ""} ${order.recipientAddress.lastName || ""}`.trim() || "Receiving Party";
      const fromName = `${order.returnAddress.firstName || ""} ${order.returnAddress.lastName || ""}`.trim() || "Filing Party";
      const docketId = order.docketId || `DS-2026-${orderId.slice(-6).toUpperCase()}`;

      const lobResult = await dispatchLetter({
        orderId,
        docketId,
        description: `DocketStamp Formal Notice: ${docketId} (Comp/Free)`,
        serviceLevel: (order.serviceLevel as any) || "CERTIFIED",
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
        file: order.documentHtml || order.printedMessage || `<html><body><h1>Formal Notice ${docketId}</h1><p>${order.handwrittenNote || ""}</p></body></html>`,
        color: false,
      });

      fulfillment = {
        success: lobResult.success,
        order_id: lobResult.letterId,
        error: lobResult.error,
      };
    }

    if (!fulfillment.success) {
      console.error(`[Free Order] Lob dispatch failed for ${orderId}:`, fulfillment.error);
      await updateOrderStatus(orderId, {
        status: "QUEUED_FOR_FULFILLMENT",
        fulfillmentError: fulfillment.error || "Awaiting postal dispatch queue",
      });

      await logIncident({
        type: "HANDWRYTTEN",
        severity: "error",
        summary: `Lob postal dispatch failed for Free Order ${orderId}`,
        technicalDetails: fulfillment.error || "Lob letter API error",
        metadata: { orderId, discountCode: order.discountCode },
      });

      return NextResponse.json({
        success: true,
        orderId,
        status: "QUEUED_FOR_FULFILLMENT",
        warning: "Order placed, but fulfillment is queued for registry verification.",
      });
    }

    // 5. Update order status to PROCESSING_DISPATCH
    await updateOrderStatus(orderId, {
      status: "PROCESSING_DISPATCH",
      handwryttenOrderId: fulfillment.order_id,
      lobLetterId: fulfillment.order_id,
    });

    // 6. Mark image as CLAIMED in cache pool if matched
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
      console.warn("[Free Order] Notice updating cache pool status:", cacheErr);
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: "PROCESSING_HANDWRYTTEN",
      handwryttenOrderId: fulfillment.order_id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error completing free order";
    console.error("[Complete Free Order Error]:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
