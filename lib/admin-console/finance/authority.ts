import crypto from "node:crypto";
import type Stripe from "stripe";
import { firestoreDb, sanitizeFirestoreData } from "@/lib/firebase-admin";
import type { Order } from "@/lib/types";
import { resolvePaymentMode } from "@/lib/payment-mode";
import { recordAuthorizedPaymentObserved, type ProcessOrderOptions, type ProcessPaidOrderResult } from "@/lib/order-processor";
import { getDispatchLock, reconcileAcceptedDispatchOutboxes } from "@/lib/admin-console/postal/attempt-store";
import {
  MoneyFactSchema,
  EventEnvelopeSchema,
  ProviderEventReceiptSchema,
} from "@/lib/admin-console/contracts";

export type StripeMoneyMode = "live" | "test" | "mock" | "unknown";

function appEnvironment(): "local" | "staging" | "production" {
  if (process.env.NODE_ENV === "production" && process.env.ENVIRONMENT !== "staging") return "production";
  if (
    process.env.ENVIRONMENT === "staging" ||
    process.env.FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.IS_PREVIEW_TEST_ENVIRONMENT === "true"
  ) return "staging";
  return "local";
}

export interface StripeReceiptContext {
  eventId: string;
  eventType: string;
  eventLivemode: boolean;
  accountId?: string | null;
  occurredAt?: number;
  receivedAt?: number;
}

export interface PaymentAuthorityResult {
  accepted: boolean;
  duplicate: boolean;
  orderId?: string;
  paymentFactId?: string;
  receiptId: string;
  status: "accepted" | "duplicate" | "unmatched" | "conflict" | "rejected" | "quarantined";
  diagnosticCodes: string[];
}

const RECEIPTS = "provider_event_receipts_v1";
const PAYMENT_FACTS = "payment_facts_v1";
const OUTBOX = "business_outbox_v1";

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeDocId(value: string): string {
  return digest(value);
}

function contractId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 160 ? normalized : undefined;
}

function nowIso(ms = Date.now()): string {
  return new Date(ms).toISOString();
}

function normalizeMode(livemode: boolean): StripeMoneyMode {
  return livemode ? "live" : "test";
}

function expectedRuntimeMode(): StripeMoneyMode {
  try {
    const mode = resolvePaymentMode();
    if (mode === "live") return "live";
    if (mode === "stripe_test") return "test";
    return "mock";
  } catch {
    return "unknown";
  }
}

export function classifyCapturedOrder(order: Pick<Order, "id" | "isFounderTest" | "isComp" | "paymentMethod" | "amountInCents">, mode: StripeMoneyMode) {
  let primary: "customer" | "founder" | "employee" | "automated_test" | "comp" | "free_promo" | "suspected_bot" | "unresolved" = "unresolved";
  const overlappingFacts: Array<"customer" | "founder" | "employee" | "automated_test" | "comp" | "free_promo" | "suspected_bot" | "unresolved"> = [];
  if (mode === "test" || mode === "mock") {
    primary = "automated_test";
  } else if (order.isFounderTest === true) {
    primary = "founder";
  } else if (order.isComp === true) {
    primary = "comp";
  } else if (order.paymentMethod === "PROMO_CODE" && order.amountInCents === 0) {
    primary = "free_promo";
  } else if (mode === "live") {
    // A verified live capture on an ordinary paid order is the operational
    // customer signal. Founder QA must be marked on the server-owned order;
    // ambiguous or unavailable payment modes remain unresolved for review.
    primary = "customer";
  }
  if (order.isFounderTest === true && primary !== "founder") overlappingFacts.push("founder");
  return {
    classificationId: `order:${order.id}:policy-v1`,
    primary,
    overlappingFacts,
    evidenceRefs: [`orders/${order.id}`],
    policyVersion: 1,
    classifiedAt: nowIso(),
  };
}

function orderMailTier(order: Order): "first_class" | "certified" | "certified_return_receipt" | undefined {
  const serviceLevel = String(order.serviceLevel || "").toUpperCase();
  if (serviceLevel === "FIRST_CLASS" || serviceLevel === "FIRST-CLASS") return "first_class";
  if (serviceLevel === "CERTIFIED_RETURN_RECEIPT") return "certified_return_receipt";
  if (serviceLevel === "CERTIFIED") return "certified";
  return undefined;
}

function orderEntrySurface(order: Order): string | undefined {
  const source = String(order.entrySource || "");
  if (source === "home_chooser") return "home";
  if (source === "companies_directory") return "company_directory";
  if (source === "direct_notice" || source === "recipient_prefill" || source === "staged_draft") return "notice_workspace";
  return undefined;
}

export function computeOrderSnapshotHash(order: Order): string {
  const document = order.documentHtml || (order as Order & { frozen_html_payload?: string }).frozen_html_payload;
  const versionedOrder = order as Order & { schemaVersion?: number; kind?: string };
  // Bind the document and envelope/quote. Status, IDs, email, attribution and
  // timestamps remain outside the hash because they change during operations.
  // New canonical notices also bind the separate signature-adoption evidence.
  // Markerless historical orders deliberately retain their prior hash shape so
  // existing payment facts remain verifiable without rewriting old records.
  const stableSnapshot = {
    ...(versionedOrder.schemaVersion === 2 && versionedOrder.kind === "notice"
      ? { documentIntegrityEvidence: order.documentIntegrityEvidence || null }
      : {}),
    documentHtml: document || null,
    legacyContent: document ? null : {
        noticeId: order.noticeId,
        noticeType: order.noticeType,
        printedMessage: order.printedMessage,
        handwrittenNote: order.handwrittenNote,
        frontImageUrl: order.frontImageUrl,
      },
    recipientAddress: order.recipientAddress,
    returnAddress: order.returnAddress,
    serviceLevel: order.serviceLevel || "CERTIFIED",
    currency: "USD",
    payableAmountMinor: order.finalAmountInCents ?? order.amountInCents,
  };
  return digest(stableSnapshot);
}

function safeReceipt(
  context: StripeReceiptContext,
  account: string,
  mode: StripeMoneyMode,
  bodyDigest: string,
  values: {
    status: "accepted" | "duplicate" | "unmatched" | "conflict" | "rejected" | "quarantined";
    orderId?: string;
    factId?: string;
    diagnosticCodes: string[];
    receivedAt: number;
  },
) {
  return ProviderEventReceiptSchema.parse({
    schemaVersion: 1,
    product: "docketstamp",
    environment: appEnvironment(),
    receiptId: safeDocId(`stripe:${account}:${mode}:${context.eventId}`),
    provider: "stripe",
    providerAccountId: account,
    providerMode: mode,
    providerEventId: context.eventId,
    providerEventType: context.eventType.slice(0, 240),
    bodyDigest,
    receivedAt: nowIso(values.receivedAt),
    status: values.status,
    ...(values.orderId ? { orderId: values.orderId } : {}),
    ...(values.factId ? { factId: values.factId } : {}),
    diagnosticCodes: values.diagnosticCodes,
  });
}

/**
 * Verify a signed/provider-retrieved succeeded PaymentIntent and persist its
 * receipt, capture fact, order payment authority, and dispatch obligation in one
 * Firestore transaction. This function never calls fulfillment or money APIs.
 */
export async function recordPaymentAuthority(
  paymentIntent: Stripe.PaymentIntent,
  context: StripeReceiptContext,
): Promise<PaymentAuthorityResult> {
  const mode = normalizeMode(paymentIntent.livemode === true);
  const account = context.accountId || process.env.STRIPE_ACCOUNT_ID || "stripe_platform_default";
  const orderId = paymentIntent.metadata?.orderId || "";
  const receiptId = safeDocId(`stripe:${account}:${mode}:${context.eventId}`);
  const factId = safeDocId(`capture:${account}:${mode}:${paymentIntent.id}`);
  const outboxId = safeDocId(`payment-obligation:${orderId}`);
  const receivedAt = context.receivedAt || Date.now();
  const eventAndPaymentDigest = digest({
    eventId: context.eventId,
    eventType: context.eventType,
    eventLivemode: context.eventLivemode,
    paymentIntentId: paymentIntent.id,
    orderId,
    amount: paymentIntent.amount,
    amountReceived: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    livemode: paymentIntent.livemode,
  });

  return firestoreDb.runTransaction(async (transaction: any) => {
    const receiptRef = firestoreDb.collection(RECEIPTS).doc(receiptId);
    const conflictReceiptId = `${receiptId.slice(0, 48)}_${eventAndPaymentDigest.slice(0, 16)}`;
    const conflictReceiptRef = firestoreDb.collection(RECEIPTS).doc(conflictReceiptId);
    const orderRef = orderId ? firestoreDb.collection("orders").doc(orderId) : null;
    const factRef = firestoreDb.collection(PAYMENT_FACTS).doc(factId);
    const paymentEventId = safeDocId(`business-event:payment-verified:${factId}`);
    const paymentEventRef = firestoreDb.collection("business_events_v1").doc(paymentEventId);
    const outboxRef = firestoreDb.collection(OUTBOX).doc(outboxId);
    const receiptSnap = await transaction.get(receiptRef);
    const conflictReceiptSnap = await transaction.get(conflictReceiptRef);
    const orderSnap = orderRef ? await transaction.get(orderRef) : null;
    const checkoutAttemptId = (orderSnap?.exists ? (orderSnap.data() as Order & { checkoutAttemptId?: string }).checkoutAttemptId : undefined);
    const checkoutAttemptRef = checkoutAttemptId ? firestoreDb.collection("checkout_attempts_v1").doc(checkoutAttemptId) : null;
    const checkoutAttemptSnap = checkoutAttemptRef ? await transaction.get(checkoutAttemptRef) : null;
    const factSnap = await transaction.get(factRef);
    const paymentEventSnap = await transaction.get(paymentEventRef);
    const outboxSnap = orderId ? await transaction.get(outboxRef) : null;

    if (receiptSnap.exists) {
      const existing = receiptSnap.data() as ReturnType<typeof ProviderEventReceiptSchema.parse>;
      if (existing.bodyDigest !== eventAndPaymentDigest) {
        const conflict = safeReceipt(context, account, mode, eventAndPaymentDigest, {
          status: "conflict",
          orderId: orderId || undefined,
          diagnosticCodes: ["DUPLICATE_CONFLICT"],
          receivedAt,
        });
        if (!conflictReceiptSnap?.exists) transaction.set(conflictReceiptRef, conflict);
        return {
          accepted: false,
          duplicate: false,
          orderId: orderId || undefined,
          receiptId: conflict.receiptId,
          status: "conflict" as const,
          diagnosticCodes: ["DUPLICATE_CONFLICT"],
        };
      }
      if (existing.status === "accepted" || existing.status === "duplicate") {
        return {
          accepted: true,
          duplicate: true,
          orderId: existing.orderId,
          paymentFactId: existing.factId,
          receiptId,
          status: "duplicate" as const,
          diagnosticCodes: existing.diagnosticCodes,
        };
      }
      if (existing.status === "conflict") {
        return {
          accepted: false,
          duplicate: true,
          orderId: existing.orderId,
          receiptId,
          status: "conflict" as const,
          diagnosticCodes: existing.diagnosticCodes,
        };
      }
      // Retry unmatched/rejected/quarantined receipts: the authoritative order
      // may arrive later, or an operator may repair a configuration mismatch.
    }

    const order = orderSnap?.exists ? (orderSnap.data() as Order) : null;
    const diagnostics: string[] = [];
    if (!orderId || !order) diagnostics.push("MISSING_ORDER");
    if (paymentIntent.status !== "succeeded" || !Number.isInteger(paymentIntent.amount_received) || paymentIntent.amount_received <= 0) {
      diagnostics.push("PROVIDER_REJECTED");
    }
    if (!Number.isFinite(context.occurredAt) || (context.occurredAt || 0) <= 0) {
      diagnostics.push("RECONCILIATION_REQUIRED");
    }
    if (!paymentIntent.id || (order?.stripePaymentId && order.stripePaymentId !== paymentIntent.id)) {
      diagnostics.push("DUPLICATE_CONFLICT");
    }
    if (paymentIntent.metadata?.orderId !== orderId || !orderId) diagnostics.push("MISSING_ORDER");
    if (paymentIntent.currency?.toLowerCase() !== "usd") {
      diagnostics.push("CURRENCY_MISMATCH");
    }
    if (context.eventLivemode !== paymentIntent.livemode) diagnostics.push("MODE_MISMATCH");
    const expectedMode = expectedRuntimeMode();
    if (expectedMode === "unknown" || expectedMode === "mock" || expectedMode !== mode) diagnostics.push("MODE_MISMATCH");
    if (context.accountId && (!process.env.STRIPE_ACCOUNT_ID || context.accountId !== process.env.STRIPE_ACCOUNT_ID)) diagnostics.push("MODE_MISMATCH");

    let expectedAmount: number | null = null;
    if (order) {
      const candidate = order.finalAmountInCents ?? order.amountInCents;
      if (Number.isInteger(candidate) && candidate >= 0) expectedAmount = candidate;
      if (expectedAmount === null || expectedAmount === 0 || paymentIntent.amount !== expectedAmount || paymentIntent.amount_received !== expectedAmount) {
        diagnostics.push("AMOUNT_MISMATCH");
      }
      if (order.paymentMethod === "PROMO_CODE" || order.paymentMethod === "STUDIO_COMP" || order.isComp) diagnostics.push("PROVIDER_REJECTED");
    }

    const uniqueDiagnostics = Array.from(new Set(diagnostics));
    if (uniqueDiagnostics.length > 0 || !order || expectedAmount === null) {
      const status = !order ? "unmatched" : uniqueDiagnostics.includes("MISSING_ORDER") ? "unmatched" : "quarantined";
      const receipt = safeReceipt(context, account, mode, eventAndPaymentDigest, {
        status,
        orderId: orderId || undefined,
        diagnosticCodes: uniqueDiagnostics.length ? uniqueDiagnostics : ["VALIDATION_FAILED"],
        receivedAt,
      });
      transaction.set(receiptRef, receipt);
      return {
        accepted: false,
        duplicate: false,
        orderId: orderId || undefined,
        receiptId,
        status,
        diagnosticCodes: receipt.diagnosticCodes,
      };
    }

    const hash = computeOrderSnapshotHash(order);
    const paymentFact = MoneyFactSchema.parse({
      schemaVersion: 1,
      product: "docketstamp",
      environment: appEnvironment(),
      factId,
      orderId,
      currency: paymentIntent.currency.toUpperCase(),
      amountMinor: paymentIntent.amount_received,
      kind: "capture",
      provider: "stripe",
      providerAccountId: account,
      providerMode: mode,
      providerObjectId: paymentIntent.id,
      effectiveAt: nowIso(context.occurredAt || receivedAt),
      receivedAt: nowIso(receivedAt),
      verification: "verified",
      evidenceRef: `stripe/payment_intents/${paymentIntent.id}`,
      classification: classifyCapturedOrder(order, mode),
    });

    if (factSnap.exists) {
      const existingFact = factSnap.data() as ReturnType<typeof MoneyFactSchema.parse>;
      if (
        existingFact.orderId !== orderId || existingFact.amountMinor !== paymentFact.amountMinor ||
        existingFact.currency !== paymentFact.currency || existingFact.providerObjectId !== paymentIntent.id
      ) {
        const conflict = safeReceipt(context, account, mode, eventAndPaymentDigest, {
          status: "conflict",
          orderId,
          diagnosticCodes: ["DUPLICATE_CONFLICT"],
          receivedAt,
        });
        transaction.set(receiptRef, conflict);
        return {
          accepted: false,
          duplicate: false,
          orderId,
          receiptId,
          status: "conflict" as const,
          diagnosticCodes: ["DUPLICATE_CONFLICT"],
        };
      }
    } else {
      transaction.set(factRef, paymentFact);
      if (!paymentEventSnap.exists) {
        const details = order as Order & { checkoutAttemptId?: string; telemetryJourneyId?: string };
        const tier = orderMailTier(order);
        const event = EventEnvelopeSchema.parse({
          schemaVersion: 1,
          product: "docketstamp",
          environment: appEnvironment(),
          eventId: paymentEventId,
          eventName: "payment_verified",
          eventVersion: 1,
          occurredAt: paymentFact.effectiveAt,
          receivedAt: paymentFact.receivedAt,
          emitter: "server",
          sessionId: contractId(order.telemetrySessionId) || contractId(order.sessionId),
          journeyId: contractId(details.telemetryJourneyId),
          checkoutAttemptId: contractId(details.checkoutAttemptId),
          orderId,
          correlationId: factId,
          noticeId: contractId(order.noticeId) || contractId(order.noticeType),
          tier,
          entrySurface: orderEntrySurface(order),
          experienceVersion: typeof order.experienceVersion === "string" ? order.experienceVersion.trim().slice(0, 80) || undefined : undefined,
          safeProperties: { mode, result: "verified", ...(tier ? { tier } : {}) },
        });
        transaction.set(paymentEventRef, sanitizeFirestoreData({
          ...event,
          logicalDigest: digest(event),
          classification: paymentFact.classification,
        }));
      }
    }

    const receipt = safeReceipt(context, account, mode, eventAndPaymentDigest, {
      status: factSnap.exists ? "duplicate" : "accepted",
      orderId,
      factId,
      diagnosticCodes: [],
      receivedAt,
    });
    transaction.set(receiptRef, receipt);

    if (!outboxSnap?.exists) {
      transaction.set(outboxRef, {
        schemaVersion: 1,
        outboxId,
        kind: "payment_obligation",
        orderId,
        paymentFactId: factId,
        snapshotHash: hash,
        status: "pending",
        createdAt: nowIso(receivedAt),
        attempts: 0,
      });
    }
    if (orderRef && order) {
      const currentAttemptState = checkoutAttemptSnap?.exists
        ? String((checkoutAttemptSnap.data() as Record<string, unknown>).state || "")
        : "";
      const capturedDuringResolution = new Set([
        "cancellation_pending", "superseding", "outcome_unknown", "superseded", "cancelled",
        "captured_exception", "paid_exception",
      ]).has(currentAttemptState) || Boolean((order as any).checkoutAttemptSupersededBy);
      const nextAttemptState = checkoutAttemptId ? (capturedDuringResolution || !checkoutAttemptSnap?.exists ? "captured_exception" : "paid") : undefined;
      const update: Record<string, unknown> = {
        stripePaymentId: paymentIntent.id,
        paymentMode: mode === "live" ? "live" : "stripe_test",
        isTest: mode !== "live",
        amountReceivedInCents: paymentIntent.amount_received,
        paymentFactId: factId,
        paymentSnapshotHash: hash,
        updatedAt: receivedAt,
      };
      if (checkoutAttemptId) {
        update.checkoutAttemptState = nextAttemptState;
        update.checkoutPaymentIntentId = paymentIntent.id;
      }
      if (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_VERIFICATION_FAILED") {
        update.status = "PAYMENT_RECEIVED";
      }
      transaction.update(orderRef, update);
      if (checkoutAttemptRef && checkoutAttemptSnap?.exists) {
        transaction.update(checkoutAttemptRef, {
          state: nextAttemptState,
          paymentIntentId: paymentIntent.id,
          updatedAt: receivedAt,
        });
      }
    }

    return {
      accepted: true,
      duplicate: factSnap.exists,
      orderId,
      paymentFactId: factId,
      receiptId,
      status: factSnap.exists ? "duplicate" as const : "accepted" as const,
      diagnosticCodes: [],
    };
  });
}

/** Mark the durable obligation after the existing idempotent processor returns. */
export async function recordPaymentObligationResult(
  orderId: string,
  paymentFactId: string,
  result: { success: boolean; status: string; error?: string },
): Promise<void> {
  const outboxId = safeDocId(`payment-obligation:${orderId}`);
  const ref = firestoreDb.collection(OUTBOX).doc(outboxId);
  await firestoreDb.runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("Payment obligation outbox record is missing.");
    const item = snap.data() as Record<string, unknown>;
    if (item.orderId !== orderId || item.paymentFactId !== paymentFactId) {
      throw new Error("Payment obligation outbox binding does not match verified payment.");
    }
    // Acceptance is committed by the postal attempt transaction. A later
    // caller cannot demote that verified fact back into retryable work.
    if (item.status === "consumed") return;
    transaction.update(ref, {
      status: result.success ? "consumed" : "attention_required",
      lastResult: result.success ? result.status : "failed",
      ...(result.error ? { lastErrorCode: "FULFILLMENT_REQUIRES_ATTENTION" } : {}),
      completedAt: nowIso(),
      attempts: Number(item.attempts || 0) + 1,
    });
  });
}

type AcceptedEffectsClaim = { claimed: true; token: string; item: Record<string, unknown> } | { claimed: false; status: string };

export type AcceptedDispatchAuthority = { paymentFactId: string; freeAuthorizationFactId?: never } | { freeAuthorizationFactId: string; paymentFactId?: never };

async function claimAcceptedDispatchEffects(orderId: string, authority: AcceptedDispatchAuthority, nowMs = Date.now()): Promise<AcceptedEffectsClaim> {
  const id = safeDocId(`dispatch-accepted-effects:${orderId}:1`);
  const ref = firestoreDb.collection(OUTBOX).doc(id);
  const token = crypto.randomUUID();
  return firestoreDb.runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return { claimed: false as const, status: "ACCEPTED_EFFECTS_MISSING" };
    const item = snap.data() as Record<string, unknown>;
    const authorityMatches = "paymentFactId" in authority
      ? item.paymentFactId === authority.paymentFactId
      : item.freeAuthorizationFactId === authority.freeAuthorizationFactId;
    if (item.kind !== "dispatch_accepted_effects" || item.orderId !== orderId || !authorityMatches) {
      return { claimed: false as const, status: "ACCEPTED_EFFECTS_BINDING_MISMATCH" };
    }
    if (item.status === "consumed") return { claimed: false as const, status: "ALREADY_CONSUMED" };
    if (item.status === "attention_required") return { claimed: false as const, status: "ATTENTION_REQUIRED" };
    if (item.status === "processing") {
      if (Number(item.leaseUntil || 0) > nowMs) return { claimed: false as const, status: "EFFECTS_IN_PROGRESS" };
      transaction.update(ref, { status: "attention_required", leaseUntil: null, attentionCode: "ACCEPTED_EFFECTS_LEASE_EXPIRED", updatedAt: nowIso(nowMs) });
      return { claimed: false as const, status: "ATTENTION_REQUIRED" };
    }
    transaction.update(ref, {
      status: "processing", processingToken: token, leaseUntil: nowMs + 5 * 60 * 1000,
      attempts: Number(item.attempts || 0) + 1, updatedAt: nowIso(nowMs),
    });
    return { claimed: true as const, token, item };
  });
}

async function finishAcceptedDispatchEffects(orderId: string, token: string, success: boolean): Promise<void> {
  const ref = firestoreDb.collection(OUTBOX).doc(safeDocId(`dispatch-accepted-effects:${orderId}:1`));
  await firestoreDb.runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error("ACCEPTED_EFFECTS_OUTBOX_MISSING");
    const item = snap.data() as Record<string, unknown>;
    if (item.processingToken !== token || item.status !== "processing") throw new Error("ACCEPTED_EFFECTS_CLAIM_LOST");
    transaction.update(ref, {
      status: success ? "consumed" : "attention_required", leaseUntil: null,
      ...(success ? { completedAt: nowIso(), lastResult: "FOLLOWUPS_RECORDED" } : { attentionCode: "FOLLOWUP_EFFECT_OUTCOME_UNKNOWN" }),
      updatedAt: nowIso(),
    });
  });
}

export async function drainAcceptedDispatchEffects(input: {
  orderId: string;
  authority: AcceptedDispatchAuthority;
  options?: Pick<ProcessOrderOptions, "clientIp" | "userAgent">;
  process?: (order: Order, item: Record<string, unknown>) => Promise<void>;
}): Promise<string> {
  const claim = await claimAcceptedDispatchEffects(input.orderId, input.authority);
  if (!claim.claimed) return claim.status;
  const item = claim.item;
  try {
    const orderSnap = await firestoreDb.collection("orders").doc(input.orderId).get();
    if (!orderSnap.exists) throw new Error("ACCEPTED_ORDER_MISSING");
    const order = orderSnap.data() as Order;
    if (input.process) await input.process(order, item);
    else {
      const { recordAuthorizedDispatchAccepted } = await import("@/lib/order-processor");
      await recordAuthorizedDispatchAccepted({
        orderId: input.orderId, paymentIntentId: String(item.paymentIntentId || ""), order,
        lobLetterId: String(item.providerLetterId || ""),
        ...(typeof item.trackingNumber === "string" ? { trackingNumber: item.trackingNumber } : {}),
        ...(typeof item.trackingUrl === "string" ? { trackingUrl: item.trackingUrl } : {}),
        ...(typeof item.expectedDeliveryDate === "string" ? { expectedDeliveryDate: item.expectedDeliveryDate } : {}),
        clientIp: input.options?.clientIp, userAgent: input.options?.userAgent,
        isTest: typeof item.isTest === "boolean" ? item.isTest : true,
      });
    }
    await finishAcceptedDispatchEffects(input.orderId, claim.token, true);
    return "FOLLOWUPS_RECORDED";
  } catch (error) {
    await finishAcceptedDispatchEffects(input.orderId, claim.token, false).catch(() => undefined);
    console.error("[FinanceAuthority] Accepted dispatch follow-ons need reconciliation:", error);
    return "FOLLOWUP_EFFECT_OUTCOME_UNKNOWN";
  }
}

async function reconcileKnownAcceptedPaymentDispatch(orderId: string, paymentFactId: string, snapshotHash: string, environment: string): Promise<boolean> {
  for (const lobMode of ["live", "test_api", "mock"] as const) {
    const lock = await getDispatchLock({ environment: environment as "local" | "staging" | "production", lobMode, orderId, snapshotVersion: 1 });
    if (!lock || lock.state !== "accepted" || lock.snapshotHash !== snapshotHash || typeof lock.activeAttemptId !== "string") continue;
    if (await reconcileAcceptedDispatchOutboxes(lock.activeAttemptId, { paymentFactId })) return true;
  }
  return false;
}

/**
 * The sole payment-to-fulfillment bridge. Claims the durable obligation and
 * routes the frozen order through the shared postal dispatcher.
 */
export async function consumePaymentObligation(
  orderId: string,
  paymentFactId: string,
  options: Pick<ProcessOrderOptions, "clientIp" | "userAgent"> & { processAcceptedEffects?: (order: Order, item: Record<string, unknown>) => Promise<void> } = {},
): Promise<ProcessPaidOrderResult> {
  const proof = await getVerifiedPaymentObligation(orderId);
  if (!proof || proof.paymentFact.factId !== paymentFactId) {
    return { success: false, status: "PAYMENT_AUTHORITY_INVALID", error: "Verified payment obligation is unavailable." };
  }

  // A prior process may have persisted Lob acceptance but died before the
  // payment obligation result write. Repair only from an accepted lock whose
  // attempt, snapshot and payment fact all still bind to this verified proof.
  await reconcileKnownAcceptedPaymentDispatch(orderId, paymentFactId, proof.snapshotHash, proof.paymentFact.environment);

  const now = Date.now();
  const outboxId = safeDocId(`payment-obligation:${orderId}`);
  const outboxRef = firestoreDb.collection(OUTBOX).doc(outboxId);
  const orderRef = firestoreDb.collection("orders").doc(orderId);
  const claim = await firestoreDb.runTransaction(async (transaction: any) => {
    const outboxSnap = await transaction.get(outboxRef);
    const orderSnap = await transaction.get(orderRef);
    if (!outboxSnap.exists || !orderSnap.exists) return { claimed: false, status: "OBLIGATION_MISSING" as const };
    const outbox = outboxSnap.data() as Record<string, unknown>;
    const order = orderSnap.data() as Order;
    if (
      outbox.paymentFactId !== paymentFactId || outbox.snapshotHash !== proof.snapshotHash ||
      computeOrderSnapshotHash(order) !== proof.snapshotHash
    ) {
      return { claimed: false, status: "PAYMENT_AUTHORITY_INVALID" as const };
    }
    if (outbox.status === "consumed") {
      return { claimed: false, status: "ALREADY_CONSUMED" as const, currentStatus: order.status };
    }
    if (outbox.status === "attention_required") {
      return { claimed: false, status: "ATTENTION_REQUIRED" as const };
    }
    if (outbox.status === "processing") {
      if (Number(outbox.leaseUntil || 0) > now) return { claimed: false, status: "OBLIGATION_IN_PROGRESS" as const };
      // Expired external side effects may be uncertain; require reconciliation before resubmit.
      transaction.update(outboxRef, { status: "attention_required", leaseUntil: null, attentionCode: "EXPIRED_PROCESSING_LEASE", updatedAt: nowIso(now) });
      return { claimed: false, status: "ATTENTION_REQUIRED" as const };
    }
    transaction.update(outboxRef, {
      status: "processing",
      leaseUntil: now + 5 * 60 * 1000,
      attempts: Number(outbox.attempts || 0) + 1,
      updatedAt: nowIso(now),
    });
    return { claimed: true as const, currentStatus: order.status };
  });

  if (!claim.claimed) {
    if (claim.status === "ALREADY_CONSUMED") {
      await reconcileKnownAcceptedPaymentDispatch(orderId, paymentFactId, proof.snapshotHash, proof.paymentFact.environment);
      const followupStatus = await drainAcceptedDispatchEffects({ orderId, authority: { paymentFactId }, options, process: options.processAcceptedEffects });
      return { success: true, status: claim.currentStatus || "PAYMENT_RECEIVED", alreadyProcessed: true, followupStatus };
    }
    return { success: false, status: claim.status, error: "Payment obligation is not safe to submit automatically." };
  }

  await recordAuthorizedPaymentObserved({
    orderId, order: proof.order,
    isTest: proof.paymentFact.providerMode !== "live",
    paymentMode: proof.paymentFact.providerMode === "live" ? "live" : "stripe_test",
  });

  const { dispatchAuthorizedObligation, resolvePostalObligation } = await import("@/lib/admin-console/postal/dispatch");
  const dispatch = await dispatchAuthorizedObligation({
    orderId,
    requestId: `payment-obligation:${orderId}`,
    actorId: `stripe:${proof.paymentFact.providerObjectId}`,
    evidenceRef: proof.paymentFact.evidenceRef,
    resolveObligation: resolvePostalObligation,
  });
  let result: ProcessPaidOrderResult;
  if (dispatch.status === "accepted") {
    const followupStatus = await drainAcceptedDispatchEffects({ orderId, authority: { paymentFactId }, options, process: options.processAcceptedEffects });
    result = { success: true, status: "PROCESSING_DISPATCH", lobLetterId: dispatch.providerLetterId, followupStatus };
  } else if (dispatch.status === "simulated") {
    result = { success: false, status: "QUEUED_FOR_FULFILLMENT", error: "Postal dispatch was simulated; no USPS mailing was created." };
  } else if (dispatch.status === "uncertain") {
    result = { success: false, status: "POSTAL_RESULT_AMBIGUOUS", error: "Postal result is uncertain and requires reconciliation." };
  } else {
    result = { success: false, status: dispatch.reason, error: "Payment is recorded; postal dispatch is held for reconciliation." };
  }
  await recordPaymentObligationResult(orderId, paymentFactId, result);
  return result;
}

export interface VerifiedPaymentObligation {
  orderId: string;
  order: Order;
  paymentFact: ReturnType<typeof MoneyFactSchema.parse>;
  outbox: Record<string, unknown>;
  snapshotHash: string;
  snapshotVersion: 1;
  currency: string;
  payableAmountMinor: number;
  tier: "first_class" | "certified" | "certified_return_receipt";
}

/** Read-only proof bundle for postal, reporting, and recovery consumers. */
export async function getVerifiedPaymentObligation(orderId: string): Promise<VerifiedPaymentObligation | null> {
  const orderSnap = await firestoreDb.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) return null;
  const order = orderSnap.data() as Order & { paymentFactId?: string; paymentSnapshotHash?: string };
  if (!order.paymentFactId || !order.paymentSnapshotHash) return null;

  const factSnap = await firestoreDb.collection(PAYMENT_FACTS).doc(order.paymentFactId).get();
  const outboxSnap = await firestoreDb.collection(OUTBOX).doc(safeDocId(`payment-obligation:${orderId}`)).get();
  if (!factSnap.exists || !outboxSnap.exists) return null;
  const paymentFact = MoneyFactSchema.safeParse(factSnap.data());
  if (!paymentFact.success) return null;
  const outbox = outboxSnap.data() as Record<string, unknown>;
  const snapshotHash = computeOrderSnapshotHash(order);
  const amount = order.finalAmountInCents ?? order.amountInCents;
  if (
    paymentFact.data.kind !== "capture" || paymentFact.data.verification !== "verified" ||
    paymentFact.data.orderId !== orderId || paymentFact.data.provider !== "stripe" ||
    paymentFact.data.providerObjectId !== order.stripePaymentId || paymentFact.data.amountMinor !== amount ||
    outbox.kind !== "payment_obligation" || outbox.orderId !== orderId ||
    outbox.paymentFactId !== order.paymentFactId || outbox.snapshotHash !== order.paymentSnapshotHash ||
    order.paymentSnapshotHash !== snapshotHash
  ) return null;

  const tier = order.serviceLevel === "FIRST_CLASS"
    ? "first_class"
    : order.serviceLevel === "CERTIFIED_RETURN_RECEIPT"
    ? "certified_return_receipt"
    : "certified";
  return {
    orderId,
    order,
    paymentFact: paymentFact.data,
    outbox,
    snapshotHash,
    snapshotVersion: 1,
    currency: paymentFact.data.currency,
    payableAmountMinor: paymentFact.data.amountMinor,
    tier,
  };
}

export function stableProviderFactId(
  accountId: string,
  mode: string,
  providerObjectId: string,
  kind: string,
): string {
  const component = kind === "processor_fee" ? "processor_fee" : "cash_movement";
  return safeDocId(`${accountId}:${mode}:${component}:${providerObjectId}`);
}
