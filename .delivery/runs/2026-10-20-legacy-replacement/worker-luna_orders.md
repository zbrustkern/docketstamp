# Order and migration lane report

## Delivery

Implemented additive canonical notice order metadata and truthful postal provenance reads while preserving the existing `documentHtml`, `documentIntegrityEvidence`, and `signatureAdoption` fields as the one authoritative frozen snapshot. Added a fixture-only inventory and resumable dry-run migration plan. No customer records, Stripe, email, or postal provider were contacted.

The order adapter lives in `lib/order-record.ts`:

- `readOrderRecord(raw)` returns `{ order, schemaVersion, kind, postal }` and leaves raw legacy data intact.
- `resolvePostalProvenance(raw)` returns `{ provider: 'lob' | 'handwrytten' | 'unknown', reference?, evidence: 'canonical' | 'legacy_field' | 'conflict' | 'missing' }`.
- Unversioned records with only `lobLetterId` or `handwryttenOrderId` are identified as the corresponding legacy provider. A Handwrytten reference is never treated as a Lob ID. Conflicting aliases remain unknown. Historical reads do not fail merely because integrity evidence is absent; dispatch requires v2 notice metadata and byte-for-byte digest/adoption/footer validation.

New orders set `schemaVersion: 2`, `kind: 'notice'`, and `noticeVersion: 1`, with an initial truthful `postalProvider: 'unknown'`. Successful real Lob submissions record only canonical Lob provenance. Simulated sends do not claim provider references. Free checkout uses existing frozen notice/payment authority and the shared dispatch claim path. The predecessor card checkout returns 410 before payment setup. The old Handwrytten sync route returns 410 rather than querying Lob with a historical Handwrytten identifier.

Migration utilities are `scripts/orders/inventory-legacy-orders.ts`, `scripts/orders/dry-run-legacy-order-migration.ts`, and `lib/legacy-order-migration.ts`. They accept fixture JSON only, emit batch/checkpoint manifests with proposed provenance annotations and rollback mappings, and quarantine ambiguous identifiers. No apply mode or database writer is present. Usage and operational boundaries are in `docs/LEGACY_ORDER_MIGRATION_RUNBOOK.md`.

## Validation

- `TMPDIR=/private/tmp USE_MOCK_FIRESTORE=true NODE_ENV=test node --import tsx --test tests/legacy-order-replacement.test.ts tests/sprint-0003-integrity-evidence.test.ts tests/s5-delivery-and-payment.test.ts` — 28 tests passed. Coverage includes canonical paid freeze-before-payment and mutation rejection, free 100% discount, duplicate fulfillment protection, provider-ID truthfulness, dry-run/resume immutability, and dispatch single-claim behavior. Only mock payment/firestore and staging postal simulation were used.
- Inventory and two-batch/resume migration script run against `tests/fixtures/orders/legacy-orders.json` — completed; fixture has 5 records, the initial checkpoint is incomplete, resume completes with 2 proposed annotations and quarantines ambiguous cases. Source fixture/snapshots remain unchanged.
- `git diff --check` — passed.
- `npx tsc --noEmit --pretty false` — repository-wide check reports 64 diagnostics, all in untouched baseline files; no diagnostics reference files changed in this lane.

## Files changed

- Routes: `app/api/admin/order-proof/route.ts`, `app/api/admin/sync-handwrytten/route.ts`, `app/api/checkout/complete-free-order/route.ts`, `app/api/checkout/confirm-order/route.ts`, `app/api/checkout/create-intent/route.ts`, `app/api/docket/lock-and-intent/route.ts`, `app/api/webhooks/lob/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/order/[id]/page.tsx`.
- Order/payment/provenance: `lib/order-processor.ts`, `lib/order-record.ts`, `lib/types.ts`, `lib/firebase-admin.ts`, `lib/admin-console/postal/dispatch.ts`, `lib/admin-console/postal/free-authority.ts`.
- Migration: `lib/legacy-order-migration.ts`, `scripts/orders/inventory-legacy-orders.ts`, `scripts/orders/dry-run-legacy-order-migration.ts`, `tests/fixtures/orders/legacy-orders.json`, `docs/LEGACY_ORDER_MIGRATION_RUNBOOK.md`.
- Tests: `tests/legacy-order-replacement.test.ts`, `tests/s5-delivery-and-payment.test.ts`.

## Remaining risks / integration notes

- There is intentionally no live migration/apply path. Any production data migration still requires an explicitly reviewed operational workflow and verified source export.
- Admin page provenance labels are owned by the analytics lane; account/history UI is owned by the account lane. They should consume `resolvePostalProvenance` and avoid direct alias fallback.
- Full TypeScript validation remains blocked by the pre-existing diagnostics in unrelated modules/tests; changed lane files are clean.
