import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { before, after } from "node:test";
import { NextRequest } from "next/server";
import { POST as lockAndIntentPost } from "../app/api/docket/lock-and-intent/route";
import { POST as completeFreeOrderPost } from "../app/api/checkout/complete-free-order/route";
import { POST as legacyCreateIntentPost } from "../app/api/checkout/create-intent/route";
import { getOrderById, getOrderByLobLetterId, getOrdersCollection, saveDiscountCode, updateOrderStatus } from "../lib/firebase-admin";
import { processPaidOrder } from "../lib/order-processor";
import { dispatchAuthorizedObligation } from "../lib/admin-console/postal/dispatch";
import { serverEnvironment } from "../lib/admin-console/commands/access";
import { classifyLegacyOrder, planLegacyOrderMigration } from "../lib/legacy-order-migration";
import { readOrderRecord, resolvePostalProvenance, validateFrozenNoticeOrder } from "../lib/order-record";

const originalEnv = { ...process.env };
before(() => {
  process.env.ALLOW_LOCAL_MOCK_PAYMENTS = "true";
  process.env.LOB_ENV = "staging_mock_cass";
  delete process.env.LOB_DISPATCH_API_KEY;
});
after(() => { process.env = originalEnv; });

const userValues = {
  senderFullName: "Taylor Morgan",
  senderAddressLine1: "77 Lake Street, Unit 5",
  senderCity: "Chicago",
  senderState: "IL",
  senderZip: "60601",
  recipientFormalName: "Carmel Property Group",
  recipientAddressLine1: "18 Main Street",
  recipientCity: "Carmel",
  recipientState: "IN",
  recipientZip: "46032",
  propertyState: "IN",
  vacatedPremisesAddress: "77 Lake Street, Unit 5, Chicago, IL 60601",
  moveOutDate: "2026-09-01",
  depositAmount: "$1,500.00",
  amountReceivedToDate: "$0.00",
  balanceRequested: "$1,500.00",
  responseDays: "14 calendar days",
};

function lockRequest(discountCode?: string) {
  return new NextRequest("http://localhost:3000/api/docket/lock-and-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: "security-deposit-return-demand-letter",
      tier: "certified",
      customerEmail: "order-fixture@example.test",
      userValues,
      ...(discountCode ? { discountCode } : {}),
      signatureAdoption: { adopted: true, affirmed: true, signerName: "Taylor Morgan" },
    }),
  });
}

test("legacy provider adapter keeps a real Handwrytten reference away from Lob", async () => {
  const legacy = { id: `old_${Date.now()}`, handwryttenOrderId: "hw_real_legacy_1", status: "MAILED" };
  const resolved = resolvePostalProvenance(legacy);
  assert.deepEqual(resolved, { provider: "handwrytten", reference: "hw_real_legacy_1", evidence: "legacy_field" });
  assert.equal(readOrderRecord(legacy).kind, "legacy");
  assert.equal(classifyLegacyOrder(legacy).provider, "handwrytten");
  assert.deepEqual(resolvePostalProvenance({ id: "conflict", lobLetterId: "ltr_1", handwryttenOrderId: "hw_1" }), {
    provider: "unknown", reference: "hw_1", evidence: "conflict",
  });
  assert.equal(resolvePostalProvenance({ postalProvider: "lob", postalProviderReference: "ltr_explicit" }).reference, "ltr_explicit");
  await getOrdersCollection().doc(legacy.id).set(legacy);
  assert.equal(await getOrderByLobLetterId("hw_real_legacy_1"), null);
});

test("card checkout returns a retired response before any PaymentIntent can be created", async () => {
  const response = await legacyCreateIntentPost();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).code, "LEGACY_CHECKOUT_UNSUPPORTED");
});

test("paid notice orders freeze before payment and reject post-freeze edits", async () => {
  const lockResponse = await lockAndIntentPost(lockRequest());
  assert.equal(lockResponse.status, 200);
  const locked = await lockResponse.json();
  const order = await getOrderById(locked.orderId);
  assert.equal(order?.schemaVersion, 2);
  assert.equal(order?.kind, "notice");
  assert.equal(order?.documentIntegrityEvidence?.digest, createHash("sha256").update(order!.documentHtml!, "utf8").digest("hex"));
  assert.equal(validateFrozenNoticeOrder(order!), null);

  const edited = `${order!.documentHtml}<p>mutated after payment lock</p>`;
  await updateOrderStatus(order!.id, { documentHtml: edited });
  const rejected = await processPaidOrder(order!.id, `pi_mock_${order!.id}`, order!.customerEmail, { isTest: true, paymentMode: "local_mock" });
  assert.equal(rejected.success, false);
  assert.equal(rejected.status, "SNAPSHOT_DIGEST_MISMATCH");
  const stillUnsent = await getOrderById(order!.id);
  assert.equal(stillUnsent?.lobLetterId, undefined);
  assert.equal(stillUnsent?.postalProvider, "unknown");
});

test("100% discount keeps the frozen notice and free authorization without claiming a Lob letter", async () => {
  const code = `FREE${Date.now()}`;
  await saveDiscountCode({
    id: code, code, type: "PERCENTAGE", value: 100, isActive: true, usedCount: 0,
    totalDiscountGivenCents: 0, createdAt: Date.now(), updatedAt: Date.now(),
  });
  const lockResponse = await lockAndIntentPost(lockRequest(code));
  assert.equal(lockResponse.status, 200);
  const locked = await lockResponse.json();
  assert.equal(locked.isFree, true);
  assert.equal(locked.clientSecret, null);
  const prePayment = await getOrderById(locked.orderId);
  assert.equal(prePayment?.paymentMethod, "PROMO_CODE");
  assert.equal(validateFrozenNoticeOrder(prePayment!), null);

  const freeResponse = await completeFreeOrderPost(new NextRequest("http://localhost:3000/api/checkout/complete-free-order", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: locked.orderId, discountCode: code }),
  }));
  assert.equal(freeResponse.status, 200);
  const result = await freeResponse.json();
  assert.equal(result.simulated, true);
  const completed = await getOrderById(locked.orderId);
  assert.equal(completed?.status, "QUEUED_FOR_FULFILLMENT");
  assert.equal(completed?.lobLetterId, undefined);
  assert.equal(completed?.postalProvider, "unknown");
  assert.equal(completed?.documentHtml, prePayment?.documentHtml);
  assert.equal(completed?.documentIntegrityEvidence?.digest, prePayment?.documentIntegrityEvidence?.digest);
});

test("legacy migration is resumable, reconciles counts, and leaves source snapshots untouched", () => {
  const records = JSON.parse(readFileSync("tests/fixtures/orders/legacy-orders.json", "utf8"));
  const original = structuredClone(records);
  const first = planLegacyOrderMigration({ records, runId: "test-run", batchSize: 4, now: new Date("2026-10-20T00:00:00.000Z") });
  assert.equal(first.dryRun, true);
  assert.equal(first.changes.length, 2);
  assert.equal(first.checkpoint.complete, false);
  assert.ok(first.checkpoint.nextOrderId);
  assert.equal(first.afterCounts.lob, first.beforeCounts.lob);
  assert.equal(first.afterCounts.handwrytten, first.beforeCounts.handwrytten);

  const resumed = planLegacyOrderMigration({ records, runId: "test-run", batchSize: 10, priorManifest: first, now: new Date("2026-10-20T00:01:00.000Z") });
  assert.equal(resumed.checkpoint.complete, true);
  assert.equal(resumed.processedOrderIds.length, records.length);
  assert.equal(resumed.changes.length, 2);
  assert.equal(resumed.quarantined.some((entry) => entry.reason === "PROVIDER_PROVENANCE_CONFLICT"), true);
  assert.equal(resumed.rollbackMappings.length, 2);
  assert.deepEqual(records, original);
  assert.deepEqual(resumed.changes.map((entry) => entry.patch), [
    { postalProvider: "handwrytten", postalProviderReference: "hw_fixture_002" },
    { postalProvider: "lob", postalProviderReference: "ltr_fixture_lob_001" },
  ]);
});

test("paid/free retry claims permit only one provider submission", async () => {
  let submissions = 0;
  const retryOrderId = `order_retry_once_fixture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const resolveObligation = async (orderId: string) => ({
    verified: true as const,
    orderId,
    version: 1,
    environment: serverEnvironment(),
    freeAuthorizationFactId: "free_authority_fixture",
    material: {
      documentHtml: "<html>frozen fixture</html>", snapshotHash: "a".repeat(64), snapshotVersion: 1,
      docketId: "DS-2026-ABC123", noticeId: "notice_fixture", tier: "certified" as const,
      currency: "USD", payableAmountMinor: 0,
      recipientAddress: { name: "Recipient", address_line1: "1 Main", address_city: "Austin", address_state: "TX", address_zip: "78701" },
      returnAddress: { name: "Sender", address_line1: "2 Main", address_city: "Austin", address_state: "TX", address_zip: "78701" },
    },
  });
  const submit = async () => {
    submissions += 1;
    return { success: true, mode: "mock" as const, isSimulatedMock: false, letterId: "ltr_fixture_once" };
  };
  const first = await dispatchAuthorizedObligation({
    orderId: retryOrderId, requestId: "request_1", actorId: "test:operator", evidenceRef: "test",
    resolveObligation, submit,
  });
  const duplicate = await dispatchAuthorizedObligation({
    orderId: retryOrderId, requestId: "request_2", actorId: "test:operator", evidenceRef: "test",
    resolveObligation, submit,
  });
  assert.equal(first.status, "accepted", JSON.stringify(first));
  assert.equal(duplicate.status, "blocked");
  assert.equal(submissions, 1);
});
