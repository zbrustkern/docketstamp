import { createHash } from "node:crypto";
import type { Order } from "./types";

export type PostalProvider = "lob" | "handwrytten" | "unknown";

export interface PostalProvenance {
  provider: PostalProvider;
  reference?: string;
  evidence: "canonical" | "legacy_field" | "conflict" | "missing";
}

export interface OrderRecordRead {
  order: Order;
  schemaVersion: 1 | 2;
  kind: "notice" | "legacy" | "unknown";
  postal: PostalProvenance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve a postal reference only from explicit provider evidence. A raw
 * Handwrytten identifier is retained as historical evidence and is never a Lob
 * lookup key. Conflicting old aliases remain unknown until reconciled.
 */
export function resolvePostalProvenance(raw: unknown): PostalProvenance {
  if (!isRecord(raw)) return { provider: "unknown", evidence: "missing" };
  const canonicalProvider = raw.postalProvider;
  const canonicalReference = typeof raw.postalProviderReference === "string"
    ? raw.postalProviderReference
    : undefined;

  if (canonicalProvider === "lob") {
    const reference = canonicalReference || (typeof raw.lobLetterId === "string" ? raw.lobLetterId : undefined);
    return reference
      ? { provider: "lob", reference, evidence: "canonical" }
      : { provider: "unknown", evidence: "conflict" };
  }
  if (canonicalProvider === "handwrytten") {
    const reference = canonicalReference || (typeof raw.handwryttenOrderId === "string" ? raw.handwryttenOrderId : undefined);
    return reference
      ? { provider: "handwrytten", reference, evidence: "canonical" }
      : { provider: "unknown", evidence: "conflict" };
  }
  if (canonicalProvider === "unknown") {
    return { provider: "unknown", ...(canonicalReference ? { reference: canonicalReference } : {}), evidence: "canonical" };
  }

  const lobId = typeof raw.lobLetterId === "string" && raw.lobLetterId.trim() ? raw.lobLetterId : undefined;
  const legacyId = typeof raw.handwryttenOrderId === "string" && raw.handwryttenOrderId.trim()
    ? raw.handwryttenOrderId
    : undefined;
  if (lobId && legacyId) {
    return { provider: "unknown", reference: legacyId, evidence: "conflict" };
  }
  if (lobId) return { provider: "lob", reference: lobId, evidence: "legacy_field" };
  if (legacyId) return { provider: "handwrytten", reference: legacyId, evidence: "legacy_field" };
  return { provider: "unknown", evidence: "missing" };
}

/** Pure reader adapter. It does not rewrite or discard legacy fields. */
export function readOrderRecord(raw: unknown): OrderRecordRead {
  if (!isRecord(raw)) {
    return {
      order: {} as Order,
      schemaVersion: 1,
      kind: "unknown",
      postal: { provider: "unknown", evidence: "missing" },
    };
  }
  const schemaVersion = raw.schemaVersion === 2 ? 2 : 1;
  const kind = schemaVersion === 2 && raw.kind === "notice"
    ? "notice"
    : raw.id && (raw.noticeId || raw.noticeType || raw.frontImageUrl || raw.handwryttenOrderId)
    ? "legacy"
    : "unknown";
  return {
    order: raw as unknown as Order,
    schemaVersion,
    kind,
    postal: resolvePostalProvenance(raw),
  };
}

/** Dispatch accepts only a v2 notice with a byte-for-byte verified frozen snapshot. */
export function validateFrozenNoticeOrder(order: Order): string | null {
  if (order.schemaVersion !== 2 || order.kind !== "notice") return "CANONICAL_NOTICE_ORDER_REQUIRED";
  if (!order.noticeId || !order.noticeType || !order.docketId || !order.serviceLevel) return "NOTICE_METADATA_INCOMPLETE";
  if (!order.documentHtml || !order.documentIntegrityEvidence) return "FROZEN_SNAPSHOT_REQUIRED";
  const evidence = order.documentIntegrityEvidence;
  if (evidence.schemaVersion !== 1 || evidence.algorithm !== "sha256" || !/^[a-f0-9]{64}$/i.test(evidence.digest)) {
    return "SNAPSHOT_INTEGRITY_EVIDENCE_INVALID";
  }
  const digest = createHash("sha256").update(Buffer.from(order.documentHtml, "utf8")).digest("hex");
  if (digest !== evidence.digest) return "SNAPSHOT_DIGEST_MISMATCH";
  if (
    !evidence.signatureAdoption?.signerName?.trim() ||
    !Number.isFinite(evidence.signatureAdoption.adoptedAt) ||
    !Number.isFinite(evidence.lockedAt) ||
    !evidence.signatureAdoption.affirmationVersion
  ) return "SIGNATURE_ADOPTION_EVIDENCE_REQUIRED";
  if (!order.documentHtml.includes("DOCKET RECORD & DISPATCH CERTIFICATION")) return "UPL_FOOTER_REQUIRED";
  return null;
}
