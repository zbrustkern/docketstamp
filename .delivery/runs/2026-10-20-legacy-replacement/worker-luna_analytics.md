# Luna analytics/provider lane — Sprint 0009

Implemented the analytics/provider work in the isolated `analytics` clone. This is a local implementation commit only; no deployment, live provider probe, ad-account change, mail, or real record migration was performed.

## Delivered

- Added explicit environment-scoped Google and Meta destination resolution. Destination IDs have no inherited defaults, ownership verification is required, server/browser Meta IDs must match, and the admin panel reports disabled/readiness state without exposing IDs. Google/Meta script injection and event helpers require explicit marketing consent; GPC blocks delivery. Browser/server purchase dedupe still uses the order ID, and purchase amounts are omitted unless a positive paid amount is known.
- Removed fixed `$9` browser conversion fallbacks and old hardcoded vendor IDs, including the production App Hosting GA4 value and Meta domain verification fallback.
- Derived notice categories from the canonical notice registry. Telemetry reports canonical notice, confirmed legacy-card, and unknown cohorts separately; unrecognized client category strings do not become canonical categories.
- Replaced flat fulfillment COGS with verified payment-fact evidence plus per-tier estimates only when the operator supplies a positive amount and source reference. Unknown tiers remain unknown. Added tests for estimate provenance and Stripe/Lob actual facts and credits.
- Canonicalized the Lob admin status widget and status route, removed shared `LOB_API_KEY` readiness fallbacks, and retired Handwrytten-named admin balance/sync compatibility routes with an authorized 410 response. Admin order/proof displays use provider provenance and never relabel a historical Handwrytten ID as Lob; conflicting IDs are unresolved.
- Migrated attribution and telemetry browser storage to DocketStamp namespaces with bounded legacy read-and-clear/canonical-write behavior. The feature-flag cookie is canonical-first with legacy read-only fallback. Order attribution uses `docketstamp_order_attribution_v1`, separate from the structured touch ledger key `docketstamp_attribution_v1`.

## Validation

Passed in isolated mock Firestore / mocked provider transport:

- `node --import tsx tests/meta-conversions-api.test.ts` — 44 assertions, including destination config, explicit consent/GPC, hashed sender fields, exclusion of recipient address, actual final amount, canonical notice category, and browser/server event ID dedupe.
- `node --import tsx tests/unit-economics.test.ts` — sourced per-tier estimate, Stripe fee calculation, verified capture/fee facts, Lob charge/credit net cost, attribution aggregation.
- `node --import tsx tests/marketing-destinations.test.ts`
- `node --import tsx tests/marketing-consent.test.ts`
- `node --import tsx tests/notice-reporting.test.ts`
- `node --import tsx tests/postal-provenance.test.ts`
- `node --import tsx tests/env-validator-lob.test.ts`
- `node --import tsx tests/admin-console/reporting.test.ts`
- `node --import tsx tests/admin-console/s2-finance.test.ts` — rerun with a clean temporary mock-store working directory after persistent mock data made a repeated in-clone run report a duplicate.
- `git diff --check` — clean.
- Scoped TypeScript diagnostic scan showed no errors in files owned by this lane. Repository-wide `npx tsc --noEmit` still reports existing predecessor-only missing modules and unrelated test fixture errors.

`npm run build` was attempted but cannot fetch Inter, JetBrains Mono, or Merriweather from `fonts.googleapis.com` in the network-restricted environment; Next.js stopped during font loading before the application compile.

## Integration dependencies / open items

- The analytics clone is based on `0a8f79c`, before the current root order-record helper/type integration. It has a small pure provider-provenance resolver in `lib/admin/postal-reference.ts` for this lane. Root can consolidate these consumers onto the newer browser-safe `lib/order-record.ts` after merging current order schema/types.
- The notice lock writer in this clone persists no marketing-consent snapshot. CAPI deliberately skips unless the order has explicit `attribution.marketingConsent === true`; coordinator integration is needed in the lock writer for opted-in notice purchases to reach CAPI. No writer was changed in this lane.
- Legacy credential/namespace string matches remain only as read-only migration compatibility or in historical documentation/tests; no active marketing destination defaults remain in code/config.
