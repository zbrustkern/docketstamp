import { resolvePaymentMode } from './payment-mode';
import { getLobVerificationApiKey, resolveLobDispatchMode } from '../src/lib/fulfillment/lob';

/** A live payment must have both live address verification and dispatch configured. */
export function isMailingReadyForCheckout(): boolean {
  try {
    const paymentMode = resolvePaymentMode();
    const dispatchMode = resolveLobDispatchMode();
    if (paymentMode === 'live') {
      return dispatchMode === 'live' && getLobVerificationApiKey().trim().startsWith('live_');
    }
    return dispatchMode === 'test_api' || dispatchMode === 'mock';
  } catch {
    return false;
  }
}
