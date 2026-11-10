import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateGoogleConversionEligibility, evaluateSyntheticFixtureEligibility,
} from '@/lib/admin-console/advertising/eligibility';
import { buildGoogleOfflineConversionCsv, eligibleGoogleCsvRow, spreadsheetSafeCell } from '@/lib/admin-console/advertising/manual-csv';
import { APPROVED_GOOGLE_DESTINATIONS } from '@/lib/admin-console/advertising/destination';
import { buildGoogleDataManagerRequest, sendGoogleDataManagerConversion } from '@/lib/admin-console/advertising/google-data-manager';
import { createConsentSessionToken, recordGoogleConversionConsent, getMarketingConsentFromRequest, consentIsCurrentlyGranted } from '@/lib/admin-console/advertising/consent';
import { firestoreDb } from '@/lib/firebase-admin';
import { googleConversionOutboxId, GOOGLE_CONVERSION_OUTBOX, recordGoogleConversionRefundAdjustment } from '@/lib/admin-console/advertising/outbox';
import { createGoogleConversionOutboxInTransaction } from '@/lib/admin-console/advertising/outbox';
import { CLICK_EVIDENCE_MS, clickDigest, PILOT_CAMPAIGN } from '@/lib/acquisition';

const now = Date.parse('2026-11-10T18:00:00.000Z');
const observedAt = new Date(now - 30_000).toISOString();
const expiresAt = new Date(now + CLICK_EVIDENCE_MS - 30_000).toISOString();
const rawClick = { type: 'gclid' as const, value: 'synthetic_GCLID.01', observedAt, expiresAt };
const consent = { status: 'granted' as const, version: 1 as const, grantId: 'consent-grant-1', sessionBinding: 'a'.repeat(64), recordedAt: new Date(now - 60_000).toISOString(), gpc: false };
const destination = {
  key: 'test-only-fixture', accountId: '1234567890', loginAccountId: '1234567890',
  conversionActionId: '999999999', conversionName: 'DocketStamp Paid Order', approved: true as const,
};
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      id: 'order_fixture_1', environment: 'production', paymentMode: 'live', stripePaymentId: 'pi_fixture_1', paymentFactId: 'capture_1', amountInCents: 1295,
      acquisitionV2: {
        schemaVersion: 2 as const, persistence: 'persistent' as const, missingReasons: [], firstObserved: null,
        currentSession: {
          touchId: 'touch_1', sessionId: 'sess_1', observedAt, source: 'google', medium: 'cpc',
          campaignId: PILOT_CAMPAIGN, platformCampaignId: '24457739017', entrySurface: 'notice_workspace',
          evidence: 'click_identifier', issues: [], clicks: [{ type: 'gclid' as const, digest: clickDigest(rawClick.value), expiresAt }],
        },
      },
    },
    paymentFact: {
      product: 'docketstamp', environment: 'production', provider: 'stripe', providerAccountId: 'acct_fixture', providerObjectId: 'pi_fixture_1', factId: 'capture_1', orderId: 'order_fixture_1',
      kind: 'capture', verification: 'verified', providerMode: 'live', amountMinor: 1295, currency: 'USD',
      effectiveAt: new Date(now - 10_000).toISOString(), classification: { primary: 'customer' },
    },
    click: rawClick, consent, now, environment: 'production' as const, destinationApproved: true,
    ...overrides,
  } as any;
}

test('Google eligibility requires a live verified customer capture, timely GCLID and prior server consent', () => {
  assert.equal(evaluateGoogleConversionEligibility(candidate()).eligible, true);
  assert.ok(evaluateGoogleConversionEligibility(candidate({ order: { ...candidate().order, paymentMode: 'stripe_test' } })).reasons.includes('TEST_OR_NONLIVE_PAYMENT'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ paymentFact: { ...candidate().paymentFact, verification: 'pending' } })).reasons.includes('UNVERIFIED_PAYMENT'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ consent: { ...consent, status: 'denied' } })).reasons.includes('CONSENT_REQUIRED'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ consent: { ...consent, recordedAt: new Date(now + 10_000).toISOString() } })).reasons.includes('CONSENT_REQUIRED'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ click: { ...rawClick, type: 'gbraid' } })).reasons.includes('CLICK_TYPE_UNSUPPORTED'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ click: { ...rawClick, expiresAt: new Date(now - 1).toISOString() } })).reasons.includes('CLICK_EXPIRED'));
  assert.ok(evaluateGoogleConversionEligibility(candidate({ destinationApproved: false })).reasons.includes('DESTINATION_UNAPPROVED'));
  const unknownCampaign = candidate();
  unknownCampaign.order.acquisitionV2.currentSession.campaignId = 'unregistered_campaign';
  assert.ok(evaluateGoogleConversionEligibility(unknownCampaign).reasons.includes('CAMPAIGN_UNREGISTERED'));
});

test('synthetic fixtures are permitted only outside production and cannot close the live gate', () => {
  assert.equal(evaluateSyntheticFixtureEligibility({ environment: 'staging', fixture: true, consent: true, clickType: 'gclid', clickExpiresAt: now + 1000, now }).eligible, true);
  assert.ok(evaluateSyntheticFixtureEligibility({ environment: 'production', fixture: true, consent: true, clickType: 'gclid', clickExpiresAt: now + 1000, now }).reasons.includes('FIXTURE_NOT_ALLOWED'));
  assert.ok(evaluateSyntheticFixtureEligibility({ environment: 'staging', fixture: true, consent: false, clickType: 'gclid', clickExpiresAt: now + 1000, now }).reasons.includes('CONSENT_REQUIRED'));
});

test('offline CSV is GCLID-only, transaction deduped and formula safe', () => {
  const result = eligibleGoogleCsvRow(candidate(), destination);
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  const csv = buildGoogleOfflineConversionCsv([result.row]);
  assert.match(csv, /Google Click ID/);
  assert.match(csv, /synthetic_GCLID\.01/);
  assert.match(csv, new RegExp(result.row.transactionId));
  assert.equal(spreadsheetSafeCell('=SUM(A1:A2)'), `"'=SUM(A1:A2)"`);
  assert.throws(() => buildGoogleOfflineConversionCsv([{ ...result.row, gclid: '=1+1' }]), /GOOGLE_CSV_FIELD_INVALID/);
  assert.throws(() => buildGoogleOfflineConversionCsv([{ ...result.row, gclid: '-formula' }]), /GOOGLE_CSV_FIELD_INVALID/);
  assert.throws(() => buildGoogleOfflineConversionCsv([{ ...result.row, conversionName: '@cmd' }]), /GOOGLE_CSV_FIELD_INVALID/);
});

test('Data Manager contract is bounded and adapter cannot transmit without the exact approved gate', async () => {
  const request = buildGoogleDataManagerRequest(destination, {
    gclid: rawClick.value, transactionId: 'f'.repeat(40), eventTimestamp: new Date(now).toISOString(), conversionValue: 12.95, currency: 'USD',
  });
  assert.deepEqual(Object.keys(request).sort(), ['consent', 'destinations', 'encoding', 'events', 'validateOnly']);
  assert.deepEqual(request.events[0].adIdentifiers, { gclid: rawClick.value });
  assert.equal(request.events[0].transactionId, 'f'.repeat(40));
  assert.equal(request.consent.adPersonalization, 'CONSENT_DENIED');
  assert.deepEqual(Object.keys(APPROVED_GOOGLE_DESTINATIONS), []);
  let called = false;
  const previous = process.env.GOOGLE_ADS_OFFLINE_API_ENABLED;
  process.env.GOOGLE_ADS_OFFLINE_API_ENABLED = 'true';
  try {
    const result = await sendGoogleDataManagerConversion({
      destination, conversion: { gclid: rawClick.value, transactionId: 'f'.repeat(40), eventTimestamp: new Date(now).toISOString(), conversionValue: 12.95, currency: 'USD' },
      accessToken: 'fixture-token', fetchImpl: async () => { called = true; return new Response('{}'); },
    });
    assert.equal(result.status, 'disabled');
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ADS_OFFLINE_API_ENABLED;
    else process.env.GOOGLE_ADS_OFFLINE_API_ENABLED = previous;
  }
});

test('consent is signed, server recorded, withdrawable, GPC revokes and expires', async () => {
  const priorKey = process.env.ADMIN_SESSION_SIGNING_KEY;
  process.env.ADMIN_SESSION_SIGNING_KEY = 'test_google_conversion_consent_signing_key_32_chars';
  try {
    const token = createConsentSessionToken();
    const request = (gpc: string | null = null) => ({
      cookies: { get: (name: string) => name === 'docketstamp_gads_consent_session_v1' ? { value: token } : undefined },
      headers: { get: (name: string) => name === 'sec-gpc' ? gpc : null },
    });
    const granted = await recordGoogleConversionConsent({ token, status: 'granted', gpc: false });
    assert.equal((await getMarketingConsentFromRequest(request())).status, 'granted');
    assert.equal(await consentIsCurrentlyGranted(granted.sessionBinding, granted.grantId!), true);
    assert.equal((await getMarketingConsentFromRequest(request('1'))).status, 'denied');
    assert.equal((await getMarketingConsentFromRequest(request())).status, 'denied', 'GPC denial is durable after the signal-bearing request');

    const second = createConsentSessionToken();
    const refused = await recordGoogleConversionConsent({ token: second, status: 'denied', gpc: false });
    const refusedRequest = { cookies: { get: () => ({ value: second }) }, headers: { get: () => null } };
    assert.equal((await getMarketingConsentFromRequest(refusedRequest)).status, 'denied');
    assert.equal(await consentIsCurrentlyGranted(refused.sessionBinding, 'not-a-grant'), false);

    const stale = createConsentSessionToken();
    const oldGrant = await recordGoogleConversionConsent({ token: stale, status: 'granted', gpc: false, now: Date.now() - 31 * 86400000 });
    const staleRequest = { cookies: { get: () => ({ value: stale }) }, headers: { get: () => null } };
    assert.equal((await getMarketingConsentFromRequest(staleRequest)).status, 'unknown');
    assert.equal(await consentIsCurrentlyGranted(oldGrant.sessionBinding, oldGrant.grantId!), false);
    assert.equal((await getMarketingConsentFromRequest({ ...staleRequest, cookies: { get: () => ({ value: `${stale}.tampered` }) } })).status, 'unknown');
  } finally {
    if (priorKey === undefined) delete process.env.ADMIN_SESSION_SIGNING_KEY;
    else process.env.ADMIN_SESSION_SIGNING_KEY = priorKey;
  }
});

test('verified partial and full refunds append value adjustments without a second purchase', async () => {
  const suffix = `refund_${crypto.randomUUID().replace(/-/g, '')}`;
  const orderId = `order_${suffix}`;
  const captureId = `${suffix}_capture`;
  const partialId = `${suffix}_refund_partial`;
  const fullId = `${suffix}_refund_full`;
  const outboxId = googleConversionOutboxId('production', orderId);
  await firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(outboxId).set({
    schemaVersion: 1, environment: 'production', outboxId, orderId, paymentFactId: captureId,
    kind: 'google_offline_conversion', status: 'submitted', deliveryMode: 'api',
    amountMinor: 1295, currency: 'USD', adjustmentVersion: 0,
  });
  const common = { product: 'docketstamp', environment: 'production', orderId, currency: 'USD', providerMode: 'live', verification: 'verified', classification: { primary: 'customer' } };
  await firestoreDb.collection('payment_facts_v1').doc(captureId).set({ ...common, factId: captureId, kind: 'capture', amountMinor: 1295 });
  await firestoreDb.collection('payment_facts_v1').doc(partialId).set({ ...common, factId: partialId, kind: 'refund', amountMinor: 300 });
  const partial = await recordGoogleConversionRefundAdjustment(orderId, 'production');
  assert.equal(partial.recorded, true);
  assert.equal(partial.adjustedAmountMinor, 995);
  await firestoreDb.collection('payment_facts_v1').doc(fullId).set({ ...common, factId: fullId, kind: 'refund', amountMinor: 995 });
  const full = await recordGoogleConversionRefundAdjustment(orderId, 'production');
  assert.equal(full.recorded, true);
  assert.equal(full.adjustedAmountMinor, 0);
  const parent = (await firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(outboxId).get()).data();
  assert.equal(parent?.adjustmentVersion, 2);
  assert.equal(parent?.adjustedAmountMinor, 0);
  const adjustments = await firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).where('parentOutboxId', '==', outboxId).get();
  assert.equal(adjustments.size, 2);
  assert.ok(adjustments.docs.every(row => row.data().kind === 'google_conversion_adjustment' && row.data().status === 'adjustment_pending'));
  assert.match(String(adjustments.docs.find(row => row.data().adjustedAmountMinor === 0)?.data().transactionId || ''), /^[a-f0-9]{40}$/);
});

test('first verified payment transaction creates one held outbox reference without copying the GCLID', async () => {
  const orderId = `order_fresh_${crypto.randomUUID().replace(/-/g, '')}`;
  const paymentFactId = `capture_${crypto.randomUUID().replace(/-/g, '')}`;
  const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '')}`;
  const binding = 'b'.repeat(64);
  const grantId = crypto.randomUUID();
  const click = { ...rawClick, observedAt: new Date(Date.now() - 30_000).toISOString(), expiresAt: new Date(Date.now() + CLICK_EVIDENCE_MS - 30_000).toISOString() };
  const touch = candidate().order.acquisitionV2.currentSession;
  touch.sessionId = 'sess_fresh_payment';
  touch.observedAt = click.observedAt;
  touch.clicks = [{ type: 'gclid', digest: clickDigest(click.value), expiresAt: click.expiresAt }];
  const evidence = { status: 'granted', version: 1, grantId, sessionBinding: binding, recordedAt: new Date(Date.now() - 60_000).toISOString(), gpc: false };
  const order = {
    ...candidate().order, id: orderId, environment: 'production', paymentMode: 'live',
    stripePaymentId: undefined, paymentFactId: undefined, amountReceivedInCents: undefined,
    acquisitionV2: { ...candidate().order.acquisitionV2, currentSession: touch }, marketingConsentEvidence: evidence,
  };
  const paymentFact = {
    schemaVersion: 1, product: 'docketstamp', environment: 'production', factId: paymentFactId, orderId,
    currency: 'USD', amountMinor: 1295, kind: 'capture', provider: 'stripe', providerAccountId: 'acct_fixture',
    providerMode: 'live', providerObjectId: paymentIntentId, effectiveAt: new Date(Date.now() - 10_000).toISOString(),
    receivedAt: new Date().toISOString(), verification: 'verified', classification: { primary: 'customer' },
  };
  await firestoreDb.collection('google_conversion_consent_v1').doc(binding).set({ purpose: 'google_offline_conversion', consentVersion: 1, environment: 'production', status: 'granted', grantId, gpc: false, recordedAt: evidence.recordedAt });
  await firestoreDb.collection('acquisition_click_evidence_v2').doc(`${orderId}_0`).set({ orderId, ...click });
  const outboxId = googleConversionOutboxId('production', orderId);
  const created = await firestoreDb.runTransaction(tx => createGoogleConversionOutboxInTransaction(tx, {
    order: order as any, orderId, paymentFact, environment: 'production', now: Date.now(),
    freshVerifiedCapture: { paymentIntentId, amountReceivedMinor: 1295 },
  }));
  assert.equal(created, true);
  const row = (await firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(outboxId).get()).data()!;
  assert.equal(row.status, 'held');
  assert.ok(row.diagnosticCodes.includes('DESTINATION_UNAPPROVED'));
  assert.equal(row.clickEvidenceRef, `acquisition_click_evidence_v2/${orderId}_0`);
  assert.equal(JSON.stringify(row).includes(click.value), false);
  assert.equal(await firestoreDb.runTransaction(tx => createGoogleConversionOutboxInTransaction(tx, {
    order: order as any, orderId, paymentFact, environment: 'production', now: Date.now(),
    freshVerifiedCapture: { paymentIntentId, amountReceivedMinor: 1295 },
  })), false, 'duplicate webhook does not create a second logical row');
});
