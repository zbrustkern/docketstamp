import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutErrorMessage } from '../src/lib/docket/checkout-errors';

test('checkout failure codes map to stable, customer-safe messages', () => {
  assert.equal(
    checkoutErrorMessage('ORDER_PERSISTENCE', 'CHECKOUT_UNAVAILABLE'),
    'We couldn’t save your checkout securely. Nothing was charged. Please try again.'
  );
  assert.equal(
    checkoutErrorMessage('PAYMENT_INITIALIZATION', 'CHECKOUT_UNAVAILABLE'),
    'We couldn’t prepare secure payment. Nothing was charged. Please try again in a moment.'
  );
  assert.equal(
    checkoutErrorMessage('PAYMENT_DECLINED', 'CHECKOUT_UNAVAILABLE'),
    'Your payment couldn’t be completed. Check your payment details or try another payment method.'
  );
});

test('unknown and provider-text codes use the safe fallback without echoing input', () => {
  const providerText = 'PERMISSION_DENIED: private project identifier and Stripe response';
  const message = checkoutErrorMessage(providerText, 'CHECKOUT_UNAVAILABLE');

  assert.equal(
    message,
    'We couldn’t prepare secure payment. Nothing was charged. Your delivery choice and email are saved. Please try again.'
  );
  assert.ok(!message.includes(providerText));
});
