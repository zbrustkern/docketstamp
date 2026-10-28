export type CheckoutAttemptState =
  | 'creating'
  | 'locked'
  | 'payment_processing'
  | 'paid'
  | 'free_authorized'
  | 'cancellation_pending'
  | 'superseding'
  | 'outcome_unknown'
  | 'captured_exception'
  | 'paid_exception'
  | 'superseded'
  | 'cancelled';

export interface CheckoutAttemptDispatchView {
  orderId: string;
  attemptId?: string;
  state?: CheckoutAttemptState | string;
  supersededBy?: string;
  paymentIntentId?: string;
}

export class CheckoutAttemptDispatchBlockedError extends Error {
  readonly code = 'CHECKOUT_ATTEMPT_NOT_DISPATCHABLE';

  constructor(readonly attemptId: string, readonly state: string, readonly reason: string) {
    super(`Checkout attempt ${attemptId} in state ${state} cannot dispatch: ${reason}`);
    this.name = 'CheckoutAttemptDispatchBlockedError';
  }
}

const BLOCKED_STATES = new Set([
  'creating', 'payment_processing', 'cancellation_pending', 'superseding',
  'outcome_unknown', 'captured_exception', 'paid_exception', 'superseded', 'cancelled',
]);

/**
 * Gate attempt-aware fulfillment while preserving already-committed legacy locks.
 * An absent attempt id/state means this order predates checkout-attempt tracking.
 */
export function assertFulfillmentDispatchAllowed(attempt: CheckoutAttemptDispatchView): void {
  if (!attempt.attemptId && !attempt.state) return;
  const id = attempt.attemptId || attempt.orderId;
  const state = attempt.state || 'unknown';
  if (attempt.supersededBy) {
    throw new CheckoutAttemptDispatchBlockedError(id, state, 'the attempt has been superseded');
  }
  if (BLOCKED_STATES.has(state)) {
    throw new CheckoutAttemptDispatchBlockedError(id, state, 'the payment or supersession outcome needs resolution');
  }
  if (state !== 'paid' && state !== 'free_authorized') {
    throw new CheckoutAttemptDispatchBlockedError(id, state, 'payment authorization is not final');
  }
}
