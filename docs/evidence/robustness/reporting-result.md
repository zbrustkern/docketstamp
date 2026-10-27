# Reporting and operator visibility result

## Changed paths

- `lib/admin-console/reporting/scope.ts` resolves Today, Yesterday, 7-day, 30-day, and custom date ranges into half-open UTC bounds using the selected IANA timezone; Chicago is the UI default. The date arithmetic handles 23- and 25-hour DST days.
- `lib/admin-console/reporting/store.ts` uses bounded, environment/time-indexed reads for payment, event, postal, and cost records. It pages with explicit caps, marks capped reads incomplete, joins old open payment outbox obligations through their payment fact environment, and scopes targeted joins to that environment. Bounded `environment + sessionId + eventName` joins retrieve historical acquisition entries only for sessions linked to scoped orders.
- `lib/admin-console/reporting/compute.ts` keeps effective-time cash collections separate from acquired-session conversion and contribution. Late captures and related refunds are attached to the entry cohort's seven-day window. Channel and entry-surface scopes join financial facts, paid-order counts, and open obligations to the order's historical entry evidence; unjoinable scoped facts are excluded and mark the report partial. Contribution requires complete supplier and processor costs; contribution after acquisition also requires actual spend coverage for every active source. Mixed currency, incomplete costs, and missing spend remain unavailable.
- `app/api/admin/console/route.ts` accepts date range/timezone and channel parameters while preserving the existing explicit-scope read, projection-only rebuild, rollback, capability, and audit paths.
- `components/admin/ExecutiveReportingPanel.tsx` adds authenticated published-report date selectors, a channel selector, explicit Update report action, and evidence, freshness, environment, timezone, and completeness labels. No report generation or provider operation occurs during reads.
- `app/admin/page.tsx` adds the panel to the existing margins area without removing its controls.
- `firestore.indexes.json` and `firebase.json` declare the new composite indexes for bounded reports, session-targeted historical entry joins, and outbox recovery.
- `tests/admin-console/reporting.test.ts` covers historical capture/current refund, channel exclusion with a current refund joined to an older acquisition entry, older open obligations, late conversion, missing costs/spend, mixed currency, DST, environment-safe outbox joins, and generation replay/rollback.

## Checks

- Passed: `node scripts/test-admin-console-offline.cjs tests/admin-console/reporting.test.ts`.
- Passed: `npx tsc --noEmit --pretty false`.
- No live payment or postal provider calls, external email/mail, deployment, or database rebuild were performed.

## Remaining limitations

Contribution is only reported where cost records explicitly provide complete supplier/processor coverage and spend records cover each active source in the selected range. It does not estimate missing spend or claim acquisition lift. Historical order records without environment are included only when joined through a payment fact already scoped to the requested environment; legacy records outside those joins are not backfilled. The operator panel reads published generations only; generating a new report remains an explicitly authorized audited action through the existing API. Query caps and missing open-obligation joins reduce completeness rather than silently presenting full coverage.

Channel-scoped reports require a historical entry event linked by the order's session ID. Facts without that attribution are omitted from the selected channel and reported as partial via `CHANNEL_ATTRIBUTION_INCOMPLETE`; this preserves source honesty when historical evidence is missing.
