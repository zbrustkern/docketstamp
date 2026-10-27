import assert from "node:assert/strict";
import test from "node:test";
import { assertFulfillmentDispatchAllowed, CheckoutAttemptDispatchBlockedError } from "../src/lib/checkout-attempts/contract";
import { decideDispatchStart } from "../lib/admin-console/postal/model";

test("checkout attempt gate allows only settled paid/free orders and preserves legacy orders", () => {
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: "legacy-order" }));
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: "paid-order", attemptId: "ca_paid", state: "paid" }));
  assert.doesNotThrow(() => assertFulfillmentDispatchAllowed({ orderId: "free-order", attemptId: "ca_free", state: "free_authorized" }));

  for (const state of ["payment_processing", "cancellation_pending", "superseding", "outcome_unknown", "captured_exception", "paid_exception", "superseded", "cancelled"]) {
    assert.throws(
      () => assertFulfillmentDispatchAllowed({ orderId: "held-order", attemptId: "ca_held", state }),
      (error) => error instanceof CheckoutAttemptDispatchBlockedError && error.code === "CHECKOUT_ATTEMPT_NOT_DISPATCHABLE",
    );
  }
  assert.throws(() => assertFulfillmentDispatchAllowed({ orderId: "old", attemptId: "ca_old", state: "paid", supersededBy: "ca_new" }));
});

test("expired postal leases and ambiguous provider outcomes require reconciliation before another submit", () => {
  const base = { authorized: true, expectedSnapshotHash: "hash", actualSnapshotHash: "hash", now: "2026-10-26T12:00:00.000Z" };
  assert.equal(decideDispatchStart({ ...base, currentState: "uncertain" }), "reconcile_uncertain");
  assert.equal(decideDispatchStart({ ...base, currentState: "submitting", leaseExpiresAt: "2026-10-26T11:59:00.000Z" }), "reconcile_uncertain");
  assert.equal(decideDispatchStart({ ...base, currentState: "submitting", leaseExpiresAt: "2026-10-26T12:01:00.000Z" }), "active_lease");
  assert.equal(decideDispatchStart({ ...base, currentState: "uncertain", reconciliationConfirmedNoAcceptance: true }), "start");
});
