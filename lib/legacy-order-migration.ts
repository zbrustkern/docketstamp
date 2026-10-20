import { createHash } from "node:crypto";
import { readOrderRecord, type PostalProvider } from "./order-record";

export interface LegacyOrderClassification {
  orderId: string;
  schemaVersion: 1 | 2;
  kind: "notice" | "legacy" | "unknown";
  provider: PostalProvider;
  provenanceEvidence: "canonical" | "legacy_field" | "conflict" | "missing";
  hasFrozenHtml: boolean;
  hasIntegrityEvidence: boolean;
  status: string;
}

export interface MigrationCounts {
  total: number;
  canonicalV2: number;
  legacy: number;
  unknownKind: number;
  lob: number;
  handwrytten: number;
  unknownProvider: number;
  conflicts: number;
  frozenHtml: number;
  integrityEvidence: number;
}

export interface LegacyOrderMigrationManifest {
  schemaVersion: 1;
  runId: string;
  dryRun: true;
  generatedAt: string;
  beforeCounts: MigrationCounts;
  afterCounts: MigrationCounts;
  processedOrderIds: string[];
  changes: Array<{
    migrationId: string;
    orderId: string;
    provider: "lob" | "handwrytten";
    reference: string;
    patch: { postalProvider: "lob" | "handwrytten"; postalProviderReference: string };
  }>;
  quarantined: Array<{ orderId: string; reason: string }>;
  rollbackMappings: Array<{
    migrationId: string;
    orderId: string;
    restore: { postalProvider?: unknown; postalProviderReference?: unknown };
  }>;
  checkpoint: { lastOrderId?: string; nextOrderId?: string; complete: boolean };
}

export function classifyLegacyOrder(raw: unknown): LegacyOrderClassification {
  const result = readOrderRecord(raw);
  const order = result.order as unknown as Record<string, unknown>;
  return {
    orderId: typeof order.id === "string" ? order.id : "unknown",
    schemaVersion: result.schemaVersion,
    kind: result.kind,
    provider: result.postal.provider,
    provenanceEvidence: result.postal.evidence,
    hasFrozenHtml: typeof order.documentHtml === "string" && order.documentHtml.length > 0,
    hasIntegrityEvidence: Boolean(order.documentIntegrityEvidence),
    status: typeof order.status === "string" ? order.status : "unknown",
  };
}

export function countLegacyOrders(records: unknown[]): MigrationCounts {
  const counts: MigrationCounts = {
    total: 0, canonicalV2: 0, legacy: 0, unknownKind: 0,
    lob: 0, handwrytten: 0, unknownProvider: 0, conflicts: 0,
    frozenHtml: 0, integrityEvidence: 0,
  };
  for (const raw of records) {
    const item = classifyLegacyOrder(raw);
    counts.total += 1;
    if (item.schemaVersion === 2 && item.kind === "notice") counts.canonicalV2 += 1;
    else if (item.kind === "legacy") counts.legacy += 1;
    else counts.unknownKind += 1;
    if (item.provider === "lob") counts.lob += 1;
    else if (item.provider === "handwrytten") counts.handwrytten += 1;
    else counts.unknownProvider += 1;
    if (item.provenanceEvidence === "conflict") counts.conflicts += 1;
    if (item.hasFrozenHtml) counts.frozenHtml += 1;
    if (item.hasIntegrityEvidence) counts.integrityEvidence += 1;
  }
  return counts;
}

function migrationId(runId: string, orderId: string): string {
  return createHash("sha256").update(`${runId}:${orderId}`).digest("hex").slice(0, 24);
}

/**
 * Create a fixture-only dry-run batch. Only explicit, unambiguous legacy provider
 * references receive a proposed provenance annotation. Frozen HTML, digest,
 * payment, ownership, and dispatch fields never appear in an update patch.
 */
export function planLegacyOrderMigration(input: {
  records: unknown[];
  runId: string;
  batchSize?: number;
  afterOrderId?: string;
  priorManifest?: LegacyOrderMigrationManifest;
  now?: Date;
}): LegacyOrderMigrationManifest {
  if (!input.runId.trim()) throw new Error("MIGRATION_RUN_ID_REQUIRED");
  const all = input.records
    .map((raw) => ({ raw, item: classifyLegacyOrder(raw) }))
    .sort((a, b) => a.item.orderId.localeCompare(b.item.orderId));
  const batchSize = Math.max(1, Math.min(500, input.batchSize ?? 100));
  const afterOrderId = input.afterOrderId || input.priorManifest?.checkpoint.lastOrderId;
  const pending = all.filter(({ item }) => !afterOrderId || item.orderId > afterOrderId);
  const batch = pending.slice(0, batchSize);
  const processed = [...new Set([...(input.priorManifest?.processedOrderIds || []), ...batch.map(({ item }) => item.orderId)])].sort();
  const previousChanges = input.priorManifest?.changes || [];
  const previousQuarantine = input.priorManifest?.quarantined || [];
  const previousRollbacks = input.priorManifest?.rollbackMappings || [];
  const changeByOrder = new Map(previousChanges.map((change) => [change.orderId, change]));
  const quarantineByOrder = new Map(previousQuarantine.map((item) => [item.orderId, item]));
  const rollbackByOrder = new Map(previousRollbacks.map((item) => [item.orderId, item]));

  for (const { raw, item } of batch) {
    if (item.schemaVersion === 2 && item.kind === "notice") continue;
    if (item.provider === "unknown") {
      quarantineByOrder.set(item.orderId, {
        orderId: item.orderId,
        reason: item.provenanceEvidence === "conflict" ? "PROVIDER_PROVENANCE_CONFLICT" : "PROVIDER_PROVENANCE_UNKNOWN",
      });
      continue;
    }
    if (item.provenanceEvidence !== "legacy_field") continue;
    const order = raw as Record<string, unknown>;
    const reference = item.provider === "lob"
      ? (typeof order.lobLetterId === "string" ? order.lobLetterId : "")
      : (typeof order.handwryttenOrderId === "string" ? order.handwryttenOrderId : "");
    if (!reference) {
      quarantineByOrder.set(item.orderId, { orderId: item.orderId, reason: "PROVIDER_REFERENCE_MISSING" });
      continue;
    }
    const id = migrationId(input.runId, item.orderId);
    changeByOrder.set(item.orderId, {
      migrationId: id,
      orderId: item.orderId,
      provider: item.provider,
      reference,
      patch: { postalProvider: item.provider, postalProviderReference: reference },
    });
    rollbackByOrder.set(item.orderId, {
      migrationId: id,
      orderId: item.orderId,
      restore: {
        postalProvider: order.postalProvider,
        postalProviderReference: order.postalProviderReference,
      },
    });
  }

  const projected = all.map(({ raw, item }) => {
    const change = changeByOrder.get(item.orderId);
    return change ? { ...(raw as Record<string, unknown>), ...change.patch } : raw;
  });
  const lastOrderId = batch.at(-1)?.item.orderId || afterOrderId;
  const nextOrderId = pending.length > batch.length ? pending[batch.length]?.item.orderId : undefined;
  return {
    schemaVersion: 1,
    runId: input.runId,
    dryRun: true,
    generatedAt: (input.now || new Date()).toISOString(),
    beforeCounts: countLegacyOrders(input.records),
    afterCounts: countLegacyOrders(projected),
    processedOrderIds: processed,
    changes: [...changeByOrder.values()].sort((a, b) => a.orderId.localeCompare(b.orderId)),
    quarantined: [...quarantineByOrder.values()].sort((a, b) => a.orderId.localeCompare(b.orderId)),
    rollbackMappings: [...rollbackByOrder.values()].sort((a, b) => a.orderId.localeCompare(b.orderId)),
    checkpoint: { ...(lastOrderId ? { lastOrderId } : {}), ...(nextOrderId ? { nextOrderId } : {}), complete: !nextOrderId },
  };
}
