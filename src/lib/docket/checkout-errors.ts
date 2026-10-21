/** Stable, customer-safe messages for checkout failures. Provider text must stay server-side. */
export type CheckoutErrorCode =
  | 'MAILING_UNAVAILABLE'
  | 'CHECKOUT_VALIDATION'
  | 'ORDER_PERSISTENCE'
  | 'PAYMENT_INITIALIZATION'
  | 'CHECKOUT_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_FORM_UNAVAILABLE'
  | 'PAYMENT_CONFIRMATION'
  | 'TEMPLATE_UNAVAILABLE' | 'TEMPLATE_ON_HOLD' | 'REVIEW_REQUIRED'
  | 'TEMPLATE_NOT_FOUND' | 'LOCATION_REQUIRED' | 'INVALID_LOCATION' | 'LOCATION_UNAVAILABLE';

export function isTemplateAvailabilityError(code: unknown): boolean {
  return typeof code === 'string' && ['TEMPLATE_UNAVAILABLE', 'TEMPLATE_ON_HOLD', 'REVIEW_REQUIRED',
    'TEMPLATE_NOT_FOUND', 'LOCATION_REQUIRED', 'INVALID_LOCATION', 'LOCATION_UNAVAILABLE'].includes(code);
}

const AVAILABILITY_CHANGED = 'This letter is no longer available for a new checkout. Nothing was charged. Close checkout to check current availability.';
const LOCATION_CHANGED = 'Please confirm your location before checkout. Nothing was charged. Close checkout to update your location.';

const CHECKOUT_ERROR_MESSAGES: Record<CheckoutErrorCode, string> = {
  MAILING_UNAVAILABLE: 'Mailing checkout is temporarily unavailable. Nothing was charged. Your letter details are saved.',
  TEMPLATE_UNAVAILABLE: AVAILABILITY_CHANGED,
  TEMPLATE_ON_HOLD: AVAILABILITY_CHANGED,
  REVIEW_REQUIRED: AVAILABILITY_CHANGED,
  TEMPLATE_NOT_FOUND: AVAILABILITY_CHANGED,
  LOCATION_UNAVAILABLE: AVAILABILITY_CHANGED,
  LOCATION_REQUIRED: LOCATION_CHANGED,
  INVALID_LOCATION: LOCATION_CHANGED,
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
