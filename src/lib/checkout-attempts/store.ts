import crypto from 'node:crypto';
import { firestoreDb } from '@/lib/firebase-admin';
import type { CheckoutAttemptState } from './contract';
import type { PaymentMode } from '@/lib/payment-mode';

export interface CheckoutAttempt {
  attemptId: string;
  orderId: string;
  ownerUid?: string;
  capabilityDigest: string;
  draftId: string;
  draftRevision: number;
  requestKeyDigest: string;
  payloadDigest: string;
  snapshotHash: string;
  quoteVersion: string;
  pricingVersion: string;
  amountInCents: number;
  currency: 'usd';
  paymentMode?: PaymentMode;
  tier: string;
  policyRevision?: number;
  templateContentDigest?: string;
  policyNexus?: { consumerResidenceState?: string; propertyState?: string };
  state: CheckoutAttemptState;
  paymentIntentId?: string;
  clientSecret?: string;
  supersededBy?: string;
  createdAt: number;
  updatedAt: number;
}

export type AttemptReservation =
  | { kind: 'created'; attempt: CheckoutAttempt }
  | { kind: 'replay'; attempt: CheckoutAttempt }
  | { kind: 'conflict' }
  | { kind: 'active_attempt'; attempt: CheckoutAttempt };

const attempts = () => firestoreDb.collection('checkout_attempts_v1');
const idempotency = () => firestoreDb.collection('checkout_idempotency_v1');
const drafts = () => firestoreDb.collection('checkout_drafts_v1');

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createCapability(): string {
  return `cc_${crypto.randomBytes(32).toString('base64url')}`;
}

export function createAttemptId(): string {
  return `ca_${crypto.randomBytes(16).toString('hex')}`;
}

export async function reserveAttempt(input: Omit<CheckoutAttempt, 'state' | 'createdAt' | 'updatedAt'> & {
  scopeId: string;
}): Promise<AttemptReservation> {
  const now = Date.now();
  const idemRef = idempotency().doc(sha256(`${input.scopeId}:${input.requestKeyDigest}`));
  // Draft lifecycle is anchored to its high-entropy capability across sign-in
  // changes, while idempotency remains bound to the verified owner scope.
  const draftRef = drafts().doc(sha256(`${input.capabilityDigest}:${input.draftId}`));
  const attemptRef = attempts().doc(input.attemptId);
  return firestoreDb.runTransaction(async (tx: any) => {
    const [idemSnap, draftSnap] = await Promise.all([tx.get(idemRef), tx.get(draftRef)]);
    if (idemSnap.exists) {
      const prior = idemSnap.data() as { payloadDigest: string; attemptId: string };
      if (prior.payloadDigest !== input.payloadDigest) return { kind: 'conflict' as const };
      const priorAttempt = await tx.get(attempts().doc(prior.attemptId));
      if (!priorAttempt.exists) throw new Error('CHECKOUT_ATTEMPT_RECORD_MISSING');
      return { kind: 'replay' as const, attempt: priorAttempt.data() as CheckoutAttempt };
    }
    if (draftSnap.exists) {
      const activeId = String(draftSnap.data()?.activeAttemptId || '');
      if (activeId) {
        const activeSnap = await tx.get(attempts().doc(activeId));
        if (activeSnap.exists) {
          const active = activeSnap.data() as CheckoutAttempt;
          if (!['superseded', 'cancelled'].includes(active.state)) return { kind: 'active_attempt' as const, attempt: active };
          tx.update(attempts().doc(activeId), { supersededBy: input.attemptId, updatedAt: now });
        }
      }
    }
    const { scopeId: _scopeId, ownerUid, ...attemptFields } = input;
    const attempt: CheckoutAttempt = {
      ...attemptFields,
      ...(ownerUid ? { ownerUid } : {}),
      state: 'creating',
      createdAt: now,
      updatedAt: now,
    };
    tx.create(attemptRef, attempt);
    tx.create(idemRef, { payloadDigest: input.payloadDigest, attemptId: input.attemptId, createdAt: now });
    tx.set(draftRef, { activeAttemptId: input.attemptId, draftId: input.draftId, updatedAt: now });
    return { kind: 'created' as const, attempt };
  });
}

export async function getAttempt(attemptId: string): Promise<CheckoutAttempt | null> {
  const snap = await attempts().doc(attemptId).get();
  return snap.exists ? snap.data() as CheckoutAttempt : null;
}

export async function updateAttempt(attemptId: string, update: Partial<CheckoutAttempt>): Promise<CheckoutAttempt> {
  const ref = attempts().doc(attemptId);
  return firestoreDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('CHECKOUT_ATTEMPT_NOT_FOUND');
    const current = snap.data() as CheckoutAttempt;
    const orderRef = firestoreDb.collection('orders').doc(current.orderId);
    const orderSnap = await tx.get(orderRef);
    let state = update.state || current.state;
    // Payment facts can arrive during provider cancellation or initialization.
    // Never regress their authority because an older async request completed.
    if (current.state === 'paid' || current.state === 'free_authorized') {
      if (state === 'cancellation_pending') throw new Error('CHECKOUT_ALREADY_PAID');
      state = ['superseded', 'payment_processing', 'outcome_unknown', 'captured_exception'].includes(state)
        ? 'captured_exception'
        : current.state;
    } else if (['captured_exception', 'paid_exception', 'superseded', 'cancelled'].includes(current.state)) {
      state = current.state;
    } else if (state === 'creating' && current.state !== 'creating') {
      state = current.state;
    } else if (state === 'locked' && !['creating', 'locked'].includes(current.state)) {
      state = current.state;
    }
    const next = { ...update, state, updatedAt: Date.now() };
    tx.update(ref, next);
    if (orderSnap.exists) {
      const orderAttemptId = orderSnap.data()?.checkoutAttemptId;
      if (orderAttemptId && orderAttemptId !== attemptId) throw new Error('CHECKOUT_ORDER_BINDING_MISMATCH');
      tx.update(orderRef, orderMirror({ ...current, ...next }));
    }
    return { ...current, ...next } as CheckoutAttempt;
  });
}

export async function setAttemptState(attemptId: string, state: CheckoutAttemptState, extra: Partial<CheckoutAttempt> = {}): Promise<CheckoutAttempt> {
  return updateAttempt(attemptId, { ...extra, state });
}

export async function ownsAttempt(attempt: CheckoutAttempt, ownerUid: string | undefined, capability: string | undefined): Promise<boolean> {
  if (attempt.ownerUid) return !!ownerUid && attempt.ownerUid === ownerUid;
  return !!capability && attempt.capabilityDigest === sha256(capability);
}

export async function updateOrderAttemptState(orderId: string, attempt: CheckoutAttempt): Promise<void> {
  // Compatibility helper: re-read canonical state instead of copying a stale
  // object over a concurrent capture's dispatch gate.
  await firestoreDb.runTransaction(async (tx: any) => {
    const canonical = await tx.get(attempts().doc(attempt.attemptId));
    const orderRef = firestoreDb.collection('orders').doc(orderId);
    const order = await tx.get(orderRef);
    if (!canonical.exists || !order.exists || canonical.data()?.orderId !== orderId) throw new Error('CHECKOUT_ORDER_BINDING_MISMATCH');
    tx.update(orderRef, orderMirror(canonical.data() as CheckoutAttempt));
  });
}

function orderMirror(attempt: CheckoutAttempt) {
  return {
    checkoutAttemptId: attempt.attemptId,
    checkoutAttemptState: attempt.state,
    checkoutAttemptSupersededBy: attempt.supersededBy || null,
    checkoutPaymentIntentId: attempt.paymentIntentId || null,
    updatedAt: Date.now(),
  };
}
