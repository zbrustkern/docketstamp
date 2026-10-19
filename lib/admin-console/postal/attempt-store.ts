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
    tx.update(attemptRef, sanitizeFirestoreData({
      state: input.state, updatedAt: now, ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
      ...(input.providerErrorCode ? { providerErrorCode: input.providerErrorCode } : {}),
      leaseExpiresAt: null,
    }));
    tx.update(lockRef, sanitizeFirestoreData({ state: input.state, updatedAt: now, leaseExpiresAt: null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}) }));
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
    if (!(["uncertain", "submitting"].includes(String(lock.state)))) throw new Error("RECONCILIATION_NOT_REQUIRED");
    if (input.resolution === "accepted" && !input.providerLetterId) throw new Error("PROVIDER_LETTER_ID_REQUIRED");
    const state = input.resolution === "accepted" ? "accepted" : "failed";
    const attemptId = String(lock.activeAttemptId || "");
    const attemptRef = firestoreDb.collection(ATTEMPTS).doc(attemptId);
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new Error("ATTEMPT_NOT_FOUND");
    tx.update(attemptRef, sanitizeFirestoreData({ state, updatedAt: now, leaseExpiresAt: null,
      providerErrorCode: input.resolution === "not_accepted" ? "RECONCILED_NOT_ACCEPTED" : null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}),
      reconciliationEvidenceRef: input.evidenceRef }));
    tx.update(ref, sanitizeFirestoreData({ state, updatedAt: now, leaseExpiresAt: null,
      ...(input.providerLetterId ? { providerLetterId: input.providerLetterId } : {}), reconciliationEvidenceRef: input.evidenceRef }));
  });
}
