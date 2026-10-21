import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { isMailingReadyForCheckout } from '../lib/checkout-readiness';

const envKeys = ['NODE_ENV','ENVIRONMENT','FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_APP_URL','K_SERVICE','FIREBASE_CONFIG','IS_PREVIEW_TEST_ENVIRONMENT','ALLOW_STRIPE_TEST_IN_PRODUCTION','ALLOW_LOCAL_MOCK_PAYMENTS','STRIPE_SECRET_KEY','stripe-secret-key','LOB_ENV','LOB_DISPATCH_API_KEY','lob-dispatch-api-key','LOB_ADDRESS_VERIFICATION_KEY','lob-address-verification-key','USE_MOCK_FIRESTORE'];

test('checkout requires complete live mailing configuration and keeps staging in test mode', async () => {
  const saved = new Map(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  try {
    Object.assign(process.env, { NODE_ENV: 'test', ENVIRONMENT: 'local', USE_MOCK_FIRESTORE: 'true', ALLOW_LOCAL_MOCK_PAYMENTS: 'true' });
    const [{ POST }, { firestoreDb }] = await Promise.all([import('../app/api/docket/lock-and-intent/route'), import('../lib/firebase-admin')]);
    Object.assign(process.env, { NODE_ENV: 'production', ENVIRONMENT: 'production', STRIPE_SECRET_KEY: 'sk_live_release_fixture' });
    assert.equal(isMailingReadyForCheckout(), false, 'missing Lob keys must block live payment');
    process.env.LOB_DISPATCH_API_KEY = 'live_release_fixture';
    assert.equal(isMailingReadyForCheckout(), false, 'verification key is also required');
    process.env.LOB_ADDRESS_VERIFICATION_KEY = 'live_release_fixture';
    assert.equal(isMailingReadyForCheckout(), true);
    process.env.LOB_ENV = 'staging_mock_cass';
    assert.equal(isMailingReadyForCheckout(), false, 'live payment cannot be paired with staging dispatch');
    Object.assign(process.env, { ENVIRONMENT: 'staging', STRIPE_SECRET_KEY: 'sk_test_release_fixture', LOB_DISPATCH_API_KEY: 'test_release_fixture' });
    delete process.env.LOB_ADDRESS_VERIFICATION_KEY;
    assert.equal(isMailingReadyForCheckout(), true, 'staging keeps test dispatch and mock address validation');

    Object.assign(process.env, { ENVIRONMENT: 'production', STRIPE_SECRET_KEY: 'sk_live_release_fixture' });
    delete process.env.LOB_ENV;
    delete process.env.LOB_DISPATCH_API_KEY;
    const customerEmail = `mailing-unavailable-${Date.now()}@example.test`;
    const response = await POST(new NextRequest('http://localhost/api/docket/lock-and-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'security-deposit-return-demand-letter', customerEmail, tier: 'certified',
        signatureAdoption: { adopted: true, affirmed: true, signerName: 'Taylor Morgan' },
        userValues: { senderFullName: 'Taylor Morgan', recipientFormalName: 'Example Properties', propertyState: 'CA',
          vacatedPremisesAddress: '12 Rental Street', rentalPropertyCity: 'San Diego', rentalPropertyZip: '92101',
          moveOutDate: '2026-09-01', depositAmount: '$1500', amountReceivedToDate: '$0', balanceRequested: '$1500',
          basisForRequest: 'My records show no deposit refund received.', responseDays: '14 calendar days',
          senderAddressLine1: '77 Lake Street', senderCity: 'San Diego', senderState: 'CA', senderZip: '92101',
          recipientAddressLine1: '18 Main Street', recipientCity: 'San Diego', recipientState: 'CA', recipientZip: '92101' },
      }),
    }));
    assert.equal(response.status, 503, await response.clone().text());
    assert.equal((await response.json()).code, 'MAILING_UNAVAILABLE');
    assert.equal((await firestoreDb.collection('orders').where('customerEmail', '==', customerEmail).get()).size, 0, 'no order created before unavailable-payment rejection');
  } finally {
    for (const [key,value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
