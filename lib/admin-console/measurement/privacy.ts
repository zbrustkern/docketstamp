'use client';

export const MARKETING_CONSENT_STORAGE_KEY = 'docketstamp_marketing_consent_v1';

/** Marketing vendors remain disabled unless the customer has an explicit first-party grant. */
export function hasExplicitMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
    if (window.localStorage.getItem('docketstamp_google_measurement_denied_v1') === '1') return false;
    if (window.localStorage.getItem('docketstamp_google_offline_preference_set_v1') === '1') return false;
    return window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY) === 'granted';
  } catch {
    return false;
  }
}

/** The new Google offline preference never grants browser marketing tag consent. */
export function notifyMarketingConsentChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('docketstamp:marketing-consent-changed'));
}
