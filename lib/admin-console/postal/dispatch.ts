import { assertNonFitnessEntity } from "@/src/lib/docket/guardrails";
import { resolveLobDispatchMode, dispatchDocketLetter, LobLetterDispatchParams } from "@/src/lib/fulfillment/lob";
import { serverEnvironment } from "@/lib/admin-console/commands/access";
import { claimDispatchAttempt, finishDispatchAttempt, AttemptAuthority } from "./attempt-store";
import { getVerifiedPaymentObligation } from "@/lib/admin-console/finance/authority";
import { getFreeObligation } from "./free-authority";

function lobAddress(address: any): LobLetterDispatchParams["to"] {
  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ");
  return {
    name: [address.name || fullName, address.company].filter(Boolean).join(" ") || "",
    ...(address.company ? { company: address.company } : {}),
    address_line1: address.addressLine1 || address.line1 || address.street1 || "",
    address_line2: address.addressLine2 || address.line2 || address.street2 || "",
    address_city: address.city || "", address_state: address.state || "",
    address_zip: address.zip || address.postalCode || "", address_country: address.country || "US",
  };
}

/** Resolve either durable Stripe capture authority or the audited free-order fact. */
export async function resolvePostalObligation(orderId: string): Promise<AuthorizedObligation | null> {
  const paid = await getVerifiedPaymentObligation(orderId);
  const free = paid ? null : await getFreeObligation(orderId);
  const proof: any = paid || free;
  if (!proof) return null;
  const order = proof.order;
  const documentHtml = order.documentHtml || (order as any).frozen_html_payload;
  return {
    verified: true, orderId, version: proof.snapshotVersion, environment: proof.environment || proof.paymentFact?.environment,
    ...(proof.paymentFact ? { paymentFactId: proof.paymentFact.factId || order.paymentFactId } : {}),
    ...(proof.freeAuthorizationFactId ? { freeAuthorizationFactId: proof.freeAuthorizationFactId } : {}),
    material: {
      documentHtml, snapshotHash: proof.snapshotHash, snapshotVersion: proof.snapshotVersion,
      docketId: order.docketId || order.docketNumber, noticeId: order.noticeId,
      tier: proof.tier, currency: proof.currency, payableAmountMinor: proof.payableAmountMinor,
      recipientAddress: lobAddress(order.recipientAddress), returnAddress: lobAddress(order.returnAddress),
      recipientBusinessName: order.recipientAddress?.company || order.recipientAddress?.name || [order.recipientAddress?.firstName, order.recipientAddress?.lastName].filter(Boolean).join(" "),
      naicsCode: order.naicsCode,
    },
  };
}

export interface LockedDispatchMaterial {
  documentHtml: string;
  snapshotHash: string;
  snapshotVersion: number;
  docketId: string;
  noticeId: string;
  tier: AttemptAuthority["tier"];
  currency: string;
  payableAmountMinor: number;
  recipientAddress: LobLetterDispatchParams["to"];
  returnAddress: LobLetterDispatchParams["from"];
  recipientBusinessName?: string;
  naicsCode?: string;
}

export type AuthorizedObligation = {
  verified: true;
  orderId: string;
  version: number;
  environment: AttemptAuthority["environment"];
  paymentFactId?: string;
  freeAuthorizationFactId?: string;
  material: LockedDispatchMaterial;
};

export type ObligationResolver = (orderId: string) => Promise<AuthorizedObligation | null>;
export type LobSubmitter = (params: LobLetterDispatchParams) => ReturnType<typeof dispatchDocketLetter>;

export type PostalDispatchResult =
  | { status: "accepted" | "simulated"; attemptId: string; providerLetterId: string; mode: string }
  | { status: "uncertain"; attemptId: string; mode: string; diagnostic: "PROVIDER_RESULT_AMBIGUOUS" }
  | { status: "blocked"; reason: string };

/** Shared dispatch path for paid, free, comp and operator retry after authority resolves. */
export async function dispatchAuthorizedObligation(input: {
  orderId: string;
  requestId: string;
  actorId: string;
  evidenceRef: string;
  resolveObligation: ObligationResolver;
  submit?: LobSubmitter;
  nowMs?: number;
  reconciliationConfirmedNoAcceptance?: boolean;
}): Promise<PostalDispatchResult> {
  const obligation = await input.resolveObligation(input.orderId);
  if (!obligation || obligation.verified !== true) return { status: "blocked", reason: "PAYMENT_OR_FREE_AUTHORITY_UNAVAILABLE" };
  if (obligation.orderId !== input.orderId) return { status: "blocked", reason: "ORDER_AUTHORITY_MISMATCH" };
  if (obligation.environment !== serverEnvironment()) return { status: "blocked", reason: "ENVIRONMENT_SCOPE_MISMATCH" };
  if (Boolean(obligation.paymentFactId) === Boolean(obligation.freeAuthorizationFactId)) return { status: "blocked", reason: "EXACTLY_ONE_AUTHORITY_REQUIRED" };
  const material = obligation.material;
  if (!material.documentHtml || !material.snapshotHash || !material.snapshotVersion || !material.docketId || !material.noticeId) {
    return { status: "blocked", reason: "FROZEN_CANONICAL_SNAPSHOT_REQUIRED" };
  }
  try {
    assertNonFitnessEntity({ recipientName: material.recipientBusinessName || material.recipientAddress.name, noticeId: material.noticeId, naicsCode: material.naicsCode });
  } catch {
    return { status: "blocked", reason: "FITNESS_ENTITY_PROHIBITED" };
  }
  const mode = resolveLobDispatchMode();
  if (mode === "unconfigured") return { status: "blocked", reason: "LOB_MODE_UNCONFIGURED" };

  const authority: AttemptAuthority = {
    product: "docketstamp", environment: obligation.environment, orderId: input.orderId,
    snapshotHash: material.snapshotHash, snapshotVersion: material.snapshotVersion,
    tier: material.tier, currency: material.currency, payableAmountMinor: material.payableAmountMinor,
    lobMode: mode, cassMode: process.env.LOB_ENV === "staging_mock_cass" ? "staging_mock_cass" : mode === "live" ? "live" : "unknown",
    ...(obligation.paymentFactId ? { paymentFactId: obligation.paymentFactId } : {}),
    ...(obligation.freeAuthorizationFactId ? { freeAuthorizationFactId: obligation.freeAuthorizationFactId } : {}),
  };
  let claim;
  try {
    claim = await claimDispatchAttempt({ authority, actorId: input.actorId, requestId: input.requestId, evidenceRef: input.evidenceRef, nowMs: input.nowMs,
      reconciliationConfirmedNoAcceptance: input.reconciliationConfirmedNoAcceptance });
  } catch (error) {
    return { status: "blocked", reason: error instanceof Error ? error.message : "DISPATCH_CLAIM_FAILED" };
  }
  if (!claim.claimed) return { status: "blocked", reason: claim.reason.toUpperCase() };

  const submit = input.submit || dispatchDocketLetter;
  let submitted: Awaited<ReturnType<LobSubmitter>>;
  try {
    submitted = await submit({
      orderId: input.orderId,
      docketId: material.docketId,
      description: `DocketStamp notice ${material.docketId}`,
      serviceLevel: material.tier,
      to: material.recipientAddress,
      from: material.returnAddress,
      file: material.documentHtml,
      color: false,
      metadata: { snapshotVersion: String(material.snapshotVersion), snapshotHash: material.snapshotHash },
    });
  } catch {
    // A thrown transport error may occur after provider acceptance. Preserve the
    // lease as an uncertain attempt so a human reconciliation is required.
    await finishDispatchAttempt({ attemptId: claim.attempt.attemptId, state: "uncertain", providerErrorCode: "LOB_RESULT_AMBIGUOUS", nowMs: input.nowMs });
    return { status: "uncertain", attemptId: claim.attempt.attemptId, mode, diagnostic: "PROVIDER_RESULT_AMBIGUOUS" };
  }
  if (submitted.success && submitted.isSimulatedMock === true) {
    await finishDispatchAttempt({ attemptId: claim.attempt.attemptId, state: "simulated", providerErrorCode: "MOCK_SIMULATED", nowMs: input.nowMs });
    return { status: "simulated", attemptId: claim.attempt.attemptId, providerLetterId: submitted.letterId || `mock:${input.orderId}`, mode };
  }
  if (submitted.success && submitted.letterId && submitted.isSimulatedMock !== true && submitted.mode === mode) {
    await finishDispatchAttempt({ attemptId: claim.attempt.attemptId, state: "accepted", providerLetterId: submitted.letterId, nowMs: input.nowMs });
    return { status: "accepted", attemptId: claim.attempt.attemptId, providerLetterId: submitted.letterId, mode };
  }

  // Lob errors do not currently distinguish a definitive pre-acceptance rejection
  // from a transport timeout after acceptance. Preserve uncertainty; never retry blind.
  await finishDispatchAttempt({ attemptId: claim.attempt.attemptId, state: "uncertain", providerErrorCode: mode === "test_api" ? "LOB_TEST_RESULT_AMBIGUOUS" : "LOB_RESULT_AMBIGUOUS", nowMs: input.nowMs });
  return { status: "uncertain", attemptId: claim.attempt.attemptId, mode, diagnostic: "PROVIDER_RESULT_AMBIGUOUS" };
}
