import assert from "node:assert/strict";
import {
  decideDispatchStart, normalizeLobArtifactSignal, normalizeLobEventState, projectPostalEvidence,
} from "../../lib/admin-console/postal/model";

assert.equal(normalizeLobEventState("letter.certified.delivered"), "delivered");
assert.equal(normalizeLobEventState("letter.returned"), "unmapped", "unknown event names remain visible instead of substring matching");
assert.equal(normalizeLobEventState("letter.return_envelope.returned_to_sender"), "unmapped", "return receipt events do not change the outbound letter state");
assert.equal(normalizeLobArtifactSignal("letter.rendered_pdf"), "proof_rendered");
assert.equal(normalizeLobArtifactSignal("letter.return_envelope.in_transit"), "return_receipt_tracking_event");
assert.equal(normalizeLobArtifactSignal("letter.delivered"), "none");

const delivered = { state: "delivered" as const, occurredAt: "2026-10-19T12:00:00.000Z", receivedAt: "2026-10-19T12:00:05.000Z", providerEventId: "evt-delivered" };
const oldMailed = { state: "mailed" as const, occurredAt: "2026-10-18T12:00:00.000Z", receivedAt: "2026-10-20T12:00:00.000Z", providerEventId: "evt-mailed-late" };
assert.deepEqual(projectPostalEvidence(delivered, oldMailed), { current: delivered, disposition: "appended_older", reviewRequired: false });
const laterReturned = { state: "returned" as const, occurredAt: "2026-10-21T12:00:00.000Z", receivedAt: "2026-10-21T12:00:01.000Z", providerEventId: "evt-returned-later" };
assert.equal(projectPostalEvidence(delivered, laterReturned).current?.state, "returned", "a later returned scan can follow a delivered scan");
assert.equal(projectPostalEvidence(delivered, { ...delivered, providerEventId: "evt-conflicting", state: "returned" }).reviewRequired, true, "same source time with conflicting facts needs review");
assert.equal(projectPostalEvidence(delivered, delivered, new Set(["evt-delivered"])).disposition, "duplicate");

const base = { authorized: true, expectedSnapshotHash: "a".repeat(64), actualSnapshotHash: "a".repeat(64), now: "2026-10-19T12:00:00.000Z" };
assert.equal(decideDispatchStart({ ...base, currentState: "none" }), "start");
assert.equal(decideDispatchStart({ ...base, authorized: false, currentState: "none" }), "authority_missing");
assert.equal(decideDispatchStart({ ...base, actualSnapshotHash: null, currentState: "none" }), "snapshot_mismatch");
assert.equal(decideDispatchStart({ ...base, currentState: "accepted" }), "already_accepted");
assert.equal(decideDispatchStart({ ...base, currentState: "uncertain" }), "reconcile_uncertain");
assert.equal(decideDispatchStart({ ...base, currentState: "uncertain", reconciliationConfirmedNoAcceptance: true }), "start");
assert.equal(decideDispatchStart({ ...base, currentState: "submitting", leaseExpiresAt: "2026-10-19T12:01:00.000Z" }), "active_lease");
assert.equal(decideDispatchStart({ ...base, currentState: "submitting", leaseExpiresAt: "2026-10-19T11:59:00.000Z" }), "reconcile_uncertain");
assert.equal(decideDispatchStart({ ...base, currentState: "submitting", leaseExpiresAt: "2026-10-19T11:59:00.000Z", reconciliationConfirmedNoAcceptance: true }), "start");

console.log("admin-console postal model passed: exact provider mapping, append-only ordering and dispatch retry guards");
