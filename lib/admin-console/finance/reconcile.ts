import crypto from "node:crypto";
import { serverEnvironment } from "@/lib/admin-console/commands/access";
import type Stripe from "stripe";
import { firestoreDb } from "@/lib/firebase-admin";
import { getStripeClient } from "@/lib/stripe";
import { ingestStripeEvidenceEvent } from "./stripe-events";

const RECONCILIATION_RUNS = "reconciliation_runs_v1";
const STRIPE_EVENT_TYPES = [
  "payment_intent.succeeded",
  "charge.succeeded",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
];
const OVERLAP_SECONDS = 48 * 60 * 60;
const MAX_LOOKBACK_SECONDS = 30 * 24 * 60 * 60;

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeModeName(): "live" | "test" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY || process.env["stripe-secret-key"] || "";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "unknown";
}

export interface StripeReconcileRequest {
  limit: number;
  startAtSeconds?: number;
  endAtSeconds?: number;
  startingAfter?: string;
}

export interface StripeReconcileResult {
  runId: string;
  status: "complete" | "partial" | "failed";
  windowStartSeconds: number;
  windowEndSeconds: number;
  fetched: number;
  accepted: number;
  duplicates: number;
  unmatched: number;
  quarantined: number;
  nextCursor?: string;
  diagnostics: string[];
}

/** One bounded page of signed-account evidence. This function never invokes dispatch, email or ad consumers. */
export async function reconcileStripeEvidencePage(
  input: StripeReconcileRequest,
  stripeClient: Stripe = getStripeClient(),
): Promise<StripeReconcileResult> {
  const limit = Number.isInteger(input.limit) ? Math.min(100, Math.max(1, input.limit)) : 100;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accountId = process.env.STRIPE_ACCOUNT_ID || "stripe_platform_default";
  const mode = safeModeName();
  if (mode === "unknown") throw new Error("Stripe secret key mode is unconfigured; evidence reconciliation is unavailable.");

  const checkpointId = hash(`stripe:${accountId}:${mode}`);
  const checkpointRef = firestoreDb.collection(RECONCILIATION_RUNS).doc(`checkpoint_${checkpointId}`);
  const checkpointSnap = await checkpointRef.get();
  const checkpoint = checkpointSnap.exists ? checkpointSnap.data() as Record<string, unknown> : {};

  let windowStartSeconds = input.startAtSeconds;
  let windowEndSeconds = input.endAtSeconds;
  let startingAfter = input.startingAfter;
  if (!Number.isInteger(windowStartSeconds) || !Number.isInteger(windowEndSeconds)) {
    if (!startingAfter && checkpoint.status === "partial" && typeof checkpoint.nextCursor === "string") {
      startingAfter = String(checkpoint.nextCursor);
    }
    if (startingAfter && Number.isInteger(checkpoint.windowStartSeconds) && Number.isInteger(checkpoint.windowEndSeconds)) {
      windowStartSeconds = Number(checkpoint.windowStartSeconds);
      windowEndSeconds = Number(checkpoint.windowEndSeconds);
    } else {
      windowEndSeconds = nowSeconds;
      const priorEnd = Number(checkpoint.windowEndSeconds);
      windowStartSeconds = Number.isInteger(priorEnd)
        ? Math.max(nowSeconds - MAX_LOOKBACK_SECONDS, priorEnd - OVERLAP_SECONDS)
        : nowSeconds - 7 * 24 * 60 * 60;
      startingAfter = undefined;
    }
  }

  if (!Number.isInteger(windowStartSeconds) || !Number.isInteger(windowEndSeconds) ||
      (windowStartSeconds as number) >= (windowEndSeconds as number) ||
      (windowEndSeconds as number) > nowSeconds + 60 ||
      (windowEndSeconds as number) - (windowStartSeconds as number) > MAX_LOOKBACK_SECONDS) {
    throw new Error("Reconciliation window must be a non-empty interval no longer than 30 days and cannot extend into the future.");
  }

  const runId = `stripe_run_${crypto.randomUUID()}`;
  const runRef = firestoreDb.collection(RECONCILIATION_RUNS).doc(runId);
  const startedAt = new Date().toISOString();
  await runRef.set({
    schemaVersion: 1,
      product: "docketstamp",
      environment: serverEnvironment(),
    provider: "stripe",
    providerAccountId: accountId,
    providerMode: mode,
    runId,
    status: "running",
    windowStartSeconds,
    windowEndSeconds,
    startingAfter: startingAfter || null,
    limit,
    startedAt,
    counts: { fetched: 0, accepted: 0, duplicates: 0, unmatched: 0, quarantined: 0 },
    diagnostics: [],
  });

  try {
    const page = await stripeClient.events.list({
      limit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      created: { gte: windowStartSeconds as number, lt: windowEndSeconds as number },
      types: STRIPE_EVENT_TYPES,
    });
    const counts = { fetched: page.data.length, accepted: 0, duplicates: 0, unmatched: 0, quarantined: 0 };
    const diagnostics = new Set<string>();
    for (const event of page.data) {
      const result = await ingestStripeEvidenceEvent(event);
      if (result.duplicate) counts.duplicates++;
      else if (result.status === "accepted") counts.accepted++;
      else if (result.status === "unmatched") counts.unmatched++;
      else counts.quarantined++;
      for (const code of result.diagnosticCodes || []) diagnostics.add(code);
    }

    const lastId = page.data.length ? page.data[page.data.length - 1].id : undefined;
    const nextCursor = page.has_more ? lastId : undefined;
    const status = page.has_more ? "partial" : "complete";
    const endedAt = new Date().toISOString();
    const runUpdate = {
      status,
      endedAt,
      nextCursor: nextCursor || null,
      counts,
      diagnostics: Array.from(diagnostics),
      completeThroughSeconds: page.has_more ? null : windowEndSeconds,
    };
    await runRef.update(runUpdate);
    await checkpointRef.set({
      schemaVersion: 1,
      product: "docketstamp",
      environment: serverEnvironment(),
      provider: "stripe",
      providerAccountId: accountId,
      providerMode: mode,
      status,
      windowStartSeconds,
      windowEndSeconds,
      nextCursor: nextCursor || null,
      completeThroughSeconds: page.has_more ? checkpoint.completeThroughSeconds || null : windowEndSeconds,
      updatedAt: endedAt,
      lastRunId: runId,
      counts,
    });
    return {
      runId,
      status,
      windowStartSeconds: windowStartSeconds as number,
      windowEndSeconds: windowEndSeconds as number,
      ...counts,
      ...(nextCursor ? { nextCursor } : {}),
      diagnostics: Array.from(diagnostics),
    };
  } catch (error) {
    const endedAt = new Date().toISOString();
    await runRef.update({ status: "failed", endedAt, diagnostics: ["PROVIDER_TIMEOUT"] });
    await checkpointRef.set({
      schemaVersion: 1,
      product: "docketstamp",
      environment: serverEnvironment(),
      provider: "stripe",
      providerAccountId: accountId,
      providerMode: mode,
      status: "failed",
      windowStartSeconds,
      windowEndSeconds,
      nextCursor: startingAfter || null,
      updatedAt: endedAt,
      lastRunId: runId,
      diagnostics: ["PROVIDER_TIMEOUT"],
    });
    throw error;
  }
}
