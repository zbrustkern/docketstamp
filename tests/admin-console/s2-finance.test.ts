import assert from "node:assert/strict";
import type Stripe from "stripe";
import { firestoreDb } from "@/lib/firebase-admin";
import {
  computeOrderSnapshotHash,
  getVerifiedPaymentObligation,
  recordPaymentAuthority,
} from "@/lib/admin-console/finance/authority";
import { ingestStripeEvidenceEvent } from "@/lib/admin-console/finance/stripe-events";
import { reconcileStripeEvidencePage } from "@/lib/admin-console/finance/reconcile";

Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_offline", STRIPE_ACCOUNT_ID: "acct_offline" });

const address = {
  firstName: "Alex", lastName: "Example", street1: "100 Main St", city: "Chicago", state: "IL", zip: "60601",
};
function order(id: string) {
  return {
    id, customerEmail: "alex@example.test", noticeId: "consumer-rights", noticeType: "consumer-rights",
    serviceLevel: "CERTIFIED" as const, recipientAddress: { ...address }, returnAddress: { ...address },
    documentHtml: "<html>Frozen</html>", status: "PENDING_PAYMENT" as const,
    amountInCents: 1200, finalAmountInCents: 1200, paymentMethod: "STRIPE" as const,
    createdAt: 1, updatedAt: 1,
  };
}
function paymentIntent(id: string, orderId: string, amount = 1200): Stripe.PaymentIntent {
  return {
    id, object: "payment_intent", amount, amount_received: amount, currency: "usd", status: "succeeded",
    livemode: false, metadata: { orderId },
  } as unknown as Stripe.PaymentIntent;
}
function event(id: string, type: string, object: unknown, created = 1_800_000_000): Stripe.Event {
  return { id, object: "event", api_version: "2024-06-20", created, data: { object }, livemode: false, pending_webhooks: 0, request: null, type } as unknown as Stripe.Event;
}

async function main() {
  const orders = firestoreDb.collection("orders");
  await orders.doc("order-capture").set(order("order-capture"));
  const context = { eventId: "evt-capture", eventType: "payment_intent.succeeded", eventLivemode: false, accountId: "acct_offline", occurredAt: 1_800_000_000_000, receivedAt: 1_800_000_001_000 };
  const accepted = await recordPaymentAuthority(paymentIntent("pi-capture", "order-capture"), context);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.status, "accepted");
  assert.ok(accepted.paymentFactId);

  const proof = await getVerifiedPaymentObligation("order-capture");
  assert.ok(proof);
  assert.equal(proof.paymentFact.amountMinor, 1200);
  assert.equal(proof.paymentFact.effectiveAt, new Date(context.occurredAt).toISOString());
  assert.equal(proof.outbox.status, "pending");
  assert.equal(proof.snapshotHash, computeOrderSnapshotHash(proof.order));

  const duplicate = await recordPaymentAuthority(paymentIntent("pi-capture", "order-capture"), context);
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.duplicate, true);

  const receipt = (await firestoreDb.collection("provider_event_receipts_v1").doc(accepted.receiptId).get()).data() as Record<string, unknown>;
  assert.equal("rawBody" in receipt, false);
  assert.equal("documentHtml" in receipt, false);

  await orders.doc("order-capture").update({ recipientAddress: { ...address, street1: "200 Main St" } });
  assert.equal(await getVerifiedPaymentObligation("order-capture"), null, "snapshot changes invalidate dispatch proof");

  await orders.doc("order-wrong-amount").set(order("order-wrong-amount"));
  const wrongAmount = await recordPaymentAuthority(paymentIntent("pi-wrong", "order-wrong-amount", 1199), {
    ...context, eventId: "evt-wrong-amount",
  });
  assert.equal(wrongAmount.accepted, false);
  assert.ok(wrongAmount.diagnosticCodes.includes("AMOUNT_MISMATCH"));
  assert.equal(await getVerifiedPaymentObligation("order-wrong-amount"), null);

  await orders.doc("order-refund").set(order("order-refund"));
  const refundCapture = await recordPaymentAuthority(paymentIntent("pi-refund", "order-refund"), {
    ...context, eventId: "evt-refund-capture",
  });
  assert.equal(refundCapture.accepted, true);
  const pendingRefund = await ingestStripeEvidenceEvent(event("evt-refund-pending", "refund.updated", {
    id: "re_pending", object: "refund", status: "pending", amount: 500, currency: "usd",
    created: 1_800_000_010, payment_intent: "pi-refund", balance_transaction: null,
  }));
  assert.equal(pendingRefund.accepted, true);
  assert.equal(pendingRefund.status, "accepted");
  const pendingRows = await firestoreDb.collection("payment_facts_v1").where("orderId", "==", "order-refund").get();
  assert.equal(pendingRows.docs.length, 1, "pending refund is receipt state, not a cash fact");

  const failedIntent = await ingestStripeEvidenceEvent(event("evt-intent-failed", "payment_intent.payment_failed", {
    id: "pi-refund", object: "payment_intent", status: "requires_payment_method", amount: 1200,
    amount_received: 0, currency: "usd", livemode: false, metadata: { orderId: "order-refund" },
  }));
  assert.equal(failedIntent.accepted, true);
  const failedIntentReceipts = await firestoreDb.collection("provider_event_receipts_v1")
    .where("providerEventId", "==", "evt-intent-failed").get();
  assert.equal(failedIntentReceipts.docs[0].data()?.providerState, "failed");

  const refund = await ingestStripeEvidenceEvent(event("evt-refund-done", "refund.updated", {
    id: "re_done", object: "refund", status: "succeeded", amount: 500, currency: "usd",
    created: 1_800_000_020,
    payment_intent: "pi-refund", balance_transaction: { id: "txn-refund", object: "balance_transaction" },
  }));
  assert.equal(refund.accepted, true);
  const cashFacts = await firestoreDb.collection("payment_facts_v1").where("orderId", "==", "order-refund").get();
  assert.equal(cashFacts.docs.length, 2);
  assert.equal((cashFacts.docs.find((row) => row.data()?.kind === "refund")?.data() as Record<string, unknown>).amountMinor, 500);

  await orders.doc("order-dispute").set(order("order-dispute"));
  await recordPaymentAuthority(paymentIntent("pi-dispute", "order-dispute"), { ...context, eventId: "evt-dispute-capture" });
  const dispute = await ingestStripeEvidenceEvent(event("evt-dispute-created", "charge.dispute.created", {
    id: "dp_test", object: "dispute", status: "needs_response", charge: "ch_test", payment_intent: "pi-dispute",
    balance_transactions: [
      { id: "txn-dispute-a", amount: -900, currency: "usd", created: 1_800_000_030 },
      { id: "txn-dispute-b", amount: -100, currency: "usd", created: 1_800_000_031 },
    ],
  }));
  assert.equal(dispute.accepted, true);
  const disputeFacts = await firestoreDb.collection("payment_facts_v1").where("orderId", "==", "order-dispute").get();
  assert.equal(disputeFacts.docs.filter((row) => row.data()?.kind === "dispute_debit").length, 2);

  const calls: unknown[] = [];
  const reconcileEnd = Math.floor(Date.now() / 1000);
  const summary = await reconcileStripeEvidencePage({
    limit: 10, startAtSeconds: reconcileEnd - 100, endAtSeconds: reconcileEnd,
  }, { events: { list: async (params: unknown) => { calls.push(params); return { data: [], has_more: false }; } } } as unknown as Stripe);
  assert.equal(summary.status, "complete");
  assert.equal(calls.length, 1);
  const outbox = await firestoreDb.collection("business_outbox_v1").get();
  assert.equal(outbox.docs.length, 3, "reconciliation records evidence and never creates extra dispatch obligations");

  // Exercise the actual event adapter, which must pass provider effective time.
  await orders.doc("order-event-adapter").set(order("order-event-adapter"));
  const normalizedCapture = await ingestStripeEvidenceEvent(event("evt-adapter-capture", "payment_intent.succeeded", paymentIntent("pi-adapter", "order-event-adapter"), 1_800_000_040));
  assert.equal(normalizedCapture.accepted, true, "succeeded event adapter must supply authority's occurredAt contract");
  const adapterProof = await getVerifiedPaymentObligation("order-event-adapter");
  assert.equal(adapterProof?.paymentFact.effectiveAt, new Date(1_800_000_040_000).toISOString());

  // One cash movement cannot be recorded as both a refund and a dispute loss.
  const duplicateCash = await ingestStripeEvidenceEvent(event("evt-conflicting-cash", "charge.dispute.created", {
    id: "dp_cash_conflict", status: "needs_response", charge: "ch_test", payment_intent: "pi-refund",
    balance_transactions: [{ id: "txn-refund", amount: -500, currency: "usd", created: 1_800_000_020 }],
  }));
  assert.equal(duplicateCash.accepted, false, "same balance transaction in another cash kind must quarantine");
  const refundFacts = await firestoreDb.collection("payment_facts_v1").where("orderId", "==", "order-refund").get();
  assert.equal(refundFacts.docs.filter(row => ['refund','dispute_debit'].includes(row.data()?.kind)).length, 1);

  console.log("S2 financial authority, evidence normalization, and evidence-only reconciliation passed in isolated mock Firestore.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
