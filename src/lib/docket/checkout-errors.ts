/** Stable, customer-safe messages for checkout failures. Provider text must stay server-side. */
export type CheckoutErrorCode =
  | 'CHECKOUT_VALIDATION'
  | 'ORDER_PERSISTENCE'
  | 'PAYMENT_INITIALIZATION'
  | 'CHECKOUT_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_FORM_UNAVAILABLE'
  | 'PAYMENT_CONFIRMATION';

const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  CHECKOUT_VALIDATION:
    'We couldn’t prepare checkout. Please review your letter details and try again.',
  ORDER_PERSISTENCE:
    'We couldn’t save your checkout securely. Nothing was charged. Please try again.',
  PAYMENT_INITIALIZATION:
    'We couldn’t prepare secure payment. Nothing was charged. Please try again in a moment.',
  CHECKOUT_UNAVAILABLE:
    'We couldn’t prepare secure payment. Nothing was charged. Your delivery choice and email are saved. Please try again.',
  PAYMENT_DECLINED:
    'Your payment couldn’t be completed. Check your payment details or try another payment method.',
  PAYMENT_FORM_UNAVAILABLE:
    'Secure payment fields couldn’t load. Go back to delivery options and continue to payment to try again.',
  PAYMENT_CONFIRMATION:
    'We couldn’t confirm the order. Please try again. If your bank shows a charge, contact support before retrying.',
};

export function checkoutErrorMessage(code: unknown, fallback: CheckoutErrorCode): string {
  if (
    typeof code === 'string' &&
    Object.prototype.hasOwnProperty.call(CHECKOUT_ERROR_MESSAGES, code)
  ) {
    return CHECKOUT_ERROR_MESSAGES[code as CheckoutErrorCode];
  }
  return CHECKOUT_ERROR_MESSAGES[fallback];
}
