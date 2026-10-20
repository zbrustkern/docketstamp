import { getNoticeById } from "@/src/lib/docket/notices";

export type NoticeReportingCohort = "notice" | "legacy_card" | "unknown";

/** Resolve reporting labels from the canonical notice registry; never trust a client label. */
export function resolveNoticeReporting(input: { noticeId?: unknown; noticeSlug?: unknown; experienceVersion?: unknown }): {
  cohort: NoticeReportingCohort;
  category?: string;
} {
  const noticeRef = typeof input.noticeId === "string" ? input.noticeId : typeof input.noticeSlug === "string" ? input.noticeSlug : "";
  const definition = getNoticeById(noticeRef);
  if (definition) return { cohort: "notice", category: definition.category };
  if (input.experienceVersion === "home_v2") return { cohort: "legacy_card" };
  return { cohort: "unknown" };
}
