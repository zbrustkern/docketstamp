import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { assertFulfillmentDispatchAllowed } from '../src/lib/checkout-attempts/contract';

const id = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

async function seedAttempt(suffix: string, ownerUid?: string) {
  const { reserveAttempt, sha256, setAttemptState } = await import('../src/lib/checkout-attempts/store');
  const attemptId = `ca_review_${suffix}`;
  const orderId = `order_review_${suffix}`;
  const draftId = `draft_review_${suffix}`;
  const capability = `capability_review_${suffix}_with_enough_entropy`;
  const created = await reserveAttempt({
    attemptId,
    orderId,
    ...(ownerUid ? { ownerUid } : {}),
    capabilityDigest: sha256(capability),
    draftId,
    draftRevision: 1,
    requestKeyDigest: sha256(`key_${suffix}`),
    payloadDigest: sha256(`payload_${suffix}`),
    snapshotHash: sha256(`snapshot_${suffix}`),
    quoteVersion: 'q_review',
    pricingVersion: 'docketstamp-usps-2026-v1',
    amountInCents: 1295,
    currency: 'usd',
    tier: 'certified',
    scopeId: sha256(`scope_${suffix}`),
  });
  assert.equal(created.kind, 'created');
  const { firestoreDb } = await import('../lib/firebase-admin');
  await firestoreDb.collection('orders').doc(orderId).set({ id: orderId, checkoutAttemptId: attemptId });
  return { attemptId, orderId, draftId, capability, setAttemptState };
}

test('late cancellation result cannot overwrite payment captured while supersession is pending', async () => {
  const suffix = id();
  const { attemptId, orderId, draftId, capability, setAttemptState } = await seedAttempt(suffix);
  await setAttemptState(attemptId, 'locked', { paymentIntentId: `pi_${suffix}` });

  let resolverStarted!: () => void;
  let releaseResolver!: (outcome: 'cancelled') => void;
  const started = new Promise<void>((resolve) => { resolverStarted = resolve; });
  const delayedResolution = new Promise<'cancelled'>((resolve) => { releaseResolver = resolve; });
  const { supersedeAttempt } = await import('../src/lib/checkout-attempts/supersession');
  const pending = supersedeAttempt({
    attemptId,
    capability,
    draftId,
    nextRevision: 2,
    paymentResolver: async () => {
      resolverStarted();
      return delayedResolution;
    },
  });
  await started;

  // Simulate the concurrent payment webhook/authority commit while cancellation
  // is waiting on the provider. The delayed cancellation response is stale.
  await setAttemptState(attemptId, 'paid', { paymentIntentId: `pi_${suffix}` });
  releaseResolver('cancelled');
  const result = await pending;
  const { getAttempt } = await import('../src/lib/checkout-attempts/store');
  const { firestoreDb } = await import('../lib/firebase-admin');
  const canonical = await getAttempt(attemptId);
  const order = (await firestoreDb.collection('orders').doc(orderId).get()).data();
  assert.ok(canonical);
  assert.ok(['paid', 'captured_exception'].includes(canonical.state));
  assert.ok(['paid', 'captured_exception'].includes(result.attempt.state));
  assert.equal(order?.checkoutAttemptState, canonical.state);
  assert.throws(() => assertFulfillmentDispatchAllowed({
    orderId,
    attemptId,
    state: canonical.state,
  }));
});

test('late locked initialization cannot regress a paid attempt or its order mirror', async () => {
  const suffix = id();
  const { attemptId, orderId, setAttemptState } = await seedAttempt(suffix);
  await setAttemptState(attemptId, 'paid', { paymentIntentId: `pi_${suffix}` });

  // Models an async lock initializer completing after payment authority.
  const delayedLockWrite = await setAttemptState(attemptId, 'locked', {
    clientSecret: `secret_${suffix}`,
  });
  const { getAttempt } = await import('../src/lib/checkout-attempts/store');
  const { firestoreDb } = await import('../lib/firebase-admin');
  const canonical = await getAttempt(attemptId);
  const order = (await firestoreDb.collection('orders').doc(orderId).get()).data();
  assert.equal(delayedLockWrite.state, 'paid');
  assert.equal(canonical?.state, 'paid');
  assert.equal(order?.checkoutAttemptState, 'paid');
});

test('an owner cannot replay or supersede another owner’s attempt with a leaked guest capability', async () => {
  const suffix = id();
  const { attemptId, draftId, capability } = await seedAttempt(suffix, `owner_A_${suffix}`);
  const { POST } = await import('../app/api/docket/attempts/[attemptId]/supersede/route');
  const response = await POST(new NextRequest(`http://localhost/api/docket/attempts/${attemptId}/supersede`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkoutCapability: capability, draftId, draftRevision: 2 }),
  }), { params: Promise.resolve({ attemptId }) });
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.code, 'CHECKOUT_ATTEMPT_NOT_FOUND');

  const { reserveAttempt, sha256 } = await import('../src/lib/checkout-attempts/store');
  const reservation = await reserveAttempt({
    attemptId: `ca_other_scope_${suffix}`,
    orderId: `order_other_scope_${suffix}`,
    capabilityDigest: sha256(capability),
    draftId,
    draftRevision: 1,
    requestKeyDigest: sha256(`key_${suffix}`),
    payloadDigest: sha256(`payload_${suffix}`),
    snapshotHash: sha256(`snapshot_${suffix}`),
    quoteVersion: 'q_review',
    pricingVersion: 'docketstamp-usps-2026-v1',
    amountInCents: 1295,
    currency: 'usd',
    tier: 'certified',
    ownerUid: `owner_B_${suffix}`,
    scopeId: sha256(`user:owner_B_${suffix}`),
  });
  assert.equal(reservation.kind, 'active_attempt');
  if (reservation.kind === 'active_attempt') assert.equal(reservation.attempt.attemptId, attemptId);
});

test('idempotent lock replay with a missing order stays busy and never cancels a live creator', async () => {
  const suffix = id();
  const draftId = `draft_route_${suffix}`;
  const checkoutCapability = `cc_route_${suffix}_with_more_than_32_chars`;
  const idempotencyKey = `idem_route_${suffix}`;
  const senderAddress = {
    name: 'Taylor Morgan',
    addressLine1: '42 CURRENT STREET',
    addressLine2: 'APARTMENT 6A',
    city: 'INDIANAPOLIS',
    state: 'IN',
    zip: '46204-1001',
  };
  const recipientAddress = {
    name: 'Example Property Group',
    addressLine1: '15 MARKET SQUARE',
    addressLine2: 'SUITE 300',
    city: 'CARMEL',
    state: 'IN',
    zip: '46032-1001',
  };
  const originalEnv = new Map(Object.entries({
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_LOCAL_MOCK_PAYMENTS: process.env.ALLOW_LOCAL_MOCK_PAYMENTS,
    LOB_ENV: process.env.LOB_ENV,
    ADDRESS_VERIFICATION_EVIDENCE_SECRET: process.env.ADDRESS_VERIFICATION_EVIDENCE_SECRET,
  }));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    ALLOW_LOCAL_MOCK_PAYMENTS: 'true',
    LOB_ENV: 'staging_mock_cass',
    ADDRESS_VERIFICATION_EVIDENCE_SECRET: 'test-evidence-signing-secret-with-32-bytes',
  });
  try {
    const { createAddressVerificationEvidence } = await import('../src/lib/docket/address-verification-evidence');
    const verificationEvidence = {
      sender: createAddressVerificationEvidence({ role: 'sender', draftId, draftRevision: 1, address: senderAddress, providerMode: 'staging_mock_cass' }),
      recipient: createAddressVerificationEvidence({ role: 'recipient', draftId, draftRevision: 1, address: recipientAddress, providerMode: 'staging_mock_cass' }),
    };
    const body = {
      slug: 'security-deposit-return-demand-letter',
      tier: 'certified',
      customerEmail: 'tenant@example.com',
      docketId: `DS-2026-${suffix.slice(-6).toUpperCase()}`,
      draftId,
      draftRevision: 1,
      checkoutCapability,
      idempotencyKey,
      verificationEvidence,
      signatureAdoption: { adopted: true, affirmed: true, signerName: 'Taylor Morgan' },
      userValues: {
        senderFullName: 'Taylor Morgan',
        recipientFormalName: 'Example Property Group',
        propertyState: 'IN',
        vacatedPremisesAddress: '88 Rental Lane',
        rentalPropertyCity: 'Carmel',
        rentalPropertyZip: '46032',
        moveOutDate: '2026-08-31',
        depositAmount: '$1,500.00',
        amountReceivedToDate: '$0.00',
        balanceRequested: '$1,500.00',
        basisForRequest: 'My records show the deposit was paid and no refund has been received.',
        responseDays: '7 calendar days',
      },
      senderAddress,
      recipientAddress,
    };
    const { POST } = await import('../app/api/docket/lock-and-intent/route');
    const request = () => new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const firstResponse = await POST(request());
    const firstPayload = await firstResponse.json();
    assert.equal(firstResponse.status, 200, JSON.stringify(firstPayload));

    const { firestoreDb } = await import('../lib/firebase-admin');
    const { getAttempt } = await import('../src/lib/checkout-attempts/store');
    const attempt = await getAttempt(firstPayload.attemptId);
    assert.ok(attempt);
    // Simulate a creator that has reserved the attempt but whose order has not
    // committed yet; use the backing test store to place it in that in-flight state.
    await firestoreDb.collection('checkout_attempts_v1').doc(firstPayload.attemptId).update({ state: 'creating' });
    await firestoreDb.collection('orders').doc(firstPayload.orderId).delete();
    const replayResponse = await POST(request());
    const replayPayload = await replayResponse.json();
    assert.equal(replayResponse.status, 409);
    assert.equal(replayPayload.code, 'CHECKOUT_ATTEMPT_BUSY');
    assert.equal((await getAttempt(firstPayload.attemptId))?.state, 'creating');
  } finally {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('a durably accepted postal attempt repairs payment/follow-on outboxes without resubmitting', async () => {
  const suffix = id();
  const { firestoreDb } = await import('../lib/firebase-admin');
  const { claimDispatchAttempt, finishDispatchAttempt, reconcileAcceptedDispatchOutboxes } = await import('../lib/admin-console/postal/attempt-store');
  const { sha256 } = await import('../src/lib/checkout-attempts/store');
  const orderId = `order_accepted_recovery_${suffix}`;
  const paymentFactId = `payment_fact_${suffix}`;
  const snapshotHash = sha256(`snapshot_hash_${suffix}`);
  await firestoreDb.collection('orders').doc(orderId).set({
    id: orderId, status: 'PAYMENT_RECEIVED', stripePaymentId: `pi_mock_${suffix}`,
    customerEmail: '', snapshotHash,
  });
  await firestoreDb.collection('business_outbox_v1').doc(`payment_obligation_${suffix}`).set({
    kind: 'payment_obligation', orderId, paymentFactId, snapshotHash,
    status: 'processing', attempts: 1,
  });

  const claim = await claimDispatchAttempt({
    authority: {
      product: 'docketstamp', environment: 'local', orderId, snapshotHash, snapshotVersion: 1,
      tier: 'certified', currency: 'USD', payableAmountMinor: 1295,
      lobMode: 'mock', cassMode: 'staging_mock_cass', paymentFactId,
    },
    actorId: `stripe:${suffix}`, requestId: `payment-obligation:${orderId}`, evidenceRef: `evidence:${suffix}`,
  });
  assert.equal(claim.claimed, true);
  if (!claim.claimed) return;
  await finishDispatchAttempt({ attemptId: claim.attempt.attemptId, state: 'accepted', providerLetterId: `letter_${suffix}` });

  assert.equal(await reconcileAcceptedDispatchOutboxes(claim.attempt.attemptId, paymentFactId), true);
  const accepted = await firestoreDb.collection('dispatch_attempts_v1').doc(claim.attempt.attemptId).get();
  assert.equal(accepted.data()?.state, 'accepted');
  assert.equal((await firestoreDb.collection('orders').doc(orderId).get()).data()?.status, 'PROCESSING_DISPATCH');
  const postalFacts = await firestoreDb.collection('postal_facts_v1').where('orderId', '==', orderId).get();
  const acceptanceEvents = await firestoreDb.collection('business_events_v1').where('orderId', '==', orderId).where('eventName', '==', 'fulfillment_accepted').get();
  assert.equal(postalFacts.size, 1, 'One provider acceptance writes one postal fact in the accepted-attempt transaction.');
  assert.equal(postalFacts.docs[0].data()?.state, 'accepted_by_lob', 'Lob acceptance remains distinct from postal delivery.');
  assert.equal(acceptanceEvents.size, 1, 'One accepted attempt writes one server fulfillment milestone.');
  const outboxes = await firestoreDb.collection('business_outbox_v1').where('orderId', '==', orderId).get();
  assert.ok(outboxes.docs.some((doc: any) => doc.data()?.kind === 'payment_obligation' && doc.data()?.status === 'consumed'));
  assert.ok(outboxes.docs.some((doc: any) => doc.data()?.kind === 'dispatch_accepted_effects' && doc.data()?.status === 'pending'));
  assert.equal(await reconcileAcceptedDispatchOutboxes(claim.attempt.attemptId, paymentFactId), true);
  assert.equal((await firestoreDb.collection('postal_facts_v1').where('orderId', '==', orderId).get()).size, 1, 'Outbox recovery does not duplicate the provider acceptance fact.');
});
