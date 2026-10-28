/** Only general acquisition surfaces may load third-party marketing code. */
const PUBLIC_MARKETING_PATHS = new Set(['/', '/pricing', '/how-it-works']);

export function isPublicMarketingSurface(pathname: string, search = ''): boolean {
  if (!PUBLIC_MARKETING_PATHS.has(pathname)) return false;
  const params = new URLSearchParams(search);
  // Preserve old prefills without exposing them to automatic vendor capture.
  const permitted = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']);
  for (const [key, value] of params) {
    if (!permitted.has(key) || value.length > 200 || !/^[A-Za-z0-9_.~-]*$/.test(value)) return false;
  }
  return true;
}

export function isCurrentMarketingSurfacePublic(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  return isPublicMarketingSurface(window.location.pathname, window.location.search);
}

const META_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'CustomizeProduct', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'Search']);

/** Product names, searches, customer matching and internal IDs never leave here. */
export function genericMetaEvent(args: unknown[]): unknown[] | null {
  if (args[0] !== 'track' || typeof args[1] !== 'string' || !META_EVENTS.has(args[1])) return null;
  const input = args[2] && typeof args[2] === 'object' ? args[2] as Record<string, unknown> : {};
  const payload: Record<string, unknown> = {};
  if (args[1] !== 'PageView') {
    payload.content_name = 'DocketStamp mailing';
    payload.content_category = 'mailing';
    if ((input.currency === undefined || input.currency === 'USD') && typeof input.value === 'number' && Number.isFinite(input.value) && input.value > 0) {
      payload.value = input.value;
      payload.currency = 'USD';
    }
  }
  return ['track', args[1], payload];
}

/** Generic progress only; financial authority remains server-side. */
export function genericGoogleProgress(step?: number): Record<string, unknown> {
  return {
    event_category: 'mailing_progress',
    ...(Number.isInteger(step) && step! >= 1 && step! <= 8 ? { step_number: step } : {}),
    page_location: 'https://docketstamp.com/',
    page_referrer: '',
    page_title: 'DocketStamp',
  };
}
