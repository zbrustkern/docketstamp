import crypto from "node:crypto";
import { z } from "zod";
import { firestoreDb, sanitizeFirestoreData } from "@/lib/firebase-admin";
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
    const paymentOutboxRef = attempt.paymentFactId
      ? firestoreDb.collection("business_outbox_v1").doc(stableId(`payment-obligation:${String(attempt.orderId)}`))
      : null;
    const paymentOutboxSnap = paymentOutboxRef ? await tx.get(paymentOutboxRef) : null;
    const acceptedEffectsRef = input.state === "accepted"
      ? firestoreDb.collection("business_outbox_v1").doc(stableId(`dispatch-accepted-effects:${String(attempt.orderId)}:${String(attempt.snapshotVersion)}`))
      : null;
    const acceptedEffectsSnap = acceptedEffectsRef ? await tx.get(acceptedEffectsRef) : null;
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
    const orderRef = firestoreDb.collection("orders").doc(input.orderId);
    const orderSnap = await tx.get(orderRef);
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
