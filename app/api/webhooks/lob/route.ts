import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  firestoreDb,
  sanitizeFirestoreData,
  getOrdersCollection,
  getOrderById,
  getOrderByDocketId,
  getOrderByLobLetterId,
} from "@/lib/firebase-admin";
import { Order, OrderStatus } from "@/lib/types";
import { resolvePostalProvenance } from "@/lib/order-record";
import { PostalFactSchema } from "@/lib/admin-console/contracts";
import { normalizeLobEventState } from "@/lib/admin-console/postal/model";
import { serverEnvironment } from "@/lib/admin-console/commands/access";
import { resolveLobDispatchMode } from "@/src/lib/fulfillment/lob";
import { computeOrderSnapshotHash } from "@/lib/admin-console/finance/authority";

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

const POSTAL_STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  DISPATCHED_TO_USPS: 1,
  MAILED: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  RETURNED_TO_SENDER: 4,
};

function parseEventTime(...candidates: unknown[]): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate < 100_000_000_000 ? candidate * 1000 : candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function eventTimeFromHistory(event: Record<string, unknown>): number | undefined {
  const value = event.occurredAt ?? event.timestamp;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function statusCanAdvance(current: OrderStatus, next: OrderStatus): boolean {
  const currentRank = POSTAL_STATUS_RANK[current];
  const nextRank = POSTAL_STATUS_RANK[next];
  if (currentRank === undefined || nextRank === undefined) return true;
  // Delivered and returned are terminal postal outcomes. Keep the first terminal
  // state even if a delayed or contradictory event arrives later.
  if (current === "DELIVERED" || current === "RETURNED_TO_SENDER") return false;
  return nextRank >= currentRank;
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
    if (
      !letterId || provenance.provider !== "lob" || provenance.reference !== letterId
    ) {
      return NextResponse.json({ received: true, matched: false, ignored: "PROVIDER_PROVENANCE_MISMATCH" });
    }

    const eventId = target !== body && typeof body.id === "string" && body.id !== letterId
      ? body.id
      : crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
    const providerEventId = crypto.createHash("sha256").update(eventId, "utf8").digest("hex");
    const eventEnvironment = serverEnvironment();
    const lobAccountId = process.env.LOB_ACCOUNT_ID || "lob_default";
    const resolvedMode = resolveLobDispatchMode();
    const lobMode = resolvedMode === "live" || resolvedMode === "test_api" || resolvedMode === "mock" ? resolvedMode : "unknown";
    const cassMode = process.env.LOB_ENV === "staging_mock_cass" ? "staging_mock_cass" : lobMode === "live" ? "live" : "unknown";
    const eventOccurredAt = parseEventTime(
      body.created,
      body.date_created,
      body.created_at,
      target.date_created,
      target.created_at,
    );
    const nextStatus = mapLobEventToOrderStatus(eventType);

    // Re-read and apply the tracking update in one transaction. Webhook deliveries
    // can be concurrent, replayed, or out of order; a stale outer lookup must never
    // overwrite newer postal state or detach this event from its exact Lob letter.
    const commitResult = await firestoreDb.runTransaction(async (transaction: any) => {
      const docRef = getOrdersCollection().doc(order!.id);
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) return { matched: false as const, reason: "ORDER_MISSING" };

      const current = snapshot.data() as Order;
      const currentProvenance = resolvePostalProvenance(current);
      if (
        !letterId || currentProvenance.provider !== "lob" || currentProvenance.reference !== letterId
      ) {
        return { matched: false as const, reason: "PROVIDER_PROVENANCE_MISMATCH" };
      }

      const existingEvents = Array.isArray(current.lobTrackingEvents)
        ? [...current.lobTrackingEvents] as Array<Record<string, unknown>>
        : [];
      if (existingEvents.some((event) => event.eventFingerprint === eventId)) {
        return { matched: true as const, duplicate: true, status: current.status };
      }

      const receivedAt = Date.now();
      const effectiveEventTime = eventOccurredAt ?? receivedAt;
      const factId = crypto.createHash("sha256").update(`lob-postal:${eventEnvironment}:${lobAccountId}:${lobMode}:${providerEventId}`).digest("hex");
      const postalFactRef = firestoreDb.collection("postal_facts_v1").doc(factId);
      const postalFactSnap = await transaction.get(postalFactRef);
      const normalizedState = normalizeLobEventState(eventType.toLowerCase());
      const publicEventType = /^[a-z0-9_.:-]{1,120}$/i.test(eventType) ? eventType : "unmapped";
      const recordedSnapshotHash = (current as Order & { paymentSnapshotHash?: unknown }).paymentSnapshotHash;
      const snapshotHash = typeof recordedSnapshotHash === "string" && /^[a-f0-9]{64}$/i.test(recordedSnapshotHash)
        ? recordedSnapshotHash
        : computeOrderSnapshotHash(current);
      const latestKnownEventTime = existingEvents.reduce((latest, event) => {
        return Math.max(latest, eventTimeFromHistory(event) ?? 0);
      }, 0);
      const eventIsNewest = effectiveEventTime >= latestKnownEventTime;
      const advancesStatus = Boolean(nextStatus && statusCanAdvance(current.status, nextStatus));
      const updates: Record<string, unknown> = {
        postalProvider: "lob",
        postalProviderReference: letterId,
        updatedAt: receivedAt,
      };

      if (letterId && !current.lobLetterId) updates.lobLetterId = letterId;
      if (nextStatus && advancesStatus) {
        updates.status = nextStatus;
        updates.lobStatus = eventType;
      } else if (nextStatus && eventIsNewest && POSTAL_STATUS_RANK[current.status] === POSTAL_STATUS_RANK[nextStatus]) {
        updates.lobStatus = eventType;
      }

      if (trackingNumber && (!current.lobTrackingNumber || (eventIsNewest && eventOccurredAt !== undefined))) {
        updates.lobTrackingNumber = trackingNumber;
      }
      if (expectedDeliveryDate && (!current.lobExpectedDeliveryDate || (eventIsNewest && eventOccurredAt !== undefined))) {
        updates.lobExpectedDeliveryDate = expectedDeliveryDate;
      }
      if (nextStatus === "MAILED" && advancesStatus && !current.lobMailedDate) {
        updates.lobMailedDate = new Date(eventOccurredAt ?? receivedAt).toISOString().slice(0, 10);
      }

      existingEvents.push({
        eventFingerprint: eventId,
        eventType,
        occurredAt: effectiveEventTime,
        receivedAt,
        letterId,
        trackingNumber: trackingNumber || current.lobTrackingNumber,
        status: nextStatus || current.status,
      });
      updates.lobTrackingEvents = existingEvents;
      transaction.update(docRef, updates);
      if (!postalFactSnap.exists) {
        const postalFact = PostalFactSchema.parse({
          schemaVersion: 1, product: "docketstamp", environment: eventEnvironment,
          factId, orderId: current.id,
          ...(letterId ? { providerLetterId: letterId } : {}),
          providerEventId,
          providerAccountId: lobAccountId, lobMode, cassMode,
          state: normalizedState,
          providerState: publicEventType,
          occurredAt: new Date(effectiveEventTime).toISOString(),
          receivedAt: new Date(receivedAt).toISOString(),
          snapshotHash,
          evidenceRef: `lob_events_v1/${providerEventId}`,
          artifactKind: "none",
        });
        transaction.create(postalFactRef, sanitizeFirestoreData(postalFact));
      }
      return {
        matched: true as const,
        duplicate: false,
        status: advancesStatus && nextStatus ? nextStatus : current.status,
        trackingNumber: typeof updates.lobTrackingNumber === "string"
          ? updates.lobTrackingNumber
          : current.lobTrackingNumber,
      };
    });

    if (!commitResult.matched) {
      return NextResponse.json({ received: true, matched: false, ignored: commitResult.reason });
    }
    if (commitResult.duplicate) {
      return NextResponse.json({ received: true, matched: true, duplicate: true, orderId: order.id, status: commitResult.status });
    }

    console.log(
      `[LobWebhook] Successfully updated Order ${order.id} status -> '${commitResult.status}' from event '${eventType}'`
    );

    return NextResponse.json({
      received: true,
      matched: true,
      orderId: order.id,
      docketId: order.docketId,
      status: commitResult.status,
      lobTrackingNumber: commitResult.trackingNumber,
    });
  } catch (err: any) {
    console.error("[LobWebhook] Internal error processing webhook:", err);
    return NextResponse.json(
      { error: "Internal processing error", details: err?.message },
      { status: 500 }
    );
  }
}
