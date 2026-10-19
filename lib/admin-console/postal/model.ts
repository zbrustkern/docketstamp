import { z } from "zod";
import {
  ADMIN_CONSOLE_CONTRACT_VERSION, CassModeSchema, EnvironmentSchema, LobModeSchema,
  PostalStateSchema, PRODUCT, UtcInstantSchema,
} from "@/lib/admin-console/contracts";

const Id = z.string().min(1).max(200);
const Hash = z.string().regex(/^[a-f0-9]{64}$/i);

export const DispatchAttemptSchema = z.object({
  schemaVersion: z.literal(ADMIN_CONSOLE_CONTRACT_VERSION), product: z.literal(PRODUCT), environment: EnvironmentSchema,
  attemptId: Id, orderId: Id, attemptNumber: z.number().int().positive(),
  paymentFactId: Id.optional(), freeAuthorizationFactId: Id.optional(),
  snapshotHash: Hash, snapshotVersion: z.number().int().positive(), tier: z.enum(["first_class", "certified", "certified_return_receipt"]),
  currency: z.string().regex(/^[A-Z]{3}$/), payableAmountMinor: z.number().int().nonnegative(),
  lobMode: LobModeSchema, cassMode: CassModeSchema, idempotencyKey: Id,
  state: z.enum(["prepared", "submitting", "accepted", "uncertain", "failed", "simulated", "reconciled"]),
  startedAt: UtcInstantSchema, updatedAt: UtcInstantSchema, leaseExpiresAt: UtcInstantSchema.optional(),
  actorId: Id, requestId: Id,
  providerLetterId: Id.optional(), providerErrorCode: z.string().regex(/^[A-Z0-9_]{1,80}$/).optional(),
  evidenceRef: Id, reconciliationEvidenceRef: Id.optional(),
}).strict().refine((v) => Boolean(v.paymentFactId) !== Boolean(v.freeAuthorizationFactId), "attempt must bind exactly one paid or free authority");

export const LobEventSchema = z.object({
  schemaVersion: z.literal(ADMIN_CONSOLE_CONTRACT_VERSION), product: z.literal(PRODUCT), environment: EnvironmentSchema,
  providerAccountId: Id, lobMode: LobModeSchema, cassMode: CassModeSchema,
  providerEventId: Id, providerLetterId: Id, providerEventType: z.string().min(1).max(200),
  occurredAt: UtcInstantSchema, receivedAt: UtcInstantSchema, orderId: Id.optional(),
  normalizedState: PostalStateSchema, mappingVersion: z.number().int().positive(),
  artifactSignal: z.enum(["none", "proof_rendered", "return_receipt_tracking_event", "receipt_email_sent", "receipt_email_opened"]).default("none"),
  payloadDigest: Hash, evidenceRef: Id,
}).strict();

/** Exact names only. Unknown provider states remain visible as unmapped. */
export const LOB_EVENT_STATE_MAP_V1: Readonly<Record<string, z.infer<typeof PostalStateSchema>>> = Object.freeze({
  "letter.created": "accepted_by_lob",
  "letter.rejected": "failed",
  "letter.deleted": "canceled",
  "letter.mailed": "mailed",
  "letter.in_transit": "in_transit",
  "letter.in_local_area": "in_transit",
  "letter.processed_for_delivery": "in_transit",
  "letter.delivered": "delivered",
  "letter.returned_to_sender": "returned",
  "letter.failed": "failed",
  "letter.certified.mailed": "mailed",
  "letter.certified.in_transit": "in_transit",
  "letter.certified.in_local_area": "in_transit",
  "letter.certified.processed_for_delivery": "in_transit",
  "letter.certified.delivered": "delivered",
  "letter.certified.returned_to_sender": "returned",
});

export const LOB_EVENT_ARTIFACT_SIGNAL_MAP_V1: Readonly<Record<string, "proof_rendered" | "return_receipt_tracking_event" | "receipt_email_sent" | "receipt_email_opened">> = Object.freeze({
  "letter.rendered_pdf": "proof_rendered",
  "letter.return_envelope.in_transit": "return_receipt_tracking_event",
  "letter.return_envelope.in_local_area": "return_receipt_tracking_event",
  "letter.return_envelope.processed_for_delivery": "return_receipt_tracking_event",
  "letter.return_envelope.re-routed": "return_receipt_tracking_event",
  "letter.return_envelope.returned_to_sender": "return_receipt_tracking_event",
  "letter.informed_delivery.email_sent": "receipt_email_sent",
  "letter.informed_delivery.email_opened": "receipt_email_opened",
});

export function normalizeLobArtifactSignal(providerEventType: string): z.infer<typeof LobEventSchema>["artifactSignal"] {
  return LOB_EVENT_ARTIFACT_SIGNAL_MAP_V1[providerEventType] ?? "none";
}

export function normalizeLobEventState(providerEventType: string): z.infer<typeof PostalStateSchema> {
  return LOB_EVENT_STATE_MAP_V1[providerEventType] ?? "unmapped";
}

export interface PostalStateEvidence {
  state: z.infer<typeof PostalStateSchema>;
  occurredAt: string;
  receivedAt: string;
  providerEventId: string;
}

export interface PostalProjectionResult {
  current: PostalStateEvidence | null;
  disposition: "advanced" | "appended_older" | "duplicate" | "conflict";
  reviewRequired: boolean;
}

/**
 * Appends evidence without rank-based regressions. Source time determines sequence;
 * received time is only the stable tie-breaker for same-state observations.
 */
export function projectPostalEvidence(
  current: PostalStateEvidence | null,
  incoming: PostalStateEvidence,
  seenEventIds: ReadonlySet<string> = new Set(),
): PostalProjectionResult {
  if (seenEventIds.has(incoming.providerEventId)) return { current, disposition: "duplicate", reviewRequired: false };
  if (!current) return { current: incoming, disposition: "advanced", reviewRequired: incoming.state === "unmapped" };

  const incomingTime = Date.parse(incoming.occurredAt);
  const currentTime = Date.parse(current.occurredAt);
  if (incomingTime < currentTime) return { current, disposition: "appended_older", reviewRequired: incoming.state === "unmapped" };
  if (incomingTime === currentTime && incoming.state !== current.state) {
    return { current, disposition: "conflict", reviewRequired: true };
  }
  if (incomingTime === currentTime && Date.parse(incoming.receivedAt) < Date.parse(current.receivedAt)) {
    return { current, disposition: "appended_older", reviewRequired: false };
  }
  return { current: incoming, disposition: "advanced", reviewRequired: incoming.state === "unmapped" };
}

export type DispatchStartDecision = "start" | "already_accepted" | "active_lease" | "reconcile_uncertain" | "authority_missing" | "snapshot_mismatch";

export function decideDispatchStart(input: {
  authorized: boolean;
  expectedSnapshotHash: string;
  actualSnapshotHash: string | null;
  currentState: "none" | "prepared" | "submitting" | "accepted" | "uncertain" | "failed";
  leaseExpiresAt?: string | null;
  now: string;
  reconciliationConfirmedNoAcceptance?: boolean;
}): DispatchStartDecision {
  if (!input.authorized) return "authority_missing";
  if (!input.actualSnapshotHash || input.actualSnapshotHash !== input.expectedSnapshotHash) return "snapshot_mismatch";
  if (input.currentState === "accepted") return "already_accepted";
  if (input.currentState === "uncertain" && !input.reconciliationConfirmedNoAcceptance) return "reconcile_uncertain";
  if (input.currentState === "submitting" && input.leaseExpiresAt && Date.parse(input.leaseExpiresAt) > Date.parse(input.now)) return "active_lease";
  if (input.currentState === "submitting" && !input.reconciliationConfirmedNoAcceptance) return "reconcile_uncertain";
  return "start";
}
