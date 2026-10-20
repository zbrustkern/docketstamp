import assert from "node:assert/strict";
import {
  ADMIN_CONSOLE_CONTRACT_VERSION, AuditRecordSchema, COLLECTIONS_V1, DiagnosticSchema, DispatchCommandSchema,
  EventEnvelopeSchema, EvidenceQuerySchema, INDEXES_V1, LEGACY_EVENT_MAPPINGS_V1, LegacyEventMappingSchema, MetricSchema, MoneyFactSchema, OfferFactSchema, ProviderEventReceiptSchema,
  PostalFactSchema, ScopeSchema,
} from "../../lib/admin-console/contracts";
import { expectedOracle, referenceScenarios } from "./fixtures/reference-oracle";

const scope = {
  startUtc: "2026-10-12T05:00:00.000Z", endUtcExclusive: "2026-10-20T05:00:00.000Z",
  displayTimezone: "America/Chicago", reportVersion: 1, cohortPolicyVersion: 1,
};

assert.equal(ADMIN_CONSOLE_CONTRACT_VERSION, 1);
assert.equal(ScopeSchema.safeParse(scope).success, true);
for (const [unsupported, value] of [["campaignKey", "fixture"], ["offerId", "fixture"], ["device", "mobile"]] as const) {
  assert.equal(ScopeSchema.safeParse({ ...scope, [unsupported]: value }).success, false, `${unsupported} scope filter is rejected until projection support exists`);
}
assert.equal(ScopeSchema.safeParse({ ...scope, endUtcExclusive: scope.startUtc }).success, false, "scope uses half-open non-empty intervals");
assert.equal(ScopeSchema.safeParse({ ...scope, displayTimezone: "Mars/Olympus" }).success, false, "scope timezone must resolve as an IANA timezone");

const classifications = [...new Set(referenceScenarios.map((s) => s.classification))].sort();
assert.deepEqual(classifications, [...expectedOracle.classifications].sort());
assert.deepEqual(expectedOracle.tierRetailMinor, { first_class: 1295, certified: 1995, certified_return_receipt: 2795 });

const customerPaid = referenceScenarios.filter((s) => s.classification === "customer" && s.environment === "production" && s.paymentMode === "live" && s.paid && s.capturedMinor !== null);
assert.equal(customerPaid.length, expectedOracle.customerLiveVerifiedPaidOrders);
assert.deepEqual({ USD: customerPaid.reduce((sum, s) => sum + (s.capturedMinor ?? 0), 0) }, expectedOracle.customerLiveVerifiedCapturedMinorByCurrency);
assert.equal(new Set(customerPaid.map((s) => s.sessionId)).size, expectedOracle.customerPaidSessionsWithAtLeastOneOrder, "repeat orders count once in session conversion numerator");
assert.equal(new Set(referenceScenarios.filter((s) => s.classification === "customer" && s.environment === "production" && s.sessionId).map((s) => s.sessionId)).size, expectedOracle.customerEligibleSessionsWithEntry);
assert.deepEqual(Object.fromEntries(["first_class", "certified", "certified_return_receipt"].map((tier) => [tier, customerPaid.filter((s) => s.tier === tier).length])), expectedOracle.paidOrderCountsByTier);
assert.equal(customerPaid.some((s) => s.postal === "uncertain" || s.postal === "returned"), true, "postal state cannot erase a verified capture");
assert.equal(referenceScenarios.filter((s) => ["free_promo", "comp"].includes(s.classification) && s.paid).length, expectedOracle.freeAndCompPaidOrderCount);
assert.equal(referenceScenarios.filter((s) => ["founder", "employee", "suspected_bot", "unresolved"].includes(s.classification) && s.environment === "production" && s.paymentMode === "live" && s.paid).length, expectedOracle.internalOrUnknownLiveCaptureOrders);
assert.equal(referenceScenarios.some((s) => s.age === "stale" && s.orderId !== null), false, "stale observation is not promoted into a fresh business outcome");

const baseEvent = {
  schemaVersion: 1, product: "docketstamp", environment: "production", eventId: "evt-1", eventName: "payment_attempted",
  eventVersion: 1, occurredAt: "2026-10-19T10:00:00.000Z", receivedAt: "2026-10-19T10:00:01.000Z",
  emitter: "client", sessionId: "sess-1", journeyId: "journey-1", checkoutAttemptId: "attempt-1", safeProperties: { method: "card" },
};
assert.equal(EventEnvelopeSchema.safeParse(baseEvent).success, true);
assert.equal(EventEnvelopeSchema.safeParse({ ...baseEvent, safeProperties: { email: "person@example.invalid" } }).success, false, "private contact metadata is rejected at the contract boundary");
assert.equal(EventEnvelopeSchema.safeParse({ ...baseEvent, eventName: "payment_verified" }).success, false, "browser events cannot create financial authority");
assert.equal(EventEnvelopeSchema.safeParse({ ...baseEvent, eventName: "payment_succeeded" }).success, false, "unknown historical events require explicit legacy mapping");
assert.equal(LEGACY_EVENT_MAPPINGS_V1.every((mapping) => LegacyEventMappingSchema.safeParse(mapping).success), true);
assert.equal(LegacyEventMappingSchema.safeParse({ ...LEGACY_EVENT_MAPPINGS_V1[2], targetEventName: "signature_adopted" }).success, false, "uninspected legacy source cannot be promoted to completion");

const money = {
  schemaVersion: 1, product: "docketstamp", environment: "production", factId: "money-1", orderId: "ord-1", currency: "USD", amountMinor: 1295, kind: "capture",
  provider: "stripe", providerAccountId: "acct-fixture", providerMode: "live", providerObjectId: "pi-fixture",
  effectiveAt: "2026-10-19T10:00:00.000Z", receivedAt: "2026-10-19T10:00:01.000Z", verification: "verified", evidenceRef: "private://fixture/money-1",
};
assert.equal(MoneyFactSchema.safeParse(money).success, true);
assert.equal(ProviderEventReceiptSchema.safeParse({
  schemaVersion: 1, product: "docketstamp", environment: "production", receiptId: "stripe:acct-fixture:live:evt-fixture", provider: "stripe", providerAccountId: "acct-fixture",
  providerMode: "live", providerEventId: "evt-fixture", providerEventType: "payment_intent.succeeded", bodyDigest: "c".repeat(64),
  receivedAt: "2026-10-19T10:00:01.000Z", status: "accepted", factId: "money-1", orderId: "ord-1", diagnosticCodes: [],
}).success, true);
const postal = {
  schemaVersion: 1, product: "docketstamp", environment: "production", factId: "postal-1", orderId: "ord-1", providerEventId: "lob-event-1", providerLetterId: "letter-1",
  providerAccountId: "lob-fixture", lobMode: "live", cassMode: "live", state: "returned", providerState: "returned_to_sender",
  occurredAt: "2026-10-22T10:00:00.000Z", receivedAt: "2026-10-22T10:00:05.000Z", snapshotHash: "a".repeat(64),
  idempotencyKey: "ord-1-dispatch-v1", evidenceRef: "private://fixture/postal-1", artifactKind: "return_receipt",
};
assert.equal(PostalFactSchema.safeParse(postal).success, true);
assert.equal(MoneyFactSchema.safeParse({ ...money, amountMinor: -1 }).success, false);
assert.equal(OfferFactSchema.safeParse({
  schemaVersion: 1, offerId: "offer-1", version: 1, code: "WELCOME", status: "active", discount: { kind: "percent", percent: 100 },
  eligibleNoticeIds: ["notice-fixture"], eligibleTiers: ["first_class", "certified", "certified_return_receipt"], maxRedemptions: null, perIdentityLimit: null,
  maxBudgetMinor: 0, committedSubsidyMinor: 0, reservedSubsidyMinor: 0, maxFreeDispatches: 1, ownerActorId: "actor-owner", auditRef: "audit-1",
}).success, true);

const metric = {
  key: "observed_paid_session_conversion", value: null, unit: "ratio", numerator: null, denominator: 0,
  evidenceClass: "unavailable", source: ["business_events_v1"], definitionVersion: 1, scope,
  asOf: "2026-10-19T11:00:00.000Z", watermark: null, completeness: "partial", exclusions: { internal: 4 },
  qualityFlags: ["NO_ELIGIBLE_SESSIONS"], evidenceQueryRef: "query-1",
};
assert.equal(MetricSchema.safeParse(metric).success, true, "unavailable and zero denominator remain distinct");
assert.equal(EvidenceQuerySchema.safeParse({ queryId: "q-1", scope, entity: "money_facts", filters: {}, limit: 100, includePrivateEvidence: false }).success, true);
assert.equal(AuditRecordSchema.safeParse({
  schemaVersion: 1, auditId: "audit-1", actorId: "owner-1", actorKind: "human", capability: "offer.update", action: "offer.version", targetType: "offer", targetId: "offer-1",
  environment: "production", expectedVersion: 1, requestId: "req-1", reason: "Fixture validation", effectSummary: "Offer values changed",
  beforeRedacted: { status: "paused" }, afterRedacted: { status: "active" }, evidenceRefs: ["offer-1"], status: "succeeded", occurredAt: "2026-10-19T10:00:00.000Z",
}).success, true);
assert.equal(DispatchCommandSchema.safeParse({
  schemaVersion: 1, orderId: "ord-1", expectedOrderVersion: 1, authorizationRef: "authz-1", snapshotHash: "b".repeat(64), snapshotVersion: 1,
  paymentFactId: "money-1", currency: "USD", payableAmountMinor: 1295, tier: "first_class", lobMode: "live", cassMode: "live",
  idempotencyKey: "ord-1-dispatch-v1", actorId: "owner-1", requestId: "req-1", reason: "Retry after reconciliation",
}).success, true);
assert.equal(DispatchCommandSchema.safeParse({
  schemaVersion: 1, orderId: "ord-1", expectedOrderVersion: 1, authorizationRef: "authz-1", snapshotHash: "b".repeat(64), snapshotVersion: 1,
  paymentFactId: "money-1", freeAuthorizationFactId: "free-1", currency: "USD", payableAmountMinor: 1295, tier: "first_class", lobMode: "live", cassMode: "live",
  idempotencyKey: "ord-1-dispatch-v1", actorId: "owner-1", requestId: "req-1", reason: "Invalid both authorities",
}).success, false);
assert.equal(DiagnosticSchema.safeParse({ code: "AMOUNT_MISMATCH", severity: "critical", component: "stripe-reconcile", occurredAt: "2026-10-19T10:00:00.000Z", retryable: false }).success, true);
assert.equal(COLLECTIONS_V1.length, 12);
assert.equal(INDEXES_V1.length >= 8, true);

console.log("admin-console contract v1 oracle passed: schemas, classifications, tiers, cash authority and non-synthetic cohorts");
