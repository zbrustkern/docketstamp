import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertFulfillmentDispatchAllowed, CheckoutAttemptDispatchBlockedError } from '../src/lib/checkout-attempts/contract';

Object.assign(process.env, { NODE_ENV: 'test', USE_MOCK_FIRESTORE: 'true', MOCK_FIRESTORE_MEMORY_ONLY: 'true' });

test('dispatch gate preserves legacy orders and allows only finalized attempt states', () => {
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: 'legacy-order' }));
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: 'paid-order', attemptId: 'ca_paid', state: 'paid' }));
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: 'free-order', attemptId: 'ca_free', state: 'free_authorized' }));
  for (const state of ['creating', 'payment_processing', 'cancellation_pending', 'superseding', 'outcome_unknown', 'captured_exception', 'paid_exception', 'superseded', 'cancelled']) {
    assert.throws(
      () => assertFulfillmentDispatchAllowed({ orderId: 'blocked-order', attemptId: 'ca_blocked', state }),
      CheckoutAttemptDispatchBlockedError,
      state,
    );
  }
  assert.throws(() => assertFulfillmentDispatchAllowed({ orderId: 'new-state', attemptId: 'ca_new', state: 'future_state' }));
});

test('attempt idempotency replays the same attempt and rejects key reuse for changed payloads', async () => {
  const { reserveAttempt, sha256 } = await import('../src/lib/checkout-attempts/store');
  const suffix = `${Date.now()}_${Math.random()}`;
  const base = {
    attemptId: `ca_${suffix}_one`, orderId: `order_${suffix}_one`, ownerUid: undefined,
    capabilityDigest: sha256(`cap_${suffix}`), draftId: `draft_${suffix}`, draftRevision: 2,
    requestKeyDigest: sha256(`key_${suffix}`), payloadDigest: sha256('payload-one'),
    snapshotHash: sha256('<html>frozen</html>'), quoteVersion: 'q_1', pricingVersion: 'docketstamp-usps-2026-v1',
    amountInCents: 1995, currency: 'usd' as const, tier: 'certified', scopeId: sha256(`scope_${suffix}`),
  };
  const first = await reserveAttempt(base);
  assert.equal(first.kind, 'created');
  const replay = await reserveAttempt({ ...base, attemptId: `ca_${suffix}_unused`, orderId: `order_${suffix}_unused` });
  assert.equal(replay.kind, 'replay');
  if (replay.kind === 'replay') assert.equal(replay.attempt.attemptId, base.attemptId);
  const conflict = await reserveAttempt({ ...base, payloadDigest: sha256('different') });
  assert.equal(conflict.kind, 'conflict');
});

test('supersession cancellation race records capture and keeps uncertain outcomes blocked', async () => {
  const { reserveAttempt, sha256 } = await import('../src/lib/checkout-attempts/store');
  const { firestoreDb } = await import('../lib/firebase-admin');
  const { supersedeAttempt } = await import('../src/lib/checkout-attempts/supersession');
  const suffix = `${Date.now()}_${Math.random()}`;
  const capability = `cap_${suffix}`;
  const digest = sha256(capability);
  const attemptId = `ca_${suffix}`;
  const orderId = `order_${suffix}`;
  await reserveAttempt({
    attemptId, orderId, capabilityDigest: digest, draftId: `draft_${suffix}`, draftRevision: 1,
    requestKeyDigest: sha256(`key_${suffix}`), payloadDigest: sha256(`payload_${suffix}`),
    snapshotHash: sha256('snapshot'), quoteVersion: 'q_test', pricingVersion: 'test',
    amountInCents: 1295, currency: 'usd', tier: 'first_class', scopeId: sha256(`scope_${suffix}`),
  });
  await firestoreDb.collection('orders').doc(orderId).set({ id: orderId, checkoutAttemptId: attemptId });
  const { setAttemptState } = await import('../src/lib/checkout-attempts/store');
  await setAttemptState(attemptId, 'locked', { paymentIntentId: `pi_${suffix}` });
  const capture = await supersedeAttempt({
    attemptId, capability, draftId: `draft_${suffix}`, nextRevision: 2,
    paymentResolver: async () => 'captured',
  });
  assert.equal(capture.attempt.state, 'captured_exception');
  assert.equal(capture.outcome, 'captured');
  assert.throws(() => assertFulfillmentDispatchAllowed({ orderId, attemptId, state: capture.attempt.state }));

  const uncertainId = `${attemptId}_uncertain`;
  const uncertainOrder = `${orderId}_uncertain`;
  const uncertainDraft = `${uncertainId}_draft`;
  await reserveAttempt({
    attemptId: uncertainId, orderId: uncertainOrder, capabilityDigest: digest, draftId: uncertainDraft, draftRevision: 1,
    requestKeyDigest: sha256(`key_${uncertainId}`), payloadDigest: sha256(`payload_${uncertainId}`),
    snapshotHash: sha256('snapshot-uncertain'), quoteVersion: 'q_test', pricingVersion: 'test',
    amountInCents: 1295, currency: 'usd', tier: 'first_class', scopeId: sha256(`scope_${uncertainId}`),
  });
  await firestoreDb.collection('orders').doc(uncertainOrder).set({ id: uncertainOrder, checkoutAttemptId: uncertainId });
  await setAttemptState(uncertainId, 'locked', { paymentIntentId: `pi_${uncertainId}` });
  const unknown = await supersedeAttempt({
    attemptId: uncertainId, capability, draftId: uncertainDraft, nextRevision: 2,
    paymentResolver: async () => 'unknown',
  });
  assert.equal(unknown.attempt.state, 'outcome_unknown');
  assert.throws(() => assertFulfillmentDispatchAllowed({ orderId: uncertainOrder, attemptId: uncertainId, state: unknown.attempt.state }));
});

test('local mock supersession resolves from matching server mode without Stripe calls', async () => {
  const envKeys = ['ALLOW_LOCAL_MOCK_PAYMENTS', 'STRIPE_SECRET_KEY', 'stripe-secret-key'];
  const original = new Map(envKeys.map((key) => [key, process.env[key]]));
  process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env['stripe-secret-key'];

  try {
    const { reserveAttempt, setAttemptState, sha256 } = await import('../src/lib/checkout-attempts/store');
    const { firestoreDb } = await import('../lib/firebase-admin');
    const { supersedeAttempt } = await import('../src/lib/checkout-attempts/supersession');
    const suffix = `${Date.now()}_${Math.random()}`;
    const attemptId = `ca_local_${suffix}`;
    const orderId = `order_local_${suffix}`;
    const draftId = `draft_local_${suffix}`;
    const capability = `capability_local_${suffix}`;
    const paymentIntentId = `pi_mock_${orderId}`;
    await reserveAttempt({
      attemptId, orderId, capabilityDigest: sha256(capability), draftId, draftRevision: 1,
      requestKeyDigest: sha256(`key_${suffix}`), payloadDigest: sha256(`payload_${suffix}`),
      snapshotHash: sha256('local snapshot'), quoteVersion: 'q_local', pricingVersion: 'test',
      amountInCents: 1295, currency: 'usd', tier: 'first_class', paymentMode: 'local_mock', scopeId: sha256(`scope_${suffix}`),
    });
    await firestoreDb.collection('orders').doc(orderId).set({
      id: orderId, status: 'PENDING_PAYMENT', paymentMode: 'local_mock', isTest: true,
      checkoutAttemptId: attemptId, checkoutPaymentIntentId: paymentIntentId, stripePaymentId: paymentIntentId,
    });
    await setAttemptState(attemptId, 'locked', { paymentIntentId });

    const resolved = await supersedeAttempt({ attemptId, capability, draftId, nextRevision: 2 });
    assert.equal(resolved.outcome, 'cancelled');
    assert.equal(resolved.attempt.state, 'superseded');

    const legacyAttemptId = `${attemptId}_legacy`;
    const legacyOrderId = `${orderId}_legacy`;
    const legacyDraftId = `${draftId}_legacy`;
    const legacyIntentId = `pi_mock_${legacyOrderId}`;
    await reserveAttempt({
      attemptId: legacyAttemptId, orderId: legacyOrderId, capabilityDigest: sha256(capability), draftId: legacyDraftId, draftRevision: 1,
      requestKeyDigest: sha256(`key_${legacyAttemptId}`), payloadDigest: sha256(`payload_${legacyAttemptId}`),
      snapshotHash: sha256('legacy local snapshot'), quoteVersion: 'q_local', pricingVersion: 'test',
      amountInCents: 1295, currency: 'usd', tier: 'first_class', scopeId: sha256(`scope_${legacyAttemptId}`),
    });
    await firestoreDb.collection('orders').doc(legacyOrderId).set({
      id: legacyOrderId, status: 'PENDING_PAYMENT', paymentMode: 'local_mock', isTest: true,
      checkoutAttemptId: legacyAttemptId, checkoutPaymentIntentId: legacyIntentId, stripePaymentId: legacyIntentId,
    });
    await setAttemptState(legacyAttemptId, 'locked', { paymentIntentId: legacyIntentId });
    const migrated = await supersedeAttempt({ attemptId: legacyAttemptId, capability, draftId: legacyDraftId, nextRevision: 2 });
    assert.equal(migrated.outcome, 'cancelled', 'server-persisted order mode safely migrates a legacy attempt without attempt.paymentMode');
    assert.equal(migrated.attempt.state, 'superseded');

    // An arbitrary mock-looking identifier without stored server mode is not a bypass.
    const unscopedAttemptId = `${attemptId}_unscoped`;
    const unscopedOrderId = `${orderId}_unscoped`;
    const unscopedDraftId = `${draftId}_unscoped`;
    await reserveAttempt({
      attemptId: unscopedAttemptId, orderId: unscopedOrderId, capabilityDigest: sha256(capability), draftId: unscopedDraftId, draftRevision: 1,
      requestKeyDigest: sha256(`key_${unscopedAttemptId}`), payloadDigest: sha256(`payload_${unscopedAttemptId}`),
      snapshotHash: sha256('unscoped snapshot'), quoteVersion: 'q_local', pricingVersion: 'test',
      amountInCents: 1295, currency: 'usd', tier: 'first_class', scopeId: sha256(`scope_${unscopedAttemptId}`),
    });
    await firestoreDb.collection('orders').doc(unscopedOrderId).set({
      id: unscopedOrderId, status: 'PENDING_PAYMENT', checkoutAttemptId: unscopedAttemptId,
      checkoutPaymentIntentId: `pi_mock_${unscopedOrderId}`, stripePaymentId: `pi_mock_${unscopedOrderId}`,
    });
    await setAttemptState(unscopedAttemptId, 'locked', { paymentIntentId: `pi_mock_${unscopedOrderId}` });
    const unscoped = await supersedeAttempt({ attemptId: unscopedAttemptId, capability, draftId: unscopedDraftId, nextRevision: 2 });
    assert.equal(unscoped.outcome, 'unknown');
    assert.equal(unscoped.attempt.state, 'outcome_unknown');

    const mismatchedAttemptId = `${attemptId}_stripe_test`;
    const mismatchedOrderId = `${orderId}_stripe_test`;
    const mismatchedDraftId = `${draftId}_stripe_test`;
    await reserveAttempt({
      attemptId: mismatchedAttemptId, orderId: mismatchedOrderId, capabilityDigest: sha256(capability), draftId: mismatchedDraftId, draftRevision: 1,
      requestKeyDigest: sha256(`key_${mismatchedAttemptId}`), payloadDigest: sha256(`payload_${mismatchedAttemptId}`),
      snapshotHash: sha256('test-mode snapshot'), quoteVersion: 'q_test', pricingVersion: 'test',
      amountInCents: 1295, currency: 'usd', tier: 'first_class', paymentMode: 'stripe_test', scopeId: sha256(`scope_${mismatchedAttemptId}`),
    });
    const mismatchedIntentId = `pi_test_${mismatchedOrderId}`;
    await firestoreDb.collection('orders').doc(mismatchedOrderId).set({
      id: mismatchedOrderId, status: 'PENDING_PAYMENT', paymentMode: 'stripe_test', isTest: true,
      checkoutAttemptId: mismatchedAttemptId, checkoutPaymentIntentId: mismatchedIntentId, stripePaymentId: mismatchedIntentId,
    });
    await setAttemptState(mismatchedAttemptId, 'locked', { paymentIntentId: mismatchedIntentId });
    const mismatch = await supersedeAttempt({ attemptId: mismatchedAttemptId, capability, draftId: mismatchedDraftId, nextRevision: 2 });
    assert.equal(mismatch.outcome, 'unknown');
    assert.equal(mismatch.attempt.state, 'outcome_unknown');
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
