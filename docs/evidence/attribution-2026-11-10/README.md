# Pilot attribution: staging release

Authorized scope: first-party attribution and reporting, staging validation only.
Production rollout, Google conversion transmission, and all campaign changes remain held.

## Release boundaries

1. Capture and freeze: distinct first-observed (30-day browser window) and current-session touches; a 30-minute idle session boundary and new campaign/direct-arrival handling. Sanitized order snapshot is frozen at lock and unchanged by checkout replay. Product entry surface stays separate from acquisition. Known pilot parameters map to campaign 24457739017; this is observed URL evidence, not proof of an ad click. Missing campaign never becomes the pilot by inference.
2. Reporting: prefer frozen current-session attribution, retain historical session joins as a labeled fallback, expose unknown/conflicting attribution and a separate first-observed view. Use verified customer captures; exclude test/comp/founder payments. Include later refunds, actual processor fees once, fulfillment costs and reviewed ad-spend intervals. Incomplete evidence yields unavailable economics rather than fabricated CAC. No repeat-customer value is assumed.
3. Separately reviewed later: production deployment; consent/data-handling design and Google conversion delivery; campaign optimization. None is enabled by this release.

## Privacy and retention

No advertising integration is added. The sensitive-route gate and existing consent rules remain. Capture retains no document text, dispute details, names, addresses, emails, search terms, raw URLs or referrers. Source/medium/surface are enums; campaign is allowlisted and creative ID numeric. Unknown labels are discarded with an explicit reason.

Click identifiers are potentially linkable advertising identifiers. Orders and journey events contain only bounded hashes/types/expiry. Raw click identifiers are segregated in the server-only `acquisition_click_evidence_v2` collection with seven-day expiry and Firestore TTL; expiration is enforced when reading browser evidence. TTL deletion is asynchronous. GPC or explicit denied marketing consent suppresses click evidence. No identifier is transmitted to Google. First-party attribution does not grant advertising consent. Existing historical data is not relabeled as a known first touch.

## Evidence import

The admin executive report accepts operator-reviewed JSON through an authenticated, same-origin, audited endpoint. Supplier/processor evidence references an existing order; spend references the exact pilot key and an explicit UTC coverage interval. Amounts are integer USD cents. Use a non-sensitive provider reference, never customer text/URLs. Imports are immutable/idempotent and refuse conflicting amounts; review corrected or partial evidence before importing because replacement is intentionally not automatic. A recorded zero must have actual reviewed coverage; absent spend is not zero. Current-day provisional spend can be displayed but cannot establish complete acquisition economics.

## Acceptance gates

- Pilot URL parameters survive landing, navigation, refresh, workspace and order freeze; replay cannot overwrite the snapshot.
- Direct→paid and paid→direct keep first and current distinct; missing/malformed/duplicate parameters never fabricate a campaign.
- Storage denial/corruption degrades to bounded memory evidence; duplicate logical events and orders remain deduplicated.
- Test payments never count as verified customer sales. Late refunds and processor costs reconcile once; missing attribution, cost, spend coverage or query completeness suppress final economics.
- Sensitive-route privacy tests pass; no Google conversion integration or campaign mutation.
- Staging-only index/TTL, test-mode Stripe/Lob and deployed commit are verified before live synthetic checkout. Real pilot traffic is checked separately when present; synthetic QA is not campaign performance.

Local verification: full `npm test`, TypeScript, optimized Next.js build and credential audit passed. The focused attribution suite has 30 passing tests. Deployment and browser results are recorded alongside this document when complete.
