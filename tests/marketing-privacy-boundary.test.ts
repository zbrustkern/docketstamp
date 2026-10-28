import assert from 'node:assert/strict';
import { test } from 'node:test';
import { genericMetaEvent, isPublicMarketingSurface } from '../lib/marketing-privacy';
import { trackEvent } from '../lib/telemetry';
import { trackMetaViewContent, trackMetaSearch, setMetaUserData } from '../lib/meta-ads';
import { trackGA4AddShippingInfo, trackGA4CustomEvent, trackGA4Purchase, trackGA4ViewItem, trackGoogleAdsPurchase } from '../lib/google-ads';

test('only public acquisition routes with bounded marketing-only URLs permit vendors', () => {
  assert.equal(isPublicMarketingSurface('/'), true);
  assert.equal(isPublicMarketingSurface('/', '?utm_source=google&gclid=abc_123'), true);
  for (const path of ['/notices/debt-validation', '/docket/DS-2026-ABC123', '/account', '/admin', '/api/docket/stage']) {
    assert.equal(isPublicMarketingSurface(path), false);
  }
  for (const search of ['?field.senderFullName=Alice', '?stage=DS-STAGE-secret', '?token=secret', '?utm_campaign=alice%40example.com', '?utm_source=raw+personal+words']) {
    assert.equal(isPublicMarketingSurface('/', search), false);
  }
});

test('actual Google wrappers require consent and public URL and emit only generic allowlisted fields', () => {
  const keys = ['window', 'navigator', 'sessionStorage', 'localStorage'] as const;
  const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const envKeys = ['NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED', 'NEXT_PUBLIC_LOCAL_GOOGLE_ADS_ID', 'NEXT_PUBLIC_LOCAL_GOOGLE_ADS_CONVERSION_LABEL', 'NEXT_PUBLIC_LOCAL_GA4_MEASUREMENT_ID'] as const;
  const envBefore = new Map(envKeys.map(key => [key, process.env[key]]));
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  const calls: unknown[][] = [];
  const location = { pathname: '/', search: '' };
  const navigator = { globalPrivacyControl: false };
  try {
    process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED = 'true';
    process.env.NEXT_PUBLIC_LOCAL_GOOGLE_ADS_ID = 'AW-123456789';
    process.env.NEXT_PUBLIC_LOCAL_GOOGLE_ADS_CONVERSION_LABEL = 'safe_label';
    process.env.NEXT_PUBLIC_LOCAL_GA4_MEASUREMENT_ID = 'G-ABC123';
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, localStorage: storage, gtag: (...args: unknown[]) => calls.push(args) } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

    trackGA4ViewItem({ itemId: 'private', itemName: 'private' });
    assert.equal(calls.length, 0, 'unknown consent blocks all direct Google wrappers');
    values.set('docketstamp_marketing_consent_v1', 'granted');
    trackGA4ViewItem({ itemId: 'order_PRIVATE_123', itemName: 'Debt Validation Letter Alice', itemCategory: 'template-secret', price: 19.95 });
    trackGA4AddShippingInfo({ itemId: 'docket-id-private', itemName: 'Alice', itemCategory: 'private', shippingTier: 'certified' });
    trackGA4CustomEvent('private_customer_event', { orderId: 'order_PRIVATE_123', email: 'alice@example.com' });
    trackGA4CustomEvent('mailing_progress', { step_number: 3, orderId: 'order_PRIVATE_123', noticeSlug: 'debt-validation', email: 'alice@example.com' });
    trackGA4Purchase({ orderId: 'order_PRIVATE_123', amountInCents: 1995, itemName: 'Alice debt notice', itemCategory: 'private-template' });
    trackGoogleAdsPurchase({ orderId: 'order_PRIVATE_123', amountInCents: 1995, customerEmail: 'alice@example.com', itemName: 'Alice debt notice', itemCategory: 'private-template' });

    const beforeBlocked = calls.length;
    location.pathname = '/order/order_PRIVATE_123';
    trackGA4Purchase({ orderId: 'order_PRIVATE_123', amountInCents: 1995 });
    trackGoogleAdsPurchase({ orderId: 'order_PRIVATE_123', amountInCents: 1995 });
    location.pathname = '/';
    location.search = '?field.senderFullName=Alice';
    trackGA4ViewItem({ itemId: 'secret', itemName: 'secret' });
    assert.equal(calls.length, beforeBlocked, 'sensitive paths and query strings block every direct Google wrapper');

    location.search = '';
    navigator.globalPrivacyControl = true;
    trackGA4ViewItem({ itemId: 'secret', itemName: 'secret' });
    assert.equal(calls.length, beforeBlocked, 'GPC blocks Google wrapper calls despite stored consent');
    assert.equal(JSON.stringify(calls).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(calls).includes('Alice'), false);
    assert.equal(JSON.stringify(calls).includes('debt-validation'), false);
    assert.equal(JSON.stringify(calls).includes('email'), false);
    assert.equal(calls.some(call => call[1] === 'private_customer_event'), false);
    assert.ok(calls.some(call => call[1] === 'conversion'));
    assert.ok(calls.some(call => call[1] === 'purchase'));
  } finally {
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    for (const [key, value] of envBefore) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('Meta output strips template, search, personal values and internal correlation identifiers', () => {
  const privateData = { content_name: 'Alice debt dispute', content_ids: ['account_123'], search_string: 'Alice', value: 19.95, currency: 'EUR' };
  assert.deepEqual(genericMetaEvent(['track', 'ViewContent', privateData, { eventID: 'order_private' }]), ['track', 'ViewContent', { content_name: 'DocketStamp mailing', content_category: 'mailing' }]);
  assert.equal(genericMetaEvent(['setUserProperties', { email: 'alice@example.com' }]), null);
  assert.equal(genericMetaEvent(['trackCustom', 'Alice-debt', privateData]), null);
});

test('actual legacy tracking bridge requires consent and never forwards arbitrary metadata', async () => {
  const keys = ['window', 'navigator', 'document', 'sessionStorage', 'localStorage'] as const;
  const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const envBefore = { verified: process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED, pixel: process.env.NEXT_PUBLIC_LOCAL_META_PIXEL_ID };
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  const google: unknown[][] = [], meta: unknown[][] = [];
  const location = { pathname: '/', search: '' };
  const navigator = { globalPrivacyControl: false, sendBeacon: () => true, userAgent: 'offline-test' };
  try {
    process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED = 'true';
    process.env.NEXT_PUBLIC_LOCAL_META_PIXEL_ID = '123456789012345';
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, localStorage: storage, sessionStorage: storage, gtag: (...args: unknown[]) => google.push(args), fbq: (...args: unknown[]) => meta.push(args) } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '', referrer: '' } });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    await trackEvent('landing_view', 1, { search: 'Alice debt', token: 'private' }, 'order_private');
    assert.equal(google.length, 0, 'unknown consent blocks the legacy bridge');
    values.set('docketstamp_marketing_consent_v1', 'granted');
    await trackEvent('landing_view', 1, { search: 'Alice debt', token: 'private' }, 'order_private');
    assert.equal(google.length, 1);
    assert.equal(JSON.stringify(google).includes('private'), false);
    assert.equal(JSON.stringify(google).includes('Alice'), false);
    trackMetaViewContent({ contentName: 'Alice debt dispute', contentId: 'order_private' });
    trackMetaSearch({ searchString: 'Alice personal claim' });
    setMetaUserData({ email: 'alice@example.com' });
    assert.equal(meta.length, 2);
    assert.equal(JSON.stringify(meta).includes('Alice'), false);
    assert.equal(JSON.stringify(meta).includes('order_private'), false);
    location.pathname = '/notices/fdcpa-30-day-debt-validation-letter';
    await trackEvent('landing_view', 2, { search: 'private' });
    trackMetaSearch({ searchString: 'private' });
    assert.equal(google.length, 1);
    assert.equal(meta.length, 2);
    location.pathname = '/';
    navigator.globalPrivacyControl = true;
    await trackEvent('landing_view', 3);
    assert.equal(google.length, 1, 'GPC blocks a stored consent grant');
  } finally {
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    if (envBefore.verified === undefined) delete process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED; else process.env.NEXT_PUBLIC_LOCAL_MARKETING_DESTINATIONS_VERIFIED = envBefore.verified;
    if (envBefore.pixel === undefined) delete process.env.NEXT_PUBLIC_LOCAL_META_PIXEL_ID; else process.env.NEXT_PUBLIC_LOCAL_META_PIXEL_ID = envBefore.pixel;
  }
});
