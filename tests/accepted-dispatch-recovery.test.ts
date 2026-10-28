import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { firestoreDb } from "../lib/firebase-admin";
import { dispatchAuthorizedObligation } from "../lib/admin-console/postal/dispatch";
import { computeOrderSnapshotHash, consumePaymentObligation, drainAcceptedDispatchEffects } from "../lib/admin-console/finance/authority";

const docId = (value: string) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("accepted lock repairs a stranded payment outbox without a second Lob submission", async () => {
  const orderId = "accepted-crash-replay";
  const paymentFactId = "verified-capture-accepted-crash";
  const receivedAt = new Date().toISOString();
  const orderRecord = {
    id: orderId, customerEmail: "alex@example.test", noticeId: "consumer-rights", noticeType: "consumer-rights",
    serviceLevel: "CERTIFIED", recipientAddress: { firstName: "Alex", lastName: "Example", street1: "100 Main St", city: "Chicago", state: "IL", zip: "60601" },
    returnAddress: { firstName: "DocketStamp", lastName: "Mail", street1: "200 Main St", city: "Chicago", state: "IL", zip: "60601" },
    documentHtml: "<html>Frozen</html>", status: "PAYMENT_RECEIVED", amountInCents: 1200, finalAmountInCents: 1200,
    paymentMethod: "STRIPE", stripePaymentId: "pi_test_replay", paymentFactId, paymentMode: "stripe_test", isTest: true,
  };
  const snapshotHash = computeOrderSnapshotHash(orderRecord as any);
  await firestoreDb.collection("orders").doc(orderId).set({ ...orderRecord, paymentSnapshotHash: snapshotHash });
  await firestoreDb.collection("payment_facts_v1").doc(paymentFactId).set({
    schemaVersion: 1, product: "docketstamp", environment: "local", factId: paymentFactId, orderId,
    currency: "USD", amountMinor: 1200, kind: "capture", provider: "stripe", providerAccountId: "acct_test",
    providerMode: "test", providerObjectId: "pi_test_replay", effectiveAt: receivedAt, receivedAt,
    verification: "verified", evidenceRef: "stripe/payment_intents/pi_test_replay",
    classification: { classificationId: `order:${orderId}:policy-v1`, primary: "automated_test", overlappingFacts: [], evidenceRefs: [`orders/${orderId}`], policyVersion: 1, classifiedAt: receivedAt },
  });
  const obligationId = docId(`payment-obligation:${orderId}`);
  await firestoreDb.collection("business_outbox_v1").doc(obligationId).set({
    kind: "payment_obligation", orderId, paymentFactId, snapshotHash, status: "processing", attempts: 1,
  });

  let providerSubmissions = 0;
  const resolveObligation = async () => ({
    verified: true as const, orderId, version: 1 as const, environment: "local" as const, paymentFactId,
    material: {
      documentHtml: "<html>Frozen</html>", snapshotHash, snapshotVersion: 1, docketId: "DS-REPLAY",
      noticeId: "consumer-rights", tier: "certified" as const, currency: "USD", payableAmountMinor: 1200,
      recipientAddress: { name: "Alex Example", address_line1: "100 Main St", address_city: "Chicago", address_state: "IL", address_zip: "60601", address_country: "US" },
      returnAddress: { name: "DocketStamp", address_line1: "200 Main St", address_city: "Chicago", address_state: "IL", address_zip: "60601", address_country: "US" },
    },
  });
  const submit = async () => {
    providerSubmissions++;
    return { success: true, mode: "mock" as const, letterId: "letter_accepted_once" };
  };

  const accepted = await dispatchAuthorizedObligation({
    orderId, requestId: "payment-obligation:accepted-crash-replay", actorId: "test", evidenceRef: "test-proof",
    resolveObligation, submit,
  });
  assert.equal(accepted.status, "accepted", JSON.stringify(accepted));
  assert.equal(providerSubmissions, 1);

  // Model a process that stopped after the accepted lock was written while the
  // pre-fix payment outbox still showed processing.
  await firestoreDb.collection("business_outbox_v1").doc(obligationId).update({ status: "processing", leaseUntil: null });
  const effectsId = docId(`dispatch-accepted-effects:${orderId}:1`);
  assert.equal((await firestoreDb.collection("business_outbox_v1").doc(effectsId).get()).data()?.status, "pending");

  const replay = await dispatchAuthorizedObligation({
    orderId, requestId: "payment-obligation:accepted-crash-replay", actorId: "test", evidenceRef: "test-proof",
    resolveObligation, submit,
  });
  assert.deepEqual(replay, { status: "blocked", reason: "ALREADY_ACCEPTED" });
  assert.equal(providerSubmissions, 1, "accepted postal work is never resubmitted during outbox recovery");

  let paidEffects = 0;
  const consumedReplay = await consumePaymentObligation(orderId, paymentFactId, { processAcceptedEffects: async () => { paidEffects++; } });
  assert.equal(consumedReplay.success, true);
  assert.equal(consumedReplay.followupStatus, "FOLLOWUPS_RECORDED");
  assert.equal((await firestoreDb.collection("business_outbox_v1").doc(obligationId).get()).data()?.status, "consumed");
  assert.equal((await firestoreDb.collection("business_outbox_v1").doc(effectsId).get()).data()?.status, "consumed");
  const secondConsumedReplay = await consumePaymentObligation(orderId, paymentFactId, { processAcceptedEffects: async () => { paidEffects++; } });
  assert.equal(secondConsumedReplay.followupStatus, "ALREADY_CONSUMED");
  assert.equal(paidEffects, 1, "paid follow-ons are deduplicated when the accepted obligation is replayed");

  for (const scenario of [
    { orderId: "accepted-free-followups", actorId: "free-customer", freeAuthorizationFactId: "free-auth-proof" },
    { orderId: "accepted-operator-followups", actorId: "admin:operator", paymentFactId: "operator-payment-proof" },
  ]) {
    await firestoreDb.collection("orders").doc(scenario.orderId).set({
      id: scenario.orderId, status: "PAYMENT_RECEIVED", stripePaymentId: scenario.paymentFactId ? "pi_operator" : null,
      isTest: true,
    });
    let followups = 0;
    const routeResolver = async () => ({
      verified: true as const, orderId: scenario.orderId, version: 1 as const, environment: "local" as const,
      ...(scenario.paymentFactId ? { paymentFactId: scenario.paymentFactId } : { freeAuthorizationFactId: scenario.freeAuthorizationFactId }),
      material: {
        documentHtml: "<html>Frozen</html>", snapshotHash, snapshotVersion: 1, docketId: "DS-REPLAY",
        noticeId: "consumer-rights", tier: "certified" as const, currency: "USD", payableAmountMinor: 1200,
        recipientAddress: { name: "Alex Example", address_line1: "100 Main St", address_city: "Chicago", address_state: "IL", address_zip: "60601", address_country: "US" },
        returnAddress: { name: "DocketStamp", address_line1: "200 Main St", address_city: "Chicago", address_state: "IL", address_zip: "60601", address_country: "US" },
      },
    });
    const acceptedByRoute = await dispatchAuthorizedObligation({
      orderId: scenario.orderId, requestId: `${scenario.actorId}:${scenario.orderId}`, actorId: scenario.actorId, evidenceRef: "route-proof",
      resolveObligation: routeResolver,
      submit,
    });
    assert.equal(acceptedByRoute.status, "accepted");
    const routeReplay = await dispatchAuthorizedObligation({
      orderId: scenario.orderId, requestId: `${scenario.actorId}:${scenario.orderId}:replay`, actorId: scenario.actorId, evidenceRef: "route-proof",
      resolveObligation: routeResolver, submit,
    });
    assert.deepEqual(routeReplay, { status: "blocked", reason: "ALREADY_ACCEPTED" });
    const authority = scenario.paymentFactId
      ? { paymentFactId: scenario.paymentFactId }
      : { freeAuthorizationFactId: scenario.freeAuthorizationFactId! };
    assert.equal(await drainAcceptedDispatchEffects({ orderId: scenario.orderId, authority, process: async () => { followups++; } }), "FOLLOWUPS_RECORDED");
    assert.equal(await drainAcceptedDispatchEffects({ orderId: scenario.orderId, authority, process: async () => { followups++; } }), "ALREADY_CONSUMED");
    assert.equal(followups, 1, `${scenario.actorId} follow-ons are deduplicated`);
  }
  assert.equal(providerSubmissions, 3, "paid, free, and operator follow-on drains never submit extra Lob work");
});
