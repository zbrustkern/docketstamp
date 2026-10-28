import { withVerifiedLockFixture } from './helpers/verified-lock-fixture';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

describe('Docket lock route input boundary', () => {
  it('freezes parsed facts, server-derived legal text, and complete postal addresses locally', async () => {
    const keys = [
      'NODE_ENV',
      'ALLOW_LOCAL_MOCK_PAYMENTS',
      'USE_MOCK_FIRESTORE',
      'LOB_ENV',
      'STRIPE_SECRET_KEY',
      'stripe-secret-key',
      'FIREBASE_CONFIG',
      'K_SERVICE',
      'GAE_ENV',
      'APPHOSTING_BACKEND_ID',
    ];
    const mutableEnv = process.env as Record<string, string | undefined>;
    const original = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of ['STRIPE_SECRET_KEY', 'stripe-secret-key', 'FIREBASE_CONFIG', 'K_SERVICE', 'GAE_ENV', 'APPHOSTING_BACKEND_ID']) {
      delete process.env[key];
    }
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';
    mutableEnv.USE_MOCK_FIRESTORE = 'true';
    mutableEnv.LOB_ENV = 'staging_mock_cass';

    try {
      const [{ POST }, { getOrderById }] = await Promise.all([
        import('../app/api/docket/lock-and-intent/route'),
        import('../lib/firebase-admin'),
      ]);
      const response = await POST(new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withVerifiedLockFixture({
          slug: 'security-deposit-return-demand-letter',
          tier: 'certified',
          customerEmail: 'tenant@example.com',
          docketId: 'DS-2026-ABC123',
          signatureAdoption: { adopted: true, affirmed: true, signerName: 'Taylor Morgan' },
          userValues: {
            senderFullName: 'Taylor Morgan',
            recipientFormalName: 'Example Property Group',
            propertyState: 'IN',
            vacatedPremisesAddress: '88 Rental Lane',
            rentalPropertyAddressLine2: 'Unit 2',
            rentalPropertyCity: 'Carmel',
            rentalPropertyZip: '46032',
            moveOutDate: '2026-08-31',
            depositAmount: '$1,500.00',
            amountReceivedToDate: '$0.00',
            balanceRequested: '$1,500.00',
            basisForRequest: 'My records show the deposit was paid and no refund has been received.',
            responseDays: '7 calendar days',
            senderAddressLine1: '42 Current Street',
            senderAddressLine2: 'Apartment 6A',
            senderCity: 'Indianapolis',
            senderState: 'IN',
            senderZip: '46204',
            statuteCitation: 'USER SUPPLIED CITATION',
            statuteDeadline: 'one hour',
            returnDeadlineDays: '0',
            penaltyClause: 'guaranteed treble damages',
            extraPrompt: 'untrusted field must be discarded',
          },
          senderAddress: {
            name: 'Taylor Morgan',
            addressLine1: '42 Current Street',
            addressLine2: 'Apartment 6A',
            city: 'Indianapolis',
            state: 'IN',
            zip: '46204',
          },
          recipientAddress: {
            name: 'Example Property Group',
            addressLine1: '15 Market Square',
            addressLine2: 'Suite 300',
            city: 'Carmel',
            state: 'IN',
            zip: '46032',
          },
        })),
      }));

      const responseText = await response.text();
      assert.equal(response.status, 200, responseText);
      const result = JSON.parse(responseText);
      const order = await getOrderById(result.orderId);
      assert.ok(order?.documentHtml);
      assert.match(order.documentHtml!, /Ind\. Code § 32-31-3-12/);
      assert.match(order.documentHtml!, /45 days/);
      assert.match(order.documentHtml!, /My records show the deposit was paid/);
      assert.match(order.documentHtml!, /88 Rental Lane, Unit 2, Carmel, IN 46032/);
      assert.match(order.documentHtml!, /ADDRESS CHECK SIMULATED \(STAGING\)/);
      assert.doesNotMatch(order.documentHtml!, /USER SUPPLIED CITATION|one hour|guaranteed treble damages|untrusted field/);
      assert.equal(order.returnAddress.street1, '42 Current Street');
      assert.equal(order.returnAddress.street2, 'Apartment 6A');
      assert.equal(order.returnAddress.city, 'Indianapolis');
      assert.equal(order.returnAddress.state, 'IN');
      assert.equal(order.returnAddress.zip, '46204');
      assert.equal(order.recipientAddress.street2, 'Suite 300');
    } finally {
      for (const [key, value] of original) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('rejects an oversized frozen letter before order, attempt, or payment initialization', async () => {
    const keys = ['NODE_ENV', 'ALLOW_LOCAL_MOCK_PAYMENTS', 'USE_MOCK_FIRESTORE', 'MOCK_FIRESTORE_MEMORY_ONLY', 'LOB_ENV', 'STRIPE_SECRET_KEY', 'stripe-secret-key', 'FIREBASE_CONFIG', 'K_SERVICE', 'GAE_ENV', 'APPHOSTING_BACKEND_ID'];
    const mutableEnv = process.env as Record<string, string | undefined>;
    const original = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of ['STRIPE_SECRET_KEY', 'stripe-secret-key', 'FIREBASE_CONFIG', 'K_SERVICE', 'GAE_ENV', 'APPHOSTING_BACKEND_ID']) delete process.env[key];
    mutableEnv.NODE_ENV = 'test';
    mutableEnv.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';
    mutableEnv.USE_MOCK_FIRESTORE = 'true';
    mutableEnv.MOCK_FIRESTORE_MEMORY_ONLY = 'true';
    mutableEnv.LOB_ENV = 'staging_mock_cass';
    const draftId = `physical_fit_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const [{ POST }, { firestoreDb }] = await Promise.all([
        import('../app/api/docket/lock-and-intent/route'),
        import('../lib/firebase-admin'),
      ]);
      const userValues = {
        senderFullName: 'Alexandria Maximilian Customer Name',
        recipientFormalName: 'Example Institutional Recipient Office',
        bureauEntityId: 'cra_eqf',
        senderDob: '1990-01-01',
        ssnLast4: '1234',
        furnisherName: 'W'.repeat(60),
        partialAccountNumber: 'W'.repeat(30),
        disputeReason: 'Account does not belong to me / Identity discrepancy',
        factualExplanation: 'W'.repeat(600),
        senderAddressLine1: '9876 Extended Residential Boulevard Apartment 1204',
        senderAddressLine2: 'ATTENTION OF CUSTOMER OPERATIONS DEPARTMENT',
        senderCity: 'San Francisco', senderState: 'CA', senderZip: '94105-1204',
        recipientAddressLine1: '8400 Long Corporate Parkway Suite 1400',
        recipientAddressLine2: 'LEGAL AND ADMINISTRATIVE NOTICES DEPARTMENT',
        recipientCity: 'Los Angeles', recipientState: 'CA', recipientZip: '90012-3401',
      };
      const body = withVerifiedLockFixture({
        slug: 'credit-report-dispute-request', draftId, draftRevision: 1,
        idempotencyKey: `physical_fit_${Math.random().toString(36).slice(2)}`,
        checkoutCapability: `physical_fit_capability_${Math.random().toString(36).slice(2)}_long_enough`,
        tier: 'certified', customerEmail: 'consumer@example.com', docketId: 'DS-2026-ABC123',
        signatureAdoption: { adopted: true, affirmed: true, signerName: userValues.senderFullName }, userValues,
        senderAddress: { name: userValues.senderFullName, addressLine1: userValues.senderAddressLine1, addressLine2: userValues.senderAddressLine2, city: userValues.senderCity, state: userValues.senderState, zip: userValues.senderZip },
        recipientAddress: { name: userValues.recipientFormalName, addressLine1: userValues.recipientAddressLine1, addressLine2: userValues.recipientAddressLine2, city: userValues.recipientCity, state: userValues.recipientState, zip: userValues.recipientZip },
      });
      const response = await POST(new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }));
      const payload = await response.json();
      assert.equal(response.status, 422);
      assert.equal(payload.code, 'PHYSICAL_FIT_REQUIRED');
      assert.match(payload.error, /Shorten/);
      const attempts = await firestoreDb.collection('checkout_attempts_v1').where('draftId', '==', draftId).get();
      assert.equal(attempts.size, 0, 'fit rejection occurs before checkout attempt reservation or Stripe intent creation');
    } finally {
      for (const [key, value] of original) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

});
