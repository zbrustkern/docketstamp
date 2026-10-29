import crypto from "node:crypto";
import { z } from "zod";
import { firestoreDb, sanitizeFirestoreData } from "@/lib/firebase-admin";
import { PostalFactSchema } from "@/lib/admin-console/contracts";
import { appendServerBusinessEvent } from "@/lib/admin-console/measurement/server-events";
import { DispatchAttemptSchema } from "./model";

const ATTEMPTS = "dispatch_attempts_v1";
const LOCKS = "dispatch_locks_v1";
const LEASE_MS = 120_000;

export interface AttemptAuthority {
  product: "docketstamp";
  environment: "local" | "staging" | "production";
  orderId: string;
  snapshotHash: string;
  snapshotVersion: number;
  tier: "first_class" | "certified" | "certified_return_receipt";
  currency: string;
  payableAmountMinor: number;
  lobMode: "live" | "test_api" | "mock" | "unconfigured";
  cassMode: "live" | "staging_mock_cass" | "unknown";
  paymentFactId?: string;
  freeAuthorizationFactId?: string;
}

export type ClaimAttemptResult =
  | { claimed: true; attempt: z.infer<typeof DispatchAttemptSchema>; duplicateRequest: boolean }
  | { claimed: false; reason: "already_accepted" | "active_lease" | "reconcile_uncertain" | "snapshot_conflict" };

function sha(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }
function lockId(environment: string, lobMode: string, orderId: string, snapshotVersion: number) { return sha(`${environment}:${lobMode}:${orderId}:${snapshotVersion}`); }
function iso(ms: number) { return new Date(ms).toISOString(); }
function stableId(value: string) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function classificationForOrder(order: Record<string, unknown>, paymentFact?: Record<string, unknown>) {
  const recorded = (paymentFact?.classification as Record<string, unknown> | undefined)?.primary;
  if (typeof recorded === "string") return recorded as "customer" | "founder" | "employee" | "automated_test" | "comp" | "free_promo" | "suspected_bot" | "unresolved";
  if (order.isFounderTest === true) return "founder" as const;
  if (order.isComp === true) return "comp" as const;
  if (order.paymentMethod === "PROMO_CODE") return "free_promo" as const;
  return "unresolved" as const;
}

export async function getDispatchLock(input: {
  environment: "local" | "staging" | "production";
  lobMode: "live" | "test_api" | "mock";
  orderId: string;
  snapshotVersion: number;
}): Promise<Record<string, unknown> | null> {
  const snap = await firestoreDb.collection(LOCKS).doc(lockId(input.environment, input.lobMode, input.orderId, input.snapshotVersion)).get();
  return snap.exists ? snap.data() as Record<string, unknown> : null;
}

/** Repair the payment/follow-on outboxes from an already accepted postal lock. */
export async function reconcileAcceptedDispatchOutboxes(
  attemptId: string,
  authorityInput: string | { paymentFactId: string; freeAuthorizationFactId?: never } | { freeAuthorizationFactId: string; paymentFactId?: never },
): Promise<boolean> {
  const authority = typeof authorityInput === "string" ? { paymentFactId: authorityInput } : authorityInput;
  const attemptRef = firestoreDb.collection(ATTEMPTS).doc(attemptId);
  return firestoreDb.runTransaction(async (tx: any) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) return false;
    const attempt = attemptSnap.data() as Record<string, unknown>;
    const lockRef = firestoreDb.collection(LOCKS).doc(lockId(String(attempt.environment), String(attempt.lobMode), String(attempt.orderId), Number(attempt.snapshotVersion)));
    const orderRef = firestoreDb.collection("orders").doc(String(attempt.orderId));
    const lockSnap = await tx.get(lockRef);
    const orderSnap = await tx.get(orderRef);
    if (!lockSnap.exists || !orderSnap.exists) return false;
    const lock = lockSnap.data() as Record<string, unknown>;
    const authorityMatches = "paymentFactId" in authority
      ? attempt.paymentFactId === authority.paymentFactId
      : attempt.freeAuthorizationFactId === authority.freeAuthorizationFactId;
    if (attempt.state !== "accepted" || lock.state !== "accepted" || lock.activeAttemptId !== attemptId ||
      !authorityMatches || Number(attempt.snapshotVersion) !== 1 ||
      lock.snapshotHash !== attempt.snapshotHash || !attempt.providerLetterId) return false;
    const effectsRef = firestoreDb.collection("business_outbox_v1").doc(stableId(`dispatch-accepted-effects:${String(attempt.orderId)}:${String(attempt.snapshotVersion)}`));
    const effectsSnap = await tx.get(effectsRef);
    let paymentOutboxRef: FirebaseFirestore.DocumentReference | null = null;
    let paymentOutbox: Record<string, unknown> | null = null;
    if ("paymentFactId" in authority) {
      paymentOutboxRef = firestoreDb.collection("business_outbox_v1").doc(stableId(`payment-obligation:${String(attempt.orderId)}`));
      const paymentOutboxSnap = await tx.get(paymentOutboxRef);
      paymentOutbox = paymentOutboxSnap.exists ? paymentOutboxSnap.data() as Record<string, unknown> : null;
      if (paymentOutbox && (paymentOutbox.kind !== "payment_obligation" || paymentOutbox.orderId !== attempt.orderId || paymentOutbox.paymentFactId !== authority.paymentFactId)) return false;
    }
    const now = new Date().toISOString();
    if (paymentOutboxRef && (!paymentOutbox || paymentOutbox.status !== "consumed")) {
      tx.set(paymentOutboxRef, sanitizeFirestoreData({
        ...(paymentOutbox || {}), schemaVersion: 1, outboxId: paymentOutboxRef.id, kind: "payment_obligation",
        orderId: attempt.orderId, paymentFactId: authority.paymentFactId, snapshotHash: attempt.snapshotHash,
        status: "consumed", lastResult: "POSTAL_ACCEPTED", completedAt: now, leaseUntil: null,
        providerLetterId: attempt.providerLetterId, acceptedAttemptId: attemptId, updatedAt: now,
      }));
    }
    if (!effectsSnap.exists) tx.create(effectsRef, sanitizeFirestoreData({
      schemaVersion: 1, kind: "dispatch_accepted_effects", outboxId: effectsRef.id,
      orderId: attempt.orderId, environment: attempt.environment, snapshotVersion: attempt.snapshotVersion,
      attemptId,
      ...( "paymentFactId" in authority ? { paymentFactId: authority.paymentFactId } : { freeAuthorizationFactId: authority.freeAuthorizationFactId }),
      paymentIntentId: orderSnap.data()?.stripePaymentId || null,
      isTest: orderSnap.data()?.isTest === true || orderSnap.data()?.paymentMode !== "live",
      providerLetterId: attempt.providerLetterId, status: "attention_required", attentionCode: "LEGACY_ACCEPTED_FOLLOWUP_OUTCOME_UNKNOWN",
      attempts: 0, createdAt: now, updatedAt: now,
    }));
    return true;
  });
}

/**
 * Atomically acquires one lease for a given order snapshot. Expired or uncertain
 * submissions are never reclaimed without an explicit reconciliation result.
 */
export async function claimDispatchAttempt(input: {
  authority: AttemptAuthority;
  actorId: string;
  requestId: string;
  evidenceRef: string;
  nowMs?: number;
  reconciliationConfirmedNoAcceptance?: boolean;
}): Promise<ClaimAttemptResult> {
  const { authority } = input;
  if (Boolean(authority.paymentFactId) === Boolean(authority.freeAuthorizationFactId)) throw new Error("EXACTLY_ONE_AUTHORITY_REQUIRED");
  if (authority.lobMode === "unconfigured") throw new Error("LOB_MODE_UNCONFIGURED");
  const now = input.nowMs ?? Date.now();
  const lockKey = lockId(authority.environment, authority.lobMode, authority.orderId, authority.snapshotVersion);
  const lockRef = firestoreDb.collection(LOCKS).doc(lockKey);

  return firestoreDb.runTransaction(async (tx: any) => {
    const existingSnap = await tx.get(lockRef);
    const existing = existingSnap.exists ? existingSnap.data() as Record<string, unknown> : null;
    if (existing && existing.snapshotHash !== authority.snapshotHash) return { claimed: false as const, reason: "snapshot_conflict" as const };
    if (existing?.state === "accepted") return { claimed: false as const, reason: "already_accepted" as const };
    if (existing?.state === "uncertain" && !input.reconciliationConfirmedNoAcceptance) return { claimed: false as const, reason: "reconcile_uncertain" as const };
    if (existing?.state === "submitting") {
      const expires = typeof existing.leaseExpiresAt === "string" ? Date.parse(existing.leaseExpiresAt) : 0;
      if (expires > now) return { claimed: false as const, reason: "active_lease" as const };
      if (!input.reconciliationConfirmedNoAcceptance) return { claimed: false as const, reason: "reconcile_uncertain" as const };
    }

    const attemptNumber = Number(existing?.attemptCount || 0) + 1;
    const attemptId = sha(`${lockKey}:${attemptNumber}`);
    const attempt = DispatchAttemptSchema.parse({
      schemaVersion: 1, product: authority.product, environment: authority.environment,
      attemptId, orderId: authority.orderId, attemptNumber,
      ...(authority.paymentFactId ? { paymentFactId: authority.paymentFactId } : {}),
      ...(authority.freeAuthorizationFactId ? { freeAuthorizationFactId: authority.freeAuthorizationFactId } : {}),
      snapshotHash: authority.snapshotHash, snapshotVersion: authority.snapshotVersion, tier: authority.tier,
      currency: authority.currency, payableAmountMinor: authority.payableAmountMinor,
      lobMode: authority.lobMode, cassMode: authority.cassMode,
      idempotencyKey: `docketstamp_order_${authority.orderId}`,
      state: "submitting", startedAt: iso(now), updatedAt: iso(now), leaseExpiresAt: iso(now + LEASE_MS),
      actorId: input.actorId, requestId: input.requestId, evidenceRef: input.evidenceRef,
    });
    const attemptRef = firestoreDb.collection(ATTEMPTS).doc(attemptId);
    tx.set(attemptRef, sanitizeFirestoreData(attempt));
    tx.set(lockRef, sanitizeFirestoreData({
      schemaVersion: 1, product: authority.product, environment: authority.environment,
      orderId: authority.orderId, snapshotHash: authority.snapshotHash, snapshotVersion: authority.snapshotVersion,
      attemptCount: attemptNumber, activeAttemptId: attemptId, idempotencyKey: attempt.idempotencyKey,
      state: "submitting", leaseExpiresAt: attempt.leaseExpiresAt, updatedAt: iso(now),
    }));
    return { claimed: true as const, attempt, duplicateRequest: Boolean(existing) };
  });
}

export async function finishDispatchAttempt(input: {
  attemptId: string;
  state: "accepted" | "uncertain" | "failed" | "simulated";
  providerLetterId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  expectedDeliveryDate?: string;
  providerErrorCode?: string;
  nowMs?: number;
}): Promise<void> {
  const attemptRef = firestoreDb.collection(ATTEMPTS).doc(input.attemptId);
  const now = iso(input.nowMs ?? Date.now());
  await firestoreDb.runTransaction(async (tx: any) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new Error("ATTEMPT_NOT_FOUND");
    const attempt = attemptSnap.data() as Record<string, unknown>;
    const lockRef = firestoreDb.collection(LOCKS).doc(lockId(String(attempt.environment), String(attempt.lobMode), String(attempt.orderId), Number(attempt.snapshotVersion)));
    const lockSnap = await tx.get(lockRef);
    if (!lockSnap.exists) throw new Error("DISPATCH_LOCK_NOT_FOUND");
    const lock = lockSnap.data() as Record<string, unknown>;
    if (lock.activeAttemptId !== input.attemptId) throw new Error("STALE_DISPATCH_ATTEMPT");
    if (attempt.state !== "submitting") throw new Error("ATTEMPT_NOT_SUBMITTING");
    if (input.state === "accepted" && !input.providerLetterId) throw new Error("PROVIDER_LETTER_ID_REQUIRED");
    const orderRef = firestoreDb.collection("orders").doc(String(attempt.orderId));
    const orderSnap = await tx.get(orderRef);
    const paymentFactRef = typeof attempt.paymentFactId === "string"
      ? firestoreDb.collection("payment_facts_v1").doc(attempt.paymentFactId)
      : null;
    const paymentFactSnap = paymentFactRef ? await tx.get(paymentFactRef) : null;
    const paymentOutboxRef = attempt.paymentFactId
      ? firestoreDb.collection("business_outbox_v1").doc(stableId(`payment-obligation:${String(attempt.orderId)}`))
      : null;
    const paymentOutboxSnap = paymentOutboxRef ? await tx.get(paymentOutboxRef) : null;
    const acceptedEffectsRef = input.state === "accepted"
      ? firestoreDb.collection("business_outbox_v1").doc(stableId(`dispatch-accepted-effects:${String(attempt.orderId)}:${String(attempt.snapshotVersion)}`))
      : null;
    const acceptedEffectsSnap = acceptedEffectsRef ? await tx.get(acceptedEffectsRef) : null;
    const order = orderSnap?.exists ? orderSnap.data() as Record<string, unknown> : {};
    const paymentFact = paymentFactSnap?.exists ? paymentFactSnap.data() as Record<string, unknown> : undefined;
    const classification = classificationForOrder(order, paymentFact);
    const postalState = input.state === "accepted" ? "accepted_by_lob" : input.state === "uncertain" ? "uncertain" : input.state === "failed" ? "failed" : undefined;
    if (postalState) {
      const fact = PostalFactSchema.parse({
        schemaVersion: 1, product: "docketstamp", environment: attempt.environment,
        factId: stableId(`dispatch-postal:${String(attempt.environment)}:${String(attempt.attemptId)}:${postalState}`),
        orderId: attempt.orderId,
        ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
        providerAccountId: process.env.LOB_ACCOUNT_ID || "lob_default",
        lobMode: attempt.lobMode,
        cassMode: attempt.cassMode,
        state: postalState,
        providerState: input.state,
        occurredAt: now, receivedAt: now,
        snapshotHash: attempt.snapshotHash,
        idempotencyKey: attempt.idempotencyKey,
        evidenceRef: `dispatch_attempts_v1/${String(attempt.attemptId)}`,
        artifactKind: "none",
      });
      tx.create(firestoreDb.collection("postal_facts_v1").doc(fact.factId), sanitizeFirestoreData(fact));
      appendServerBusinessEvent(tx, {
        eventId: `fulfillment_${input.state}:${String(attempt.attemptId)}`,
        eventName: input.state === "accepted" ? "fulfillment_accepted" : input.state === "uncertain" ? "fulfillment_uncertain" : "fulfillment_failed",
        environment: attempt.environment as "local" | "staging" | "production",
        occurredAt: now,
        sessionId: typeof order.sessionId === "string" ? order.sessionId : typeof order.telemetrySessionId === "string" ? order.telemetrySessionId : undefined,
        journeyId: typeof order.telemetryJourneyId === "string" ? order.telemetryJourneyId : undefined,
        checkoutAttemptId: typeof order.checkoutAttemptId === "string" ? order.checkoutAttemptId : undefined,
        orderId: String(attempt.orderId),
        noticeId: typeof order.noticeId === "string" ? order.noticeId : undefined,
        tier: attempt.tier as "first_class" | "certified" | "certified_return_receipt",
        entrySurface: typeof order.entrySource === "string" ? order.entrySource : undefined,
        experienceVersion: typeof order.experienceVersion === "string" ? order.experienceVersion : undefined,
        classification,
        classificationEvidenceRef: paymentFact ? `payment_facts_v1/${String(attempt.paymentFactId)}` : `orders/${String(attempt.orderId)}`,
        safeProperties: { result: input.state, mode: String(attempt.lobMode) },
      });
    }
    tx.update(attemptRef, sanitizeFirestoreData({
      state: input.state, updatedAt: now, ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
      ...(input.providerErrorCode ? { providerErrorCode: input.providerErrorCode } : {}),
      leaseExpiresAt: null,
    }));
    tx.update(lockRef, sanitizeFirestoreData({ state: input.state, updatedAt: now, leaseExpiresAt: null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}) }));
    if (orderSnap.exists && input.state === "accepted" && input.providerLetterId) {
      tx.update(orderRef, sanitizeFirestoreData({
        status: "PROCESSING_DISPATCH", lobLetterId: input.providerLetterId,
        postalProvider: "lob", postalProviderReference: input.providerLetterId,
        fulfillmentError: null, updatedAt: now,
      }));
      if (attempt.paymentFactId && paymentOutboxRef) {
        const paymentOutbox = paymentOutboxSnap?.exists ? paymentOutboxSnap.data() as Record<string, unknown> : null;
        if (paymentOutbox && paymentOutbox.orderId === attempt.orderId && paymentOutbox.paymentFactId === attempt.paymentFactId) {
          if (paymentOutbox.status !== "consumed") tx.update(paymentOutboxRef, {
            status: "consumed", lastResult: "POSTAL_ACCEPTED", completedAt: now, leaseUntil: null,
            providerLetterId: input.providerLetterId, acceptedAttemptId: input.attemptId, updatedAt: now,
          });
        } else if (!paymentOutboxSnap?.exists) {
          const attention = {
            schemaVersion: 1, outboxId: stableId(`payment-obligation:${String(attempt.orderId)}`),
            kind: "payment_obligation", orderId: attempt.orderId, paymentFactId: attempt.paymentFactId,
            snapshotHash: attempt.snapshotHash, status: "attention_required", attentionCode: "ACCEPTED_POSTAL_OUTBOX_BINDING_MISMATCH",
            providerLetterId: input.providerLetterId, acceptedAttemptId: input.attemptId, createdAt: now, updatedAt: now,
          };
          tx.set(paymentOutboxRef, sanitizeFirestoreData(attention));
        }
      }
      if (acceptedEffectsRef && !acceptedEffectsSnap?.exists) {
        tx.create(acceptedEffectsRef, sanitizeFirestoreData({
          schemaVersion: 1, kind: "dispatch_accepted_effects", outboxId: acceptedEffectsRef.id,
          orderId: attempt.orderId, environment: attempt.environment, snapshotVersion: attempt.snapshotVersion,
          attemptId: input.attemptId, ...(attempt.paymentFactId ? { paymentFactId: attempt.paymentFactId } : {}),
          ...(attempt.freeAuthorizationFactId ? { freeAuthorizationFactId: attempt.freeAuthorizationFactId } : {}),
          paymentIntentId: orderSnap.data()?.stripePaymentId || null,
          isTest: orderSnap.data()?.isTest === true || orderSnap.data()?.paymentMode !== "live",
          providerLetterId: input.providerLetterId,
          ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
          ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}),
          ...(input.expectedDeliveryDate ? { expectedDeliveryDate: input.expectedDeliveryDate } : {}),
          status: "pending", attempts: 0, createdAt: now, updatedAt: now,
        }));
      }
    } else if (orderSnap.exists && (input.state === "uncertain" || input.state === "simulated")) {
      tx.update(orderRef, sanitizeFirestoreData({
        status: "QUEUED_FOR_FULFILLMENT",
        fulfillmentError: input.state === "uncertain"
          ? "Postal result is uncertain and requires reconciliation."
          : "Postal dispatch was simulated; no USPS mailing was created.",
        updatedAt: now,
      }));
    }
  });
}

export async function recordDispatchReconciliation(input: {
  environment: "local" | "staging" | "production";
  lobMode: "live" | "test_api" | "mock";
  orderId: string;
  snapshotVersion: number;
  resolution: "accepted" | "not_accepted";
  evidenceRef: string;
  providerLetterId?: string;
  nowMs?: number;
}): Promise<void> {
  const ref = firestoreDb.collection(LOCKS).doc(lockId(input.environment, input.lobMode, input.orderId, input.snapshotVersion));
  const now = iso(input.nowMs ?? Date.now());
  await firestoreDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("DISPATCH_LOCK_NOT_FOUND");
    const lock = snap.data() as Record<string, unknown>;
    if (lock.state === "submitting" && typeof lock.leaseExpiresAt === "string" && Date.parse(lock.leaseExpiresAt) > (input.nowMs ?? Date.now())) {
      throw new Error("DISPATCH_LEASE_ACTIVE");
    }
    if (!(["uncertain", "submitting"].includes(String(lock.state)))) throw new Error("RECONCILIATION_NOT_REQUIRED");
    if (input.resolution === "accepted" && !input.providerLetterId) throw new Error("PROVIDER_LETTER_ID_REQUIRED");
    const state = input.resolution === "accepted" ? "accepted" : "failed";
    const attemptId = String(lock.activeAttemptId || "");
    const attemptRef = firestoreDb.collection(ATTEMPTS).doc(attemptId);
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new Error("ATTEMPT_NOT_FOUND");
    const attempt = attemptSnap.data() as Record<string, unknown>;
    const orderRef = firestoreDb.collection("orders").doc(input.orderId);
    const orderSnap = await tx.get(orderRef);
    const paymentFactRef = typeof attempt.paymentFactId === "string"
      ? firestoreDb.collection("payment_facts_v1").doc(String(attempt.paymentFactId))
      : null;
    const paymentFactSnap = paymentFactRef ? await tx.get(paymentFactRef) : null;
    const reconciliationState = input.resolution === "accepted" ? "accepted_by_lob" : "failed";
    const reconciliationId = stableId(`postal-reconciliation:${input.environment}:${input.orderId}:${attemptId}:${input.resolution}`);
    const postalFactRef = firestoreDb.collection("postal_facts_v1").doc(reconciliationId);
    const postalFactSnap = await tx.get(postalFactRef);
    const reconciliationEventId = `fulfillment_reconciled_${input.resolution}:${attemptId}`;
    const businessEventRef = firestoreDb.collection("business_events_v1").doc(reconciliationEventId);
    const businessEventSnap = await tx.get(businessEventRef);
    const order = orderSnap.exists ? orderSnap.data() as Record<string, unknown> : {};
    const paymentFact = paymentFactSnap?.exists ? paymentFactSnap.data() as Record<string, unknown> : undefined;
    const classification = classificationForOrder(order, paymentFact);
    const providerEventId = stableId(`reconciliation:${input.environment}:${input.orderId}:${attemptId}:${input.resolution}`);
    if (!postalFactSnap.exists) {
      const postalFact = PostalFactSchema.parse({
        schemaVersion: 1, product: "docketstamp", environment: input.environment,
        factId: reconciliationId, orderId: input.orderId,
        ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
        providerEventId, providerAccountId: process.env.LOB_ACCOUNT_ID || "lob_default",
        lobMode: input.lobMode,
        cassMode: attempt.cassMode === "live" || attempt.cassMode === "staging_mock_cass" ? attempt.cassMode : "unknown",
        state: reconciliationState,
        providerState: input.resolution === "accepted" ? "reconciled_accepted" : "reconciled_not_accepted",
        occurredAt: now, receivedAt: now, snapshotHash: String(attempt.snapshotHash),
        idempotencyKey: String(attempt.idempotencyKey), evidenceRef: input.evidenceRef, artifactKind: "none",
      });
      tx.create(postalFactRef, sanitizeFirestoreData(postalFact));
    }
    if (!businessEventSnap.exists) {
      appendServerBusinessEvent(tx, {
        eventId: reconciliationEventId,
        eventName: input.resolution === "accepted" ? "fulfillment_accepted" : "fulfillment_failed",
        environment: input.environment, occurredAt: now,
        sessionId: typeof order.sessionId === "string" ? order.sessionId : typeof order.telemetrySessionId === "string" ? order.telemetrySessionId : undefined,
        journeyId: typeof order.telemetryJourneyId === "string" ? order.telemetryJourneyId : undefined,
        checkoutAttemptId: typeof order.checkoutAttemptId === "string" ? order.checkoutAttemptId : undefined,
        orderId: input.orderId,
        noticeId: typeof order.noticeId === "string" ? order.noticeId : undefined,
        tier: attempt.tier as "first_class" | "certified" | "certified_return_receipt",
        entrySurface: typeof order.entrySource === "string" ? order.entrySource : undefined,
        experienceVersion: typeof order.experienceVersion === "string" ? order.experienceVersion : undefined,
        classification,
        classificationEvidenceRef: paymentFact ? `payment_facts_v1/${String(attempt.paymentFactId)}` : `orders/${input.orderId}`,
        safeProperties: { result: input.resolution === "accepted" ? "accepted" : "failed", mode: input.lobMode, reasonCode: "provider_reconciliation" },
      });
    }
    tx.update(attemptRef, sanitizeFirestoreData({ state, updatedAt: now, leaseExpiresAt: null,
      providerErrorCode: input.resolution === "not_accepted" ? "RECONCILED_NOT_ACCEPTED" : null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
      reconciliationEvidenceRef: input.evidenceRef }));
    tx.update(ref, sanitizeFirestoreData({ state, updatedAt: now, leaseExpiresAt: null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}), reconciliationEvidenceRef: input.evidenceRef }));
    if (orderSnap.exists && input.resolution === "accepted" && input.providerLetterId) {
      tx.update(orderRef, sanitizeFirestoreData({
        status: "PROCESSING_DISPATCH", lobLetterId: input.providerLetterId,
        postalProvider: "lob", postalProviderReference: input.providerLetterId,
        fulfillmentError: null, updatedAt: now,
      }));
    } else if (orderSnap.exists) {
      tx.update(orderRef, sanitizeFirestoreData({
        status: "QUEUED_FOR_FULFILLMENT", fulfillmentError: null, updatedAt: now,
      }));
    }
  });
  if (input.resolution === "accepted") {
    const lockSnap = await ref.get();
    const attemptId = String(lockSnap.data()?.activeAttemptId || "");
    const attemptSnap = await firestoreDb.collection(ATTEMPTS).doc(attemptId).get();
    const paymentFactId = attemptSnap.exists ? (attemptSnap.data() as Record<string, unknown>).paymentFactId : undefined;
    const freeAuthorizationFactId = attemptSnap.exists ? (attemptSnap.data() as Record<string, unknown>).freeAuthorizationFactId : undefined;
    if (typeof paymentFactId === "string") await reconcileAcceptedDispatchOutboxes(attemptId, { paymentFactId });
    else if (typeof freeAuthorizationFactId === "string") await reconcileAcceptedDispatchOutboxes(attemptId, { freeAuthorizationFactId });
  }
}
