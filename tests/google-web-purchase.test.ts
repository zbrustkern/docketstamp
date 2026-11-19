import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { firestoreDb } from '@/lib/firebase-admin';
import { classifyCapturedOrder, computeOrderSnapshotHash } from '@/lib/admin-console/finance/authority';
import { createConsentSessionToken, GOOGLE_CONVERSION_CONSENT_COOKIE, recordGoogleConversionConsent } from '@/lib/admin-console/advertising/consent';
import { GOOGLE_CONVERSION_OUTBOX, googleConversionOutboxId } from '@/lib/admin-console/advertising/outbox';
import { clickDigest } from '@/lib/acquisition';
import { hashedCheckoutEmail, WEB_PURCHASE_DESTINATION } from '@/lib/admin-console/advertising/web-purchase';
import { POST } from '@/app/api/marketing/purchase/route';
import type { Order } from '@/lib/types';

test('enhanced web purchase requires the same live grant and verified capture and returns only tag fields', async () => {
  process.env.ADMIN_SESSION_SIGNING_KEY = 'offline_purchase_signing_key_32_characters';
  process.env.ENVIRONMENT = 'production';
  process.env.FIREBASE_PROJECT_ID = 'docketstamp';
  process.env.GOOGLE_ENHANCED_WEB_PURCHASES = 'true';
  const token = createConsentSessionToken();
  const consent = await recordGoogleConversionConsent({ token, status: 'granted', gpc: false, enhancedEmailMatching: true });
  // The in-memory fixture runs with NODE_ENV=test. Its durable consent row must use the live scope.
  const consentRef = firestoreDb.collection('google_conversion_consent_v1').doc(consent.sessionBinding);
  await consentRef.update({ environment: 'production' });
  const orderId = 'order_' + randomUUID().replaceAll('-', '');
  const orderRef = firestoreDb.collection('orders').doc(orderId);
  const factId = 'paid_' + randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 300000).toISOString();
  const order = {
    id: orderId, schemaVersion: 2, kind: 'notice', environment: 'production', paymentMode: 'live', status: 'MAILED',
    stripePaymentId: 'pi_mock_web', paymentFactId: factId, amountInCents: 2795, amountReceivedInCents: 2795,
    customerEmail: '  First.Last@Gmail.com ', noticeId: 'security-deposit-return-demand-letter', documentHtml: 'secret letter',
    marketingConsentEvidence: consent, acquisitionV2: { currentSession: { source: 'google', clicks: [{ type: 'wbraid', digest: clickDigest('safe_click'), expiresAt }] } },
  };
  const snapshotHash = computeOrderSnapshotHash(order as unknown as Order);
  await orderRef.set({ ...order, paymentSnapshotHash: snapshotHash });
  const capture = { schemaVersion: 1, product: 'docketstamp', environment: 'production', factId, orderId, currency: 'USD', amountMinor: 2795, kind: 'capture', provider: 'stripe', providerAccountId: 'acct_fixture', providerMode: 'live', providerObjectId: order.stripePaymentId, effectiveAt: now, receivedAt: now, verification: 'verified', evidenceRef: 'stripe/payment_intents/pi_mock_web', classification: classifyCapturedOrder(order, 'live') };
  const fact = firestoreDb.collection('payment_facts_v1').doc(factId);
  await fact.set(capture);
  const outboxId = createHash('sha256').update(JSON.stringify('payment-obligation:' + orderId)).digest('hex');
  await firestoreDb.collection('business_outbox_v1').doc(outboxId).set({ kind: 'payment_obligation', orderId, paymentFactId: factId, snapshotHash });
  await firestoreDb.collection('acquisition_click_evidence_v2').doc(orderId + '_0').set({ orderId, observedAt: now, expiresAt, type: 'wbraid', value: 'safe_click' });
  const queue = firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(googleConversionOutboxId('production', orderId));
  await queue.set({ kind: 'google_offline_conversion', environment: 'production', orderId });
  const request = (probe = false, headers = {}) => POST(new NextRequest('https://docketstamp.com/api/marketing/purchase', {
    method: 'POST', headers: { Origin: 'https://docketstamp.com', Cookie: GOOGLE_CONVERSION_CONSENT_COOKIE + '=' + token, ...headers },
    body: JSON.stringify({ orderId, probe }),
  }));
  // Make the runtime environment resolver reflect production after mock DB initialization.
  const prior = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'production' });
  try {
    assert.deepEqual(await (await request(true)).json(), { ready: true });
    const result = await request();
    assert.equal(result.status, 200);
    assert.match(result.headers.get('cache-control')!, /no-store/);
    const tag = await result.json();
    assert.deepEqual(tag, { sendTo: WEB_PURCHASE_DESTINATION, emailHash: createHash('sha256').update('firstlast@gmail.com').digest('hex'),
      value: 27.95, currency: 'USD', transactionId: createHash('sha256').update('docketstamp:google:production:' + orderId).digest('hex').slice(0, 40),
      click: { type: 'wbraid', value: 'safe_click' } });
    assert.deepEqual(await (await request()).json(), tag);
    assert.ok((await queue.get()).data()?.webTagIssuedAt);
    assert.equal((await request(false, { Origin: 'https://other.example' })).status, 204);
    // Default US opt-out buyer (status: unknown, valid signed sessionBinding cookie) succeeds,
    // and paid-click -> direct-return falls back to firstObserved click evidence.
    const defaultToken = createConsentSessionToken();
    const defaultBinding = createHash('sha256').update(defaultToken.split('.')[0]).digest('hex');
    const defaultConsent = { status: 'unknown' as const, version: 1 as const, sessionBinding: defaultBinding, gpc: false };
    const defaultOrder = {
      ...order,
      marketingConsentEvidence: defaultConsent,
      acquisitionV2: {
        firstObserved: { source: 'google', clicks: [{ type: 'wbraid', digest: clickDigest('safe_click'), expiresAt }] },
        currentSession: { source: 'direct', clicks: [] },
      },
    };
    const defaultSnapshotHash = computeOrderSnapshotHash(defaultOrder as unknown as Order);
    await orderRef.set({ ...defaultOrder, paymentSnapshotHash: defaultSnapshotHash });
    await firestoreDb.collection('business_outbox_v1').doc(outboxId).set({ kind: 'payment_obligation', orderId, paymentFactId: factId, snapshotHash: defaultSnapshotHash });
    const defaultReq = (probe = false, headers = {}) => POST(new NextRequest('https://docketstamp.com/api/marketing/purchase', {
      method: 'POST', headers: { Origin: 'https://docketstamp.com', Cookie: GOOGLE_CONVERSION_CONSENT_COOKIE + '=' + defaultToken, ...headers },
      body: JSON.stringify({ orderId, probe }),
    }));
    const defaultRes = await defaultReq();
    assert.equal(defaultRes.status, 200);
    assert.deepEqual(await defaultRes.json(), tag);
    // Unbound browser (wrong cookie) cannot read purchase tag payload.
    assert.equal((await request()).status, 204);
    // Restore original order + snapshot hash for remaining negative assertions.
    await orderRef.set({ ...order, paymentSnapshotHash: snapshotHash });
    await firestoreDb.collection('business_outbox_v1').doc(outboxId).set({ kind: 'payment_obligation', orderId, paymentFactId: factId, snapshotHash });
    for (const patch of [{ isTest: true }, { isComp: true }, { isFounderTest: true },
      { noticeId: 'fcra-credit-bureau-written-dispute-letter' },
      { noticeId: 'fdcpa-30-day-debt-validation-letter' },
      { noticeId: 'statutory-health-and-biometric-data-deletion-demand' },
      { marketingConsentEvidence: { ...consent, sessionBinding: 'f'.repeat(64) } },
      { marketingConsentEvidence: { ...consent, grantId: 'other' } },
      { marketingConsentEvidence: { ...consent, status: 'denied' } },
      { marketingConsentEvidence: { ...consent, status: 'withdrawn' } },
      { marketingConsentEvidence: { ...consent, gpc: true } }]) {
      await orderRef.set({ ...order, paymentSnapshotHash: snapshotHash, ...patch });
      assert.equal((await request()).status, 204);
    }
    await orderRef.set({ ...order, paymentSnapshotHash: snapshotHash });
    await fact.update({ verification: 'pending' });
    assert.equal((await request()).status, 204);
    await fact.update({ verification: 'verified' });
    const refund = firestoreDb.collection('payment_facts_v1').doc(factId + '_refund');
    await refund.set({ ...capture, kind: 'refund' });
    assert.equal((await request()).status, 204);
    await refund.delete();
    await queue.update({ deliveryMode: 'api' });
    assert.equal((await request()).status, 204);
    await queue.update({ deliveryMode: null });
    await consentRef.update({ status: 'withdrawn' });
    assert.equal((await request()).status, 204);
    await consentRef.update({ status: 'granted' });
    assert.equal((await request(false, { 'Sec-GPC': '1' })).status, 204);
    assert.equal((await request()).status, 204);
    process.env.ENVIRONMENT = 'staging';
    assert.equal((await request()).status, 204);
  } finally { Object.assign(process.env, { NODE_ENV: prior }); }
});

test('hashing preserves dots for non-Google email domains and rejects invalid addresses', () => {
  assert.equal(hashedCheckoutEmail('A.B@Example.ORG'), createHash('sha256').update('a.b@example.org').digest('hex'));
  assert.equal(hashedCheckoutEmail('invalid'), null);
});
