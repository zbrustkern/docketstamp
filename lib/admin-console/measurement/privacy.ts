'use client';

export const MARKETING_CONSENT_STORAGE_KEY = 'docketstamp_marketing_consent_v1';

/** Marketing vendors remain disabled unless the customer has an explicit first-party grant. */
export function hasExplicitMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
    return window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY) === 'granted';
  } catch {
    return false;
  }
}
