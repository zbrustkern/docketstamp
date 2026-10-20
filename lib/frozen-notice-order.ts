import { createHash } from "node:crypto";
import type { Order } from "./types";
import { isFrozenNoticeVersionSupported } from "./order-record";

/**
 * Server-only dispatch gate. Historical reads may be incomplete, but a notice
 * can enter payment/dispatch only when its exact frozen bytes remain verifiable.
 */
export function validateFrozenNoticeOrder(order: Order): string | null {
  if (!isFrozenNoticeVersionSupported(order)) return "CANONICAL_NOTICE_ORDER_REQUIRED";
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
  // New orders use a truthful preparation footer. Accept the old marker only
  // for already-frozen historical snapshots that predate this wording change.
  if (
    !order.documentHtml.includes("DOCUMENT PREPARATION RECORD:") &&
    !order.documentHtml.includes("DOCKET RECORD & DISPATCH CERTIFICATION")
  ) return "UPL_FOOTER_REQUIRED";
  return null;
}
