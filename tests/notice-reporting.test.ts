import assert from "node:assert/strict";
import { resolveNoticeReporting } from "../lib/notice-reporting";

assert.deepEqual(resolveNoticeReporting({ noticeSlug: "service-policy-cancellation", experienceVersion: "home_v2" }), {
  cohort: "notice", category: "cancellation",
});
assert.deepEqual(resolveNoticeReporting({ noticeSlug: "unknown-card", experienceVersion: "home_v2" }), { cohort: "legacy_card" });
assert.deepEqual(resolveNoticeReporting({ noticeSlug: "unknown-card", experienceVersion: "notice_v1" }), { cohort: "unknown" });
console.log("Canonical notice categories and legacy/unknown funnel cohorts passed.");
