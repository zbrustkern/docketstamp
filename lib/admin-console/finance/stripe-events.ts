import crypto from "node:crypto";
import type Stripe from "stripe";
import { firestoreDb } from "@/lib/firebase-admin";
import { MoneyFactSchema, ProviderEventReceiptSchema } from "@/lib/admin-console/contracts";
import { recordPaymentAuthority, stableProviderFactId } from "./authority";

const RECEIPTS = "provider_event_receipts_v1";
const FACTS = "payment_facts_v1";

function appEnvironment(): "local" | "staging" | "production" {
  if (process.env.NODE_ENV === "production" && process.env.ENVIRONMENT !== "staging") return "production";
  if (process.env.ENVIRONMENT === "staging" || process.env.FIREBASE_PROJECT_ID === "docketstamp-staging") return "staging";
  return "local";
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stripeMode(livemode: boolean): "live" | "test" {
  return livemode ? "live" : "test";
}

function accountId(event: Stripe.Event): string {
  return event.account || process.env.STRIPE_ACCOUNT_ID || "stripe_platform_default";
}

function receiptDocId(account: string, mode: string, eventId: string): string {
  return hash(`stripe:${account}:${mode}:${eventId}`);
}

async function recordReceiptOnly(
  event: Stripe.Event,
  details: { status?: "accepted" | "unmatched" | "quarantined"; providerState?: "pending" | "succeeded" | "failed" | "canceled" | "requires_action" | "won" | "lost" | "under_review" | "unknown"; orderId?: string; diagnosticCodes?: string[]; body?: unknown },
) {
  const mode = stripeMode(event.livemode);
  const account = accountId(event);
  const receivedAt = new Date().toISOString();
  const receipt = ProviderEventReceiptSchema.parse({
    schemaVersion: 1,
    product: "docketstamp",
    environment: appEnvironment(),
    receiptId: receiptDocId(account, mode, event.id),
    provider: "stripe",
    providerAccountId: account,
    providerMode: mode,
    providerEventId: event.id,
    providerEventType: event.type,
    bodyDigest: hash(details.body || { id: event.id, type: event.type, created: event.created }),
    receivedAt,
    status: details.status || "accepted",
    ...(details.providerState ? { providerState: details.providerState } : {}),
    ...(details.orderId ? { orderId: details.orderId } : {}),
    diagnosticCodes: details.diagnosticCodes || [],
  });
  const ref = firestoreDb.collection(RECEIPTS).doc(receipt.receiptId);
  const conflictRef = firestoreDb.collection(RECEIPTS).doc(`${receipt.receiptId.slice(0, 40)}_${receipt.bodyDigest.slice(0, 20)}`);
  return firestoreDb.runTransaction(async (tx: any) => {
    const [existing, conflict] = await Promise.all([tx.get(ref), tx.get(conflictRef)]);
    if (existing.exists) {
      const prior = existing.data() as Record<string, unknown>;
      if (prior.bodyDigest !== receipt.bodyDigest) {
        const row = { ...receipt, receiptId: conflictRef.id, status: "conflict" as const, diagnosticCodes: ["DUPLICATE_CONFLICT"] };
        if (!conflict.exists) tx.set(conflictRef, row);
        return { accepted: false, duplicate: false, status: "conflict" as const };
      }
      if (prior.status === "unmatched" && receipt.status === "accepted") {
        tx.set(ref, receipt);
        return { accepted: true, duplicate: false, status: "accepted" as const };
      }
      return { accepted: prior.status === "accepted", duplicate: true, status: "duplicate" as const };
    }
    tx.set(ref, receipt);
    return { accepted: true, duplicate: false, status: receipt.status };
  });
}

async function findPaymentFactByIntent(paymentIntentId: string, account: string, mode: string) {
  if (!paymentIntentId) return null;
  const snap = await firestoreDb.collection(FACTS)
    .where("provider", "==", "stripe")
    .where("providerAccountId", "==", account)
    .where("providerMode", "==", mode)
    .where("providerObjectId", "==", paymentIntentId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].data() as Record<string, unknown>;
}

async function recordCashFact(
  event: Stripe.Event,
  kind: "refund" | "dispute_debit" | "dispute_reversal" | "processor_fee",
  cashId: string,
  orderId: string,
  currency: string,
  amountMinor: number,
  effectiveAtSeconds: number,
  sourceObjectId: string,
  classification?: Record<string, unknown>,
) {
  const mode = stripeMode(event.livemode);
  const account = accountId(event);
  const factId = stableProviderFactId(account, mode, cashId, kind);
  const fact = MoneyFactSchema.parse({
    schemaVersion: 1,
    product: "docketstamp",
    environment: appEnvironment(),
    factId,
    orderId,
    currency: currency.toUpperCase(),
    amountMinor: Math.abs(amountMinor),
    kind,
    provider: "stripe",
    providerAccountId: account,
    providerMode: mode,
    providerObjectId: cashId,
    effectiveAt: new Date(effectiveAtSeconds * 1000).toISOString(),
    receivedAt: new Date().toISOString(),
    verification: "verified",
    evidenceRef: `stripe/${event.type}/${sourceObjectId}/${cashId}`,
    ...(classification ? { classification } : {}),
  });
  const receiptId = receiptDocId(account, mode, event.id);
  const bodyDigest = hash({ eventId: event.id, type: event.type, created: event.created, object: event.data.object });
  const receipt = ProviderEventReceiptSchema.parse({
    schemaVersion: 1,
    product: "docketstamp",
    environment: appEnvironment(),
    receiptId,
    provider: "stripe",
    providerAccountId: account,
    providerMode: mode,
    providerEventId: event.id,
    providerEventType: event.type,
    bodyDigest,
    receivedAt: new Date().toISOString(),
    status: "accepted",
    factId,
    orderId,
    diagnosticCodes: [],
  });
  const receiptRef = firestoreDb.collection(RECEIPTS).doc(receiptId);
  const conflictReceiptRef = firestoreDb.collection(RECEIPTS).doc(`${receiptId.slice(0, 40)}_${bodyDigest.slice(0, 20)}`);
  const factRef = firestoreDb.collection(FACTS).doc(factId);
  return firestoreDb.runTransaction(async (tx: any) => {
    const [priorReceipt, priorFact, priorConflict] = await Promise.all([tx.get(receiptRef), tx.get(factRef), tx.get(conflictReceiptRef)]);
    if (priorFact.exists) {
      const prior = priorFact.data() as Record<string, unknown>;
      if (prior.kind !== kind || prior.amountMinor !== fact.amountMinor || prior.currency !== fact.currency || prior.orderId !== orderId) {
        const conflict = { ...receipt, receiptId: conflictReceiptRef.id, status: "conflict" as const, diagnosticCodes: ["DUPLICATE_CONFLICT"] };
        if (!priorConflict.exists) tx.set(conflictReceiptRef, conflict);
        return { accepted: false, duplicate: false, status: "conflict" as const };
      }
    } else {
      tx.set(factRef, fact);
    }
    if (priorReceipt.exists) {
      const prior = priorReceipt.data() as Record<string, unknown>;
      if (prior.bodyDigest !== bodyDigest) {
        const conflict = { ...receipt, receiptId: conflictReceiptRef.id, status: "conflict" as const, diagnosticCodes: ["DUPLICATE_CONFLICT"] };
        if (!priorConflict.exists) tx.set(conflictReceiptRef, conflict);
      }
    } else {
      tx.set(receiptRef, receipt);
    }
    return { accepted: true, duplicate: priorFact.exists, factId, status: priorFact.exists ? "duplicate" as const : "accepted" as const };
  });
}

/** Durable, sanitized Stripe event normalization. It never triggers dispatch or money movement. */
export async function ingestStripeEvidenceEvent(event: Stripe.Event): Promise<{
  accepted: boolean;
  duplicate: boolean;
  status: string;
  orderId?: string;
  paymentFactId?: string;
  diagnosticCodes?: string[];
}> {
  const mode = stripeMode(event.livemode);
  const account = accountId(event);

  if (event.type === "payment_intent.succeeded") {
    const result = await recordPaymentAuthority(event.data.object as Stripe.PaymentIntent, {
      eventId: event.id,
      eventType: event.type,
      eventLivemode: event.livemode,
      occurredAt: event.created * 1000,
      accountId: event.account,
      receivedAt: Date.now(),
    });
    return { ...result };
  }

  if (event.type.startsWith("payment_intent.")) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const providerState: "pending" | "succeeded" | "failed" | "canceled" | "requires_action" | "unknown" = ({
      succeeded: "succeeded",
      processing: "pending",
      requires_action: "requires_action",
      requires_capture: "pending",
      requires_confirmation: "pending",
      requires_payment_method: "failed",
      canceled: "canceled",
    } as Record<string, "pending" | "succeeded" | "failed" | "canceled" | "requires_action" | "unknown">)[intent.status] || "unknown";
    const orderId = typeof intent.metadata?.orderId === "string" ? intent.metadata.orderId : "";
    const orderSnap = orderId ? await firestoreDb.collection("orders").doc(orderId).get() : null;
    const diagnostics = orderSnap?.exists ? [] : ["MISSING_ORDER"];
    const receipt = await recordReceiptOnly(event, {
      status: orderSnap?.exists ? "accepted" : "unmatched",
      providerState,
      orderId: orderSnap?.exists ? orderId : undefined,
      diagnosticCodes: diagnostics,
      body: { id: intent.id, type: event.type, status: intent.status, amount: intent.amount, currency: intent.currency },
    });
    return { accepted: receipt.accepted, duplicate: receipt.duplicate, status: receipt.status, orderId: orderSnap?.exists ? orderId : undefined, diagnosticCodes: diagnostics };
  }

  if (event.type.startsWith("refund.")) {
    const refund = event.data.object as Stripe.Refund;
    const status = refund.status || "unknown";
    const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
    const capture = paymentIntentId ? await findPaymentFactByIntent(paymentIntentId, account, mode) : null;
    const transactionId = typeof refund.balance_transaction === "string" ? refund.balance_transaction : refund.balance_transaction?.id;
    if (status === "succeeded" && transactionId && capture?.orderId && Number.isInteger(refund.amount) && refund.currency) {
      const result = await recordCashFact(event, "refund", transactionId, String(capture.orderId), refund.currency, refund.amount, refund.created || event.created, refund.id, capture.classification as Record<string, unknown> | undefined);
      return { accepted: result.accepted, duplicate: result.duplicate, status: result.status, orderId: String(capture.orderId) };
    }
    const diagnostics = !capture ? ["MISSING_ORDER"] : status === "succeeded" ? ["RECONCILIATION_REQUIRED"] : [];
    const receipt = await recordReceiptOnly(event, {
      status: !capture ? "unmatched" : status === "succeeded" ? "quarantined" : "accepted",
      providerState: status === "pending" || status === "succeeded" || status === "failed" || status === "canceled" || status === "requires_action" ? status : "unknown",
      orderId: capture?.orderId ? String(capture.orderId) : undefined,
      diagnosticCodes: diagnostics,
      body: { id: refund.id, status, amount: refund.amount, currency: refund.currency, balanceTransactionId: transactionId },
    });
    return { accepted: receipt.accepted, duplicate: receipt.duplicate, status: receipt.status, orderId: capture?.orderId ? String(capture.orderId) : undefined, diagnosticCodes: diagnostics };
  }

  if (event.type.startsWith("charge.") && !event.type.startsWith("charge.dispute.")) {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    const capture = paymentIntentId ? await findPaymentFactByIntent(paymentIntentId, account, mode) : null;
    const balance = typeof charge.balance_transaction === "object" && charge.balance_transaction !== null
      ? charge.balance_transaction as Stripe.BalanceTransaction
      : null;
    if (event.type === "charge.succeeded" && capture?.orderId && balance && Number.isInteger(balance.fee) && balance.id) {
      const result = await recordCashFact(event, "processor_fee", balance.id, String(capture.orderId), balance.currency, balance.fee, balance.created || event.created, charge.id, capture.classification as Record<string, unknown> | undefined);
      return { accepted: result.accepted, duplicate: result.duplicate, status: result.status, orderId: String(capture.orderId) };
    }
    const diagnostics = !capture ? ["MISSING_ORDER"] : event.type === "charge.succeeded" ? ["RECONCILIATION_REQUIRED"] : [];
    const receipt = await recordReceiptOnly(event, {
      status: !capture ? "unmatched" : "accepted",
      orderId: capture?.orderId ? String(capture.orderId) : undefined,
      diagnosticCodes: diagnostics,
      body: { id: charge.id, type: event.type, paymentIntentId, balanceTransactionId: balance?.id },
    });
    return { accepted: receipt.accepted, duplicate: receipt.duplicate, status: receipt.status, orderId: capture?.orderId ? String(capture.orderId) : undefined, diagnosticCodes: diagnostics };
  }

  if (event.type.startsWith("charge.dispute.")) {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
    const disputePaymentIntentId = typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
    const chargeSnap = await firestoreDb.collection(FACTS)
      .where("provider", "==", "stripe")
      .where("providerAccountId", "==", account)
      .where("providerMode", "==", mode)
      .where("providerObjectId", "==", disputePaymentIntentId || "")
      .limit(1).get();
    const capture = chargeSnap.empty ? null : chargeSnap.docs[0].data() as Record<string, unknown>;
    const balanceTxns = Array.isArray(dispute.balance_transactions) ? dispute.balance_transactions : [];
    const signedTxns = balanceTxns.filter((item): item is Stripe.BalanceTransaction =>
      typeof item === "object" && item !== null && "amount" in item && "id" in item && item.amount !== 0,
    );
    if (capture?.orderId && signedTxns.length) {
      const results = [];
      for (const txn of signedTxns) {
        const kind = txn.amount < 0 ? "dispute_debit" : "dispute_reversal";
        results.push(await recordCashFact(event, kind, txn.id, String(capture.orderId), txn.currency, txn.amount, txn.created || event.created, dispute.id, capture.classification as Record<string, unknown> | undefined));
      }
      const failed = results.some((result) => !result.accepted);
      return { accepted: !failed, duplicate: results.every((result) => result.duplicate), status: failed ? "conflict" : "accepted", orderId: String(capture.orderId) };
    }
    const diagnostics = !capture ? ["MISSING_ORDER"] : ["RECONCILIATION_REQUIRED"];
    const receipt = await recordReceiptOnly(event, {
      status: !capture ? "unmatched" : "accepted",
      orderId: capture?.orderId ? String(capture.orderId) : undefined,
      diagnosticCodes: diagnostics,
      body: { id: dispute.id, status: dispute.status, chargeId, balanceTransactionIds: balanceTxns.map((txn) => typeof txn === "string" ? txn : txn.id) },
    });
    return { accepted: receipt.accepted, duplicate: receipt.duplicate, status: receipt.status, orderId: capture?.orderId ? String(capture.orderId) : undefined, diagnosticCodes: diagnostics };
  }

  const receipt = await recordReceiptOnly(event, { body: { id: event.id, type: event.type, created: event.created } });
  return { accepted: receipt.accepted, duplicate: receipt.duplicate, status: receipt.status };
}
