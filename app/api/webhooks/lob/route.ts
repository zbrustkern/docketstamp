import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getOrderById,
  getOrderByDocketId,
  getOrderByLobLetterId,
  updateOrderStatus,
} from "@/lib/firebase-admin";
import { Order, OrderStatus } from "@/lib/types";
import { resolvePostalProvenance } from "@/lib/order-record";
import { validateFrozenNoticeOrder } from "@/lib/frozen-notice-order";

/**
 * Maps Lob webhook events to internal OrderStatus lifecycle states.
 */
function mapLobEventToOrderStatus(eventType: string): OrderStatus | null {
  const norm = (eventType || "").trim().toLowerCase();
  if (norm.includes("delivered")) {
    return "DELIVERED";
  }
  if (norm.includes("returned")) {
    return "RETURNED_TO_SENDER";
  }
  if (
    norm.includes("in_transit") ||
    norm.includes("in_local_area") ||
    norm.includes("processed_for_delivery")
  ) {
    return "IN_TRANSIT";
  }
  if (norm.includes("mailed")) {
    return "MAILED";
  }
  return null;
}

/**
 * Validates Lob webhook signature or basic-auth header if LOB_WEBHOOK_SECRET is set.
 */
function verifyLobWebhookRequest(
  req: NextRequest,
  rawBody: string,
  secret: string
): boolean {
  // 1. Check HMAC signature headers (lob-signature and lob-signature-timestamp)
  const signature = req.headers.get("lob-signature");
  const timestamp = req.headers.get("lob-signature-timestamp");

  if (signature) {
    // If timestamp is provided, sign `${timestamp}.${rawBody}`, else sign rawBody directly
    const stringToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const computed = crypto
      .createHmac("sha256", secret)
      .update(stringToSign, "utf8")
      .digest("hex");

    // Timing-safe comparison
    if (
      signature.length === computed.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))
    ) {
      return true;
    }
  }

  // 2. Check HTTP Basic Auth (Authorization: Basic <base64>)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      // Format can be user:secret or secret:
      const parts = decoded.split(":");
      const providedSecret = parts[1] || parts[0];
      if (providedSecret === secret) {
        return true;
      }
    } catch {
      // Fall through to failure
    }
  }

  return false;
}

const PLACEHOLDER_WEBHOOK_SECRETS = new Set([
  "whsec_placeholder",
  "whsec_replace_me",
  "placeholder",
  "lob_whsec_placeholder",
  "changeme",
  "secret",
  "test",
]);

function isConfiguredWebhookSecret(secret?: string | null): secret is string {
  if (!secret || typeof secret !== "string") return false;
  const trimmed = secret.trim();
  if (trimmed.length < 12) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_WEBHOOK_SECRETS.has(lower)) return false;
  if (lower.includes("placeholder") || lower.includes("replace_me")) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.LOB_WEBHOOK_SECRET;
    const allowUnsignedTestHarness =
      process.env.NODE_ENV === "test" &&
      process.env.USE_MOCK_FIRESTORE === "true" &&
      process.env.LOB_WEBHOOK_ALLOW_UNSIGNED_TEST === "true";

    if (!isConfiguredWebhookSecret(webhookSecret)) {
      if (!allowUnsignedTestHarness) {
        console.error(
          "[LobWebhook] FAIL-CLOSED: LOB_WEBHOOK_SECRET is missing or placeholder; rejecting unsigned webhook."
        );
        return NextResponse.json(
          {
            error:
              "LOB_WEBHOOK_SECRET is not configured or uses a placeholder value; webhook rejected (fail-closed).",
          },
          { status: 503 }
        );
      }
    } else {
      const isValid = verifyLobWebhookRequest(req, rawBody, webhookSecret.trim());
      if (!isValid) {
        console.warn("[LobWebhook] Unauthorized webhook signature or credential verification failure");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Resolve eventType
    const eventType: string =
      body.event_type?.id ||
      (typeof body.event_type === "string" ? body.event_type : "") ||
      body.type ||
      body.event ||
      "";

    // Extract target letter object (Lob payloads place letter resource in body.body, body.data, or root)
    const target = body.body || body.data || body;
    const letterId: string | undefined = target.id || body.id;
    const metadata = target.metadata || body.metadata || {};
    const orderId: string | undefined = metadata.order_id || metadata.orderId;
    const docketId: string | undefined = metadata.docket_id || metadata.docketId;
    const trackingNumber: string | undefined =
      target.tracking_number || body.tracking_number;
    const expectedDeliveryDate: string | undefined =
      target.expected_delivery_date || body.expected_delivery_date;

    console.log(
      `[LobWebhook] Received event '${eventType}' for letter ${letterId || "unknown"} (Order: ${orderId || "unknown"}, Docket: ${docketId || "unknown"})`
    );

    // Locate matching Order in Firestore
    let order: Order | null = null;
    if (orderId) {
      order = await getOrderById(orderId);
    }
    if (!order && docketId) {
      order = await getOrderByDocketId(docketId);
    }
    if (!order && letterId) {
      order = await getOrderByLobLetterId(letterId);
    }

    if (!order) {
      console.warn(
        `[LobWebhook] No matching order found for Lob event '${eventType}' (Letter: ${letterId}, Order: ${orderId}, Docket: ${docketId})`
      );
      // Return 200 so Lob does not repeatedly hammer the webhook with unknown letters
      return NextResponse.json({
        received: true,
        matched: false,
        message: "Order not found in registry",
      });
    }

    const provenance = resolvePostalProvenance(order);
    // Receiving a signed postal event is not a new dispatch. Keep tracking for
    // an explicitly matched historical Lob letter even when old records lack
    // today's snapshot schema. Unknown/provider-conflict records cannot borrow IDs.
    if (provenance.provider === "unknown" &&
        (provenance.evidence === "conflict" || validateFrozenNoticeOrder(order))) {
      return NextResponse.json({ received: true, matched: false, ignored: "LEGACY_ORDER" });
    }
    if (
      !letterId || provenance.provider === "handwrytten" ||
      (provenance.provider === "lob" && provenance.reference !== letterId)
    ) {
      return NextResponse.json({ received: true, matched: false, ignored: "PROVIDER_PROVENANCE_MISMATCH" });
    }

    // Build partial order update
    const nextStatus = mapLobEventToOrderStatus(eventType);
    const updates: Partial<Order> = {
      lobStatus: eventType,
      postalProvider: "lob",
      ...(letterId ? { postalProviderReference: letterId } : {}),
      updatedAt: Date.now(),
    };

    if (nextStatus) {
      updates.status = nextStatus;
    }

    if (letterId && !order.lobLetterId) {
      updates.lobLetterId = letterId;
    }

    if (trackingNumber) {
      updates.lobTrackingNumber = trackingNumber;
    }

    if (expectedDeliveryDate) {
      updates.lobExpectedDeliveryDate = expectedDeliveryDate;
    }

    if (nextStatus === "MAILED" && !order.lobMailedDate) {
      updates.lobMailedDate = new Date().toISOString().split("T")[0];
    }

    // Append to tracking events history
    const existingEvents = Array.isArray(order.lobTrackingEvents)
      ? [...order.lobTrackingEvents]
      : [];

    existingEvents.push({
      eventType,
      timestamp: Date.now(),
      letterId,
      trackingNumber: trackingNumber || order.lobTrackingNumber,
      status: nextStatus || order.status,
    });

    updates.lobTrackingEvents = existingEvents;

    await updateOrderStatus(order.id, updates);

    console.log(
      `[LobWebhook] Successfully updated Order ${order.id} status -> '${updates.status || order.status}' from event '${eventType}'`
    );

    return NextResponse.json({
      received: true,
      matched: true,
      orderId: order.id,
      docketId: order.docketId,
      status: updates.status || order.status,
      lobTrackingNumber: updates.lobTrackingNumber || order.lobTrackingNumber,
    });
  } catch (err: any) {
    console.error("[LobWebhook] Internal error processing webhook:", err);
    return NextResponse.json(
      { error: "Internal processing error", details: err?.message },
      { status: 500 }
    );
  }
}
