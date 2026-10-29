import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as postLobWebhook } from "../app/api/webhooks/lob/route";
import { firestoreDb, getOrderById, saveOrder } from "../lib/firebase-admin";
import { processPaidOrder } from "../lib/order-processor";
import type { Order, OrderStatus } from "../lib/types";

const testEnv = process.env as Record<string, string | undefined>;
testEnv.NODE_ENV = "test";
testEnv.USE_MOCK_FIRESTORE = "true";
testEnv.LOB_WEBHOOK_SECRET = "lob-webhook-test-secret-high-entropy-2026";

function orderFixture(id: string, overrides: Record<string, unknown> = {}): Order {
  const documentHtml = '<html><body>Frozen notice DOCKET RECORD & DISPATCH CERTIFICATION</body></html>';
  return {
    noticeId: 'security-deposit-return-demand-letter', noticeType: 'security-deposit-return-demand-letter',
    docketId: 'DS-2026-FIXTURE', serviceLevel: 'CERTIFIED', documentHtml,
    documentIntegrityEvidence: {
      schemaVersion: 1, algorithm: 'sha256', digest: crypto.createHash('sha256').update(documentHtml).digest('hex'),
      lockedAt: 100, signatureAdoption: { signerName: 'Sender Example', adoptedAt: 99, affirmationVersion: 'signature-adoption-v1' },
    },
    id,
    customerEmail: "tracking-test@example.com",
    status: "DISPATCHED_TO_USPS",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    amountInCents: 900,
    recipientAddress: {
      firstName: "Recipient", lastName: "Example", street1: "1 Recipient Way",
      city: "Chicago", state: "IL", zip: "60601", country: "US",
    },
    returnAddress: {
      firstName: "Sender", lastName: "Example", street1: "2 Sender Way",
      city: "Chicago", state: "IL", zip: "60602", country: "US",
    },
    ...overrides,
  } as Order;
}

function webhookRequest(payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", testEnv.LOB_WEBHOOK_SECRET!)
    .update(rawBody, "utf8")
    .digest("hex");
  return new NextRequest("http://localhost:3000/api/webhooks/lob", {
    method: "POST",
    headers: { "Content-Type": "application/json", "lob-signature": signature },
    body: rawBody,
  });
}

async function sendEvent(payload: Record<string, unknown>) {
  return await postLobWebhook(webhookRequest(payload));
}

function event(id: string, type: string, created: number, orderId: string, trackingNumber: string) {
  return {
    id,
    created,
    event_type: { id: type },
    body: {
      id: "lob-letter-monotonic-test",
      metadata: { order_id: orderId },
      tracking_number: trackingNumber,
    },
  };
}

test("concurrent replay and out-of-order Lob events preserve monotonic postal status", async () => {
  const id = `lob-monotonic-${Date.now()}`;
  await saveOrder(orderFixture(id, {
    postalProvider: "lob",
    postalProviderReference: "lob-letter-monotonic-test",
    lobLetterId: "lob-letter-monotonic-test",
    lobTrackingNumber: undefined,
  }));

  const delivered = event("evt-delivered-monotonic", "letter.delivered", 1_780_000_000, id, "tracking-delivered");
  const parallel = await Promise.all([sendEvent(delivered), sendEvent(delivered)]);
  const parallelBodies = await Promise.all(parallel.map((response) => response.json() as Promise<Record<string, unknown>>));
  assert.equal(parallel.every((response) => response.status === 200), true);
  assert.equal(parallelBodies.filter((body) => body.duplicate === true).length, 1);

  const transit = await sendEvent(event("evt-old-transit", "letter.in_transit", 1_770_000_000, id, "tracking-stale"));
  const mailed = await sendEvent(event("evt-old-mailed", "letter.mailed", 1_760_000_000, id, "tracking-stale"));
  assert.equal(transit.status, 200);
  assert.equal(mailed.status, 200);

  const stored = await getOrderById(id) as (Order & Record<string, unknown>);
  assert.equal(stored.status, "DELIVERED");
  assert.equal(stored.lobStatus, "letter.delivered");
  assert.equal(stored.lobTrackingNumber, "tracking-delivered");
  assert.equal((stored.lobTrackingEvents as Array<Record<string, unknown>>).length, 3);
  const postalFacts = await firestoreDb.collection("postal_facts_v1").where("orderId", "==", id).get();
  assert.equal(postalFacts.size, 3, "Each unique provider status creates one postal fact; duplicate delivery creates none.");
  assert.deepEqual(new Set(postalFacts.docs.map((doc: any) => doc.data().state)), new Set(["delivered", "in_transit", "mailed"]));
});

test("an exact historical Lob reference still accepts its signed tracking event", async () => {
  const id = `lob-legacy-${Date.now()}`;
  await saveOrder(orderFixture(id, { lobLetterId: "lob-letter-monotonic-test" }));
  const response = await sendEvent(event("evt-historical-exact", "letter.in_transit", 1_780_000_100, id, "tracking-historical"));
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(body.matched, true);
  assert.equal(body.status, "IN_TRANSIT");
  assert.equal((await getOrderById(id))?.lobLetterId, "lob-letter-monotonic-test");
});

test("provider conflict or non-Lob provenance is rejected without mutating tracking", async () => {
  const conflictId = `lob-conflict-${Date.now()}`;
  await saveOrder(orderFixture(conflictId, {
    postalProvider: "lob",
    postalProviderReference: "different-lob-reference",
    lobLetterId: "lob-letter-monotonic-test",
  }));
  const conflictResponse = await sendEvent(event("evt-conflict", "letter.delivered", 1_780_000_200, conflictId, "tracking-conflict"));
  assert.equal((await conflictResponse.json() as Record<string, unknown>).matched, false);
  assert.equal((await getOrderById(conflictId))?.status, "DISPATCHED_TO_USPS");

  const providerId = `lob-provider-reject-${Date.now()}`;
  await saveOrder(orderFixture(providerId, { handwryttenOrderId: "lob-letter-monotonic-test" }));
  const providerResponse = await sendEvent(event("evt-provider-mismatch", "letter.delivered", 1_780_000_300, providerId, "tracking-wrong-provider"));
  assert.equal((await providerResponse.json() as Record<string, unknown>).matched, false);
  assert.equal((await getOrderById(providerId))?.status, "DISPATCHED_TO_USPS");

  const unknownId = `lob-unknown-provider-${Date.now()}`;
  await saveOrder(orderFixture(unknownId, {
    postalProvider: "unknown",
    postalProviderReference: "unresolved-reference",
  }));
  const unknownResponse = await sendEvent(event("evt-unknown-provider", "letter.delivered", 1_780_000_400, unknownId, "tracking-unknown"));
  assert.equal((await unknownResponse.json() as Record<string, unknown>).matched, false);
  assert.equal((await getOrderById(unknownId))?.status, "DISPATCHED_TO_USPS");
});

test("already-submitted postal statuses are duplicate guards and never redispatch", async () => {
  const submittedStatuses: OrderStatus[] = [
    "DISPATCHED_TO_USPS", "MAILED", "IN_TRANSIT", "DELIVERED", "RETURNED_TO_SENDER",
  ];
  for (const [index, status] of submittedStatuses.entries()) {
    const id = `processor-postal-duplicate-${Date.now()}-${index}`;
    await saveOrder(orderFixture(id, { status }));
    const result = await processPaidOrder(id, `pi_mock_duplicate_${index}`);
    assert.equal(result.success, true, `${status} returns idempotent success`);
    assert.equal(result.alreadyProcessed, true, `${status} is never dispatched again`);
    assert.equal(result.status, status);
    assert.equal((await getOrderById(id))?.status, status);
  }
});
