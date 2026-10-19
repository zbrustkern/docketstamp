import { z } from "zod";

/** Stable, additive contracts for the CEO console. No storage adapter lives here. */
export const ADMIN_CONSOLE_CONTRACT_VERSION = 1 as const;
export const PRODUCT = "docketstamp" as const;

export const EnvironmentSchema = z.enum(["local", "staging", "production"]);
export const PaymentModeSchema = z.enum(["live", "test", "mock", "unknown"]);
export const LobModeSchema = z.enum(["live", "test_api", "mock", "unknown"]);
export const CassModeSchema = z.enum(["live", "staging_mock_cass", "unknown"]);
export const MailTierSchema = z.enum(["first_class", "certified", "certified_return_receipt"]);
export const ClassificationSchema = z.enum([
  "customer", "founder", "employee", "automated_test", "comp", "free_promo", "suspected_bot", "unresolved",
]);
export const EvidenceClassSchema = z.enum(["observed", "verified", "inferred", "estimated", "unavailable"]);
export const CompletenessSchema = z.enum(["complete_within_scope", "partial", "stale", "unavailable"]);
export const DiagnosticCodeSchema = z.enum([
  "CONFIG_MISSING", "AUTH_DENIED", "SCOPE_DENIED", "STALE_VERSION", "PROVIDER_TIMEOUT", "PROVIDER_REJECTED",
  "DUPLICATE_CONFLICT", "MISSING_ORDER", "AMOUNT_MISMATCH", "CURRENCY_MISMATCH", "MODE_MISMATCH",
  "SNAPSHOT_MISMATCH", "UNMAPPED_PROVIDER_STATE", "LATE_EVENT", "CLOCK_SKEW", "JOIN_UNAVAILABLE",
  "RATE_LIMITED", "VALIDATION_FAILED", "STORAGE_UNAVAILABLE", "RECONCILIATION_REQUIRED", "REDACTED",
]);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const UtcInstantSchema = z.string().datetime({ offset: true });
const IdSchema = z.string().min(1).max(160);
const SafeTextSchema = z.string().max(240);
const SafeRefSchema = z.string().min(1).max(300);
const SafeAnalyticsStringSchema = z.string().max(80).regex(/^[A-Za-z0-9_.:-]+$/);
const SafePropertiesSchema = z.record(z.string(), z.union([SafeAnalyticsStringSchema, z.number().finite(), z.boolean(), z.null()]))
  .superRefine((properties, ctx) => {
    if (Object.keys(properties).length > 30) ctx.addIssue({ code: "custom", message: "too many event properties" });
    const allowedKeys = new Set(["method", "result", "reasonCode", "sourceCategory", "referrerCategory", "role", "mode", "postalState", "tier", "offerState", "stage", "templateVersion", "experienceVersion", "durationBucket"]);
    for (const [key, value] of Object.entries(properties)) {
      if (!allowedKeys.has(key)) ctx.addIssue({ code: "custom", path: [key], message: "property key is outside the safe analytics allowlist" });
      if (typeof value === "string" && (/@/.test(value) || /https?:\/\//i.test(value) || /[?&](token|email|address|q)=/i.test(value))) {
        ctx.addIssue({ code: "custom", path: [key], message: "value resembles private contact or URL data" });
      }
    }
  });

export const ScopeSchema = z.object({
  startUtc: UtcInstantSchema,
  endUtcExclusive: UtcInstantSchema,
  displayTimezone: z.string().min(1).max(80),
  environment: EnvironmentSchema.optional(),
  noticeId: IdSchema.optional(),
  tier: MailTierSchema.optional(),
  entrySurface: IdSchema.optional(),
  channel: IdSchema.optional(),
  campaignKey: IdSchema.optional(),
  offerId: IdSchema.optional(),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  classification: ClassificationSchema.optional(),
  reportVersion: z.number().int().positive(),
  cohortPolicyVersion: z.number().int().positive(),
}).refine((v) => Date.parse(v.startUtc) < Date.parse(v.endUtcExclusive), "scope must be a non-empty half-open interval")
  .refine((v) => {
    try { new Intl.DateTimeFormat("en-US", { timeZone: v.displayTimezone }); return true; }
    catch { return false; }
  }, "displayTimezone must be a supported IANA timezone");

export const AttributionTouchSchema = z.object({
  touchId: IdSchema,
  kind: z.enum(["acquisition", "offer", "recovery"]),
  observedAt: UtcInstantSchema,
  source: SafeTextSchema.optional(),
  medium: SafeTextSchema.optional(),
  campaignId: SafeTextSchema.optional(),
  platformAccountId: SafeTextSchema.optional(),
  entrySurface: SafeTextSchema.optional(),
  consent: z.enum(["granted", "denied", "unknown"]),
});

export const IdentityClassificationSchema = z.object({
  classificationId: IdSchema,
  primary: ClassificationSchema,
  overlappingFacts: z.array(ClassificationSchema).default([]),
  evidenceRefs: z.array(SafeRefSchema).max(30),
  policyVersion: z.number().int().positive(),
  classifiedAt: UtcInstantSchema,
});

export const EventEnvelopeSchema = z.object({
  schemaVersion: z.literal(ADMIN_CONSOLE_CONTRACT_VERSION),
  product: z.literal(PRODUCT),
  environment: EnvironmentSchema,
  eventId: IdSchema,
  eventName: z.enum([
    "entry_viewed", "notice_selected", "workspace_viewed", "details_ready", "signature_adopted",
    "address_verification_result", "checkout_viewed", "document_locked", "payment_form_ready",
    "payment_attempted", "payment_client_result", "legacy_intent_initialized", "payment_verified", "free_order_authorized",
    "fulfillment_submission_started", "fulfillment_accepted", "fulfillment_uncertain", "fulfillment_failed",
    "postal_event_received", "proof_available", "receipt_email_result", "stage_created", "stage_opened",
    "stage_load_failed", "offer_exposed", "offered_link_opened", "offer_applied", "offer_rejected",
    "offer_reserved", "offer_redeemed", "offer_released", "legacy_unmapped",
  ]),
  eventVersion: z.number().int().positive(),
  occurredAt: UtcInstantSchema,
  receivedAt: UtcInstantSchema,
  emitter: z.enum(["client", "server", "provider"]),
  sessionId: IdSchema.optional(), journeyId: IdSchema.optional(), draftRevision: z.number().int().nonnegative().optional(),
  checkoutAttemptId: IdSchema.optional(), orderId: IdSchema.optional(), providerEventId: IdSchema.optional(),
  requestId: IdSchema.optional(), correlationId: IdSchema.optional(), noticeId: IdSchema.optional(),
  tier: MailTierSchema.optional(), entrySurface: SafeTextSchema.optional(), experienceVersion: SafeTextSchema.optional(),
  classificationEvidenceRef: SafeRefSchema.optional(), safeProperties: SafePropertiesSchema,
}).strict().superRefine((event, ctx) => {
  const serverAuthority = new Set([
    "address_verification_result", "document_locked", "payment_verified", "free_order_authorized",
    "fulfillment_submission_started", "fulfillment_accepted", "fulfillment_uncertain", "fulfillment_failed",
    "postal_event_received", "proof_available", "receipt_email_result", "stage_created", "stage_load_failed",
    "offer_reserved", "offer_redeemed", "offer_released",
  ]);
  if (event.emitter === "client" && serverAuthority.has(event.eventName)) {
    ctx.addIssue({ code: "custom", path: ["emitter"], message: "client events cannot assert server/provider authority" });
  }
  if (event.emitter === "provider" && !["payment_verified", "postal_event_received"].includes(event.eventName)) {
    ctx.addIssue({ code: "custom", path: ["emitter"], message: "provider emitter is limited to normalized provider facts" });
  }
});

export const LegacyEventMappingSchema = z.object({
  sourceSystem: IdSchema, sourceVersion: z.string().min(1).max(80), legacyEventName: IdSchema,
  targetEventName: z.enum(["workspace_viewed", "details_ready", "signature_adopted", "legacy_intent_initialized", "legacy_unmapped"]),
  confidence: z.enum(["verified_source_version", "inferred", "unmapped"]),
  mappingPolicyVersion: z.number().int().positive(), reasonCode: IdSchema,
}).strict().refine((mapping) => mapping.confidence !== "unmapped" || mapping.targetEventName === "legacy_unmapped", "unmapped legacy events must remain explicitly unmapped");

/** Historical mappings preserve their weaker evidence and never create server authority. */
export const LEGACY_EVENT_MAPPINGS_V1 = [
  { sourceSystem: "docketstamp", sourceVersion: "pre-v1", legacyEventName: "editor_start", targetEventName: "workspace_viewed", confidence: "inferred", mappingPolicyVersion: 1, reasonCode: "legacy_editor_start" },
  { sourceSystem: "docketstamp", sourceVersion: "pre-v1", legacyEventName: "payment_submitted", targetEventName: "legacy_intent_initialized", confidence: "inferred", mappingPolicyVersion: 1, reasonCode: "intent_creation_not_attempt" },
  { sourceSystem: "docketstamp", sourceVersion: "uninspected", legacyEventName: "editor_complete", targetEventName: "legacy_unmapped", confidence: "unmapped", mappingPolicyVersion: 1, reasonCode: "source_version_uninspected" },
] as const;

export const MoneyFactSchema = z.object({
  schemaVersion: z.literal(1), product: z.literal(PRODUCT), environment: EnvironmentSchema,
  factId: IdSchema, orderId: IdSchema.optional(), currency: CurrencySchema,
  amountMinor: z.number().int().nonnegative(), kind: z.enum(["capture", "refund", "dispute_debit", "dispute_reversal", "processor_fee", "supplier_charge", "supplier_credit"]),
  provider: z.enum(["stripe", "lob", "other"]), providerAccountId: IdSchema, providerMode: z.string().min(1).max(40),
  providerObjectId: IdSchema, effectiveAt: UtcInstantSchema, receivedAt: UtcInstantSchema,
  verification: z.enum(["verified", "pending", "rejected", "unavailable"]), evidenceRef: SafeRefSchema,
  classification: IdentityClassificationSchema.optional(), correctsFactId: IdSchema.optional(),
}).strict();

/** Durable webhook receipt without raw provider payload; unmatched/conflicting rows are quarantined. */
export const ProviderEventReceiptSchema = z.object({
  schemaVersion: z.literal(1), product: z.literal(PRODUCT), environment: EnvironmentSchema,
  receiptId: IdSchema, provider: z.enum(["stripe", "lob"]),
  providerAccountId: IdSchema, providerMode: z.string().min(1).max(40), providerEventId: IdSchema,
  providerEventType: SafeTextSchema,
  providerState: z.enum(["pending", "succeeded", "failed", "canceled", "requires_action", "won", "lost", "under_review", "unknown"]).optional(),
  bodyDigest: z.string().regex(/^[a-f0-9]{64}$/i), receivedAt: UtcInstantSchema,
  status: z.enum(["accepted", "duplicate", "unmatched", "conflict", "rejected", "quarantined"]),
  factId: IdSchema.optional(), orderId: IdSchema.optional(), diagnosticCodes: z.array(DiagnosticCodeSchema).max(20),
}).strict();

export const PostalStateSchema = z.enum(["authorized", "queued", "submitting", "accepted_by_lob", "mailed", "in_transit", "delivered", "returned", "canceled", "failed", "uncertain", "unmapped"]);
export const PostalFactSchema = z.object({
  schemaVersion: z.literal(1), product: z.literal(PRODUCT), environment: EnvironmentSchema,
  factId: IdSchema, orderId: IdSchema, providerEventId: IdSchema.optional(),
  providerLetterId: IdSchema.optional(), providerAccountId: IdSchema, lobMode: LobModeSchema, cassMode: CassModeSchema,
  state: PostalStateSchema, providerState: SafeTextSchema.optional(), occurredAt: UtcInstantSchema, receivedAt: UtcInstantSchema,
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/i), idempotencyKey: IdSchema.optional(), evidenceRef: SafeRefSchema,
  artifactKind: z.enum(["none", "mailing_proof", "tracking", "return_receipt"]).default("none"),
}).strict();

export const OfferFactSchema = z.object({
  schemaVersion: z.literal(1), offerId: IdSchema, version: z.number().int().positive(), code: z.string().min(1).max(80),
  campaignKey: IdSchema.optional(), status: z.enum(["active", "paused", "archived"]),
  discount: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("percent"), percent: z.number().int().min(0).max(100) }),
    z.object({ kind: z.literal("fixed"), amountMinor: z.number().int().nonnegative(), currency: CurrencySchema }),
  ]),
  eligibleNoticeIds: z.array(IdSchema).min(1), eligibleTiers: z.array(MailTierSchema).min(1), startsAt: UtcInstantSchema.optional(), endsAt: UtcInstantSchema.optional(),
  maxRedemptions: z.number().int().nonnegative().nullable(), perIdentityLimit: z.number().int().positive().nullable(),
  maxBudgetMinor: z.number().int().nonnegative(),
  committedSubsidyMinor: z.number().int().nonnegative(), reservedSubsidyMinor: z.number().int().nonnegative(),
  maxFreeDispatches: z.number().int().nonnegative(), ownerActorId: IdSchema, auditRef: SafeRefSchema,
}).strict().superRefine((offer, ctx) => {
  if (offer.startsAt && offer.endsAt && Date.parse(offer.startsAt) >= Date.parse(offer.endsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "offer end must follow its start" });
  }
  if (offer.committedSubsidyMinor + offer.reservedSubsidyMinor > offer.maxBudgetMinor) {
    ctx.addIssue({ code: "custom", path: ["maxBudgetMinor"], message: "committed and reserved subsidy cannot exceed budget" });
  }
});

export const MetricSchema = z.object({
  key: IdSchema, value: z.number().finite().nullable(), unit: z.enum(["count", "ratio", "percent", "money_minor", "seconds", "milliseconds"]),
  currency: CurrencySchema.optional(), numerator: z.number().finite().nullable().optional(), denominator: z.number().finite().nullable().optional(),
  evidenceClass: EvidenceClassSchema, source: z.array(SafeRefSchema).min(1), definitionVersion: z.number().int().positive(),
  scope: ScopeSchema, asOf: UtcInstantSchema, watermark: UtcInstantSchema.nullable(), completeness: CompletenessSchema,
  exclusions: z.record(z.string(), z.number().int().nonnegative()), qualityFlags: z.array(IdSchema), evidenceQueryRef: SafeRefSchema,
}).strict();

export const EvidenceQuerySchema = z.object({
  queryId: IdSchema, scope: ScopeSchema, entity: z.enum(["events", "sessions", "orders", "money_facts", "postal_facts", "offers", "audit", "reconciliation"]),
  filters: z.record(z.string(), z.union([z.string().max(160), z.number(), z.boolean()])),
  cursor: z.string().max(1000).optional(), limit: z.number().int().min(1).max(500),
  includePrivateEvidence: z.boolean().default(false),
}).strict();

export const AuditRecordSchema = z.object({
  schemaVersion: z.literal(1), auditId: IdSchema, actorId: IdSchema, actorKind: z.enum(["human", "service"]),
  capability: IdSchema, action: IdSchema, targetType: IdSchema, targetId: IdSchema,
  environment: EnvironmentSchema, expectedVersion: z.number().int().nonnegative().optional(), requestId: IdSchema,
  correlationId: IdSchema.optional(), reason: z.string().min(1).max(500), effectSummary: SafeTextSchema,
  beforeRedacted: z.record(z.string(), z.unknown()).optional(), afterRedacted: z.record(z.string(), z.unknown()).optional(),
  evidenceRefs: z.array(SafeRefSchema).max(50), status: z.enum(["pending", "succeeded", "failed", "uncertain", "reconciled"]),
  occurredAt: UtcInstantSchema,
}).strict();

export const DispatchCommandSchema = z.object({
  schemaVersion: z.literal(1), orderId: IdSchema, expectedOrderVersion: z.number().int().nonnegative(),
  authorizationRef: SafeRefSchema, snapshotHash: z.string().regex(/^[a-f0-9]{64}$/i), snapshotVersion: z.number().int().positive(),
  paymentFactId: IdSchema.optional(), freeAuthorizationFactId: IdSchema.optional(),
  currency: CurrencySchema, payableAmountMinor: z.number().int().nonnegative(), tier: MailTierSchema,
  lobMode: LobModeSchema, cassMode: CassModeSchema, idempotencyKey: IdSchema, actorId: IdSchema,
  requestId: IdSchema, reason: z.string().min(1).max(500),
}).strict().refine((v) => Boolean(v.paymentFactId) !== Boolean(v.freeAuthorizationFactId), "exactly one payment or free authorization fact is required");

export const DiagnosticSchema = z.object({ code: DiagnosticCodeSchema, severity: z.enum(["info", "warning", "error", "critical"]),
  component: IdSchema, occurredAt: UtcInstantSchema, correlationId: IdSchema.optional(), evidenceRef: SafeRefSchema.optional(),
  retryable: z.boolean(), operatorAction: SafeTextSchema.optional(), detailsRedacted: SafeTextSchema.optional(),
}).strict();

/** Collection/index proposal mirrors docs/admin-console/CONTRACTS.md; additive to legacy order reads. */
export const COLLECTIONS_V1 = ["business_events_v1", "provider_event_receipts_v1", "payment_facts_v1", "postal_facts_v1", "dispatch_attempts_v1", "business_outbox_v1", "offer_reservations_v1", "offer_redemptions_v1", "admin_audit_v1", "reconciliation_runs_v1", "report_generations_v1", "report_partitions_v1"] as const;
export const INDEXES_V1 = [
  "payment_facts_v1(orderId, effectiveAt)", "payment_facts_v1(providerAccountId, providerMode, providerObjectId)",
  "provider_event_receipts_v1(provider, providerAccountId, providerMode, providerEventId)",
  "postal_facts_v1(orderId, occurredAt)", "postal_facts_v1(providerAccountId, lobMode, providerEventId)",
  "business_events_v1(environment, eventName, receivedAt)", "business_events_v1(sessionId, occurredAt)",
  "business_events_v1(journeyId, draftRevision, occurredAt)", "report_partitions_v1(reportGenerationId, partitionKey)",
  "reconciliation_runs_v1(provider, startedAt)", "admin_audit_v1(targetType, targetId, occurredAt)",
] as const;
