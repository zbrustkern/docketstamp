import { getOrderById } from '@/lib/firebase-admin';
import { getStripeClient } from '@/lib/stripe';
import { resolvePaymentMode } from '@/lib/payment-mode';
import { getAttempt, ownsAttempt, setAttemptState, type CheckoutAttempt } from './store';
import type { CheckoutAttemptState } from './contract';

export type StripePaymentOutcome = 'cancelled' | 'captured' | 'processing' | 'unknown' | 'no_payment';

export async function resolveSupersessionPayment(
  attempt: CheckoutAttempt,
  provider?: {
    retrieve: (id: string) => Promise<{ status: string }>;
    cancel: (id: string) => Promise<{ status: string }>;
  },
): Promise<StripePaymentOutcome> {
  if (!attempt.paymentIntentId) return 'no_payment';

  // Payment mode comes from the server-created attempt and its bound order.
  // A prefix on a provider ID is never enough to bypass Stripe verification.
  const order = await getOrderById(attempt.orderId);
  const persistedMode = attempt.paymentMode || order?.paymentMode;
  if (!order || !persistedMode || order.paymentMode !== persistedMode ||
      (attempt.paymentMode && attempt.paymentMode !== order.paymentMode) ||
      order.checkoutPaymentIntentId !== attempt.paymentIntentId || order.stripePaymentId !== attempt.paymentIntentId) {
    return 'unknown';
  }
  let runtimeMode: ReturnType<typeof resolvePaymentMode>;
  try {
    runtimeMode = resolvePaymentMode();
  } catch {
    return 'unknown';
  }
  if (runtimeMode !== persistedMode) return 'unknown';

  if (persistedMode === 'local_mock') {
    // Local mock checkout has no Stripe object. Its only authoritative outcome
    // is the bound Firestore order: pending can be cancelled; any progressed
    // status means confirmation may have raced and must remain blocked.
    return order.status === 'PENDING_PAYMENT' ? 'cancelled' : 'captured';
  }

  const stripeProvider = provider || {
    retrieve: (id: string) => getStripeClient().paymentIntents.retrieve(id),
    cancel: (id: string) => getStripeClient().paymentIntents.cancel(id),
  };
  try {
    const current = await stripeProvider.retrieve(attempt.paymentIntentId);
    if (current.status === 'succeeded') return 'captured';
    if (current.status === 'canceled') return 'cancelled';
    if (current.status === 'processing') return 'processing';
    try {
      const cancelled = await stripeProvider.cancel(attempt.paymentIntentId);
      if (cancelled.status === 'canceled') return 'cancelled';
      if (cancelled.status === 'succeeded') return 'captured';
      if (cancelled.status === 'processing') return 'processing';
      return 'unknown';
    } catch {
      // Cancellation can race capture or be disallowed in some states. Re-read
      // provider truth before deciding whether a replacement checkout is safe.
      const after = await stripeProvider.retrieve(attempt.paymentIntentId);
      if (after.status === 'succeeded') return 'captured';
      if (after.status === 'canceled') return 'cancelled';
      if (after.status === 'processing') return 'processing';
      return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

export async function supersedeAttempt(input: {
  attemptId: string;
  ownerUid?: string;
  capability?: string;
  draftId: string;
  nextRevision: number;
  paymentResolver?: typeof resolveSupersessionPayment;
}): Promise<{ attempt: CheckoutAttempt; outcome: StripePaymentOutcome }> {
  const attempt = await getAttempt(input.attemptId);
  if (!attempt || !(await ownsAttempt(attempt, input.ownerUid, input.capability))) throw new Error('CHECKOUT_ATTEMPT_NOT_FOUND');
  if (attempt.draftId !== input.draftId || !Number.isSafeInteger(input.nextRevision) || input.nextRevision < attempt.draftRevision) {
    throw new Error('CHECKOUT_REVISION_MISMATCH');
  }
  if (['superseded', 'cancelled'].includes(attempt.state)) return { attempt, outcome: 'cancelled' };
  if (['paid', 'free_authorized'].includes(attempt.state)) throw new Error('CHECKOUT_ALREADY_PAID');
  if (['captured_exception', 'paid_exception'].includes(attempt.state)) return { attempt, outcome: 'captured' };
  if (attempt.state === 'creating') throw new Error('CHECKOUT_ATTEMPT_BUSY');

  // Mark before contacting Stripe so a concurrent new lock sees an active,
  // non-replaceable attempt even while cancellation is racing capture.
  let pending = await setAttemptState(attempt.attemptId, 'cancellation_pending');
  if (['superseded', 'cancelled'].includes(pending.state)) return { attempt: pending, outcome: 'cancelled' };
  if (['captured_exception', 'paid_exception'].includes(pending.state)) return { attempt: pending, outcome: 'captured' };
  const resolver = input.paymentResolver || resolveSupersessionPayment;
  const outcome = await resolver(pending);
  const state: CheckoutAttemptState = outcome === 'cancelled' || outcome === 'no_payment'
    ? 'superseded'
    : outcome === 'captured'
      ? 'captured_exception'
      : outcome === 'processing'
        ? 'payment_processing'
        : 'outcome_unknown';
  pending = await setAttemptState(attempt.attemptId, state);
  return { attempt: pending, outcome: ['captured_exception', 'paid_exception'].includes(pending.state) ? 'captured' : outcome };
}
