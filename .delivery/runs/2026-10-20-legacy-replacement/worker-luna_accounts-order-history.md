# Luna account/order history follow-up

Updated the account order cards and latest order-detail page from the coordinator checkout. Both use the shared `resolvePostalProvenance` reader through `lib/account/order-history.ts`.

- Ambiguous provider identifiers remain unknown and never trigger a cross-provider tracking link. Direct provider tracking links are shown only for the resolved provider and only for HTTPS URLs.
- Removed synthetic docket IDs, default certified service labels, CASS/official-stamp assertions, postal-intake claims, and the mock executed-document preview. Docket reference, service level, status, date, tracking number, and provider status now come only from recorded order/provider fields.
- Order detail distinguishes canonical v2 notice records from historical order records. It keeps the existing view-token verification/unlock flow, pending-payment confirmation, analytics calls, and address handling intact.
- Removed automatic birthday/statutory reminder controls and occasion-to-reminder POSTs from the order page. No reminder, email, payment, or postal operation is performed by this presentation change.

## Validation

- `npx tsc --noEmit --project tsconfig.app-check.json --pretty false` — passed using a temporary copy of the orders lane's browser-safe `lib/order-record.ts` for isolated compilation; that shared helper is intentionally excluded from this commit.
- `node --import tsx --test tests/account/order-history.test.ts tests/account/notice-prefill.test.ts` — passed, 6 tests. Added coverage for conflicting identifiers, provider-specific data isolation, unsafe tracking URL rejection, absent evidence, and canonical notice metadata.
- `git diff --check` — passed.

The prior account commit's production build attempt remains blocked because the environment cannot resolve `fonts.googleapis.com` for the app's `next/font` assets. No authenticated browser session was available for visual testing.
