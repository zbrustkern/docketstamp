# Customer continuity implementation result

This slice adds tab-scoped, account-context draft identity and revision tracking; meaningful, sanitized workflow history; revision-safe USPS address verification with explicit acceptance; and a final review bound to the server-returned frozen HTML before payment controls are shown. Material changes clear signature and address evidence state. Lock replies from an obsolete draft revision are discarded and their server attempt is sent through the supersession endpoint. Guest capabilities and payment credentials stay out of history and draft recovery.

## Changed paths

- `src/components/docket/DocumentWorkspace.tsx` — workflow history and readiness handling, account-scope transitions, address review/acceptance, stale async response checks, and lock evidence wiring.
- `src/components/docket/CheckoutModal.tsx` — capability/idempotency request fields, reload-safe attempt reconciliation, server supersession on stale material, exact frozen snapshot review and explicit confirmation, and address-evidence failure recovery.
- `src/lib/docket/draft-recovery.ts` — optional account-context keys, opaque draft identity/revision persistence, and compatibility with prior guest keys.
- `src/lib/docket/workflow-history.ts` — allowlisted URL context, merged Next.js history state, and safe navigation readiness resolution.
- `src/hooks/useAgentHydration.ts` — retains a staged-draft bearer in memory after URL scrubbing so hydration/retry cannot switch to the wrong draft.
- `src/lib/docket/address-verification-client.ts` — browser-safe evidence types and freshness checks; it has no Node crypto dependency.
- `src/lib/docket/address-verification-evidence.ts` — server-only HMAC signing and verification for address/role/draft/revision/provider-bound evidence with expiry.
- `src/lib/docket/checkout-recovery.ts` — tab-scoped idempotency/docket identity and minimal active-attempt recovery, with stable in-memory fallbacks when session storage is unavailable.
- `app/api/docket/verify-address/route.ts` — returns provider mode and signed evidence for successful verification; preserves CASS staging simulation.
- `tests/workflow-history.test.ts`, `tests/address-verification-evidence.test.ts`, `tests/draft-recovery-scope.test.ts`, `tests/verify-address-evidence-route.test.ts`, `tests/checkout-recovery.test.ts` — navigation readiness, URL PII scrubbing, Next history-state preservation, proof integrity, account recovery scoping, route evidence, and reload/storage-failure checkout continuity.
- `tests/robustness-server-review.test.ts` — independent checkout/payment race, replay, and ownership regressions; findings are recorded separately in [server-review.md](server-review.md).

## Verification

- `npx tsc --noEmit --pretty false` passed after the client/server evidence split and checkout recovery changes.
- Focused continuity tests passed: 5 test files, 7 passing tests.
- An isolated `npm run build` passed. The temporary copy omitted `next/font/google` only because this environment could not resolve `fonts.googleapis.com`; the repository's `app/layout.tsx` was not changed. The build confirmed the client bundle no longer pulls `node:crypto` through address-evidence helpers.
- Checkout/fulfillment/server-review tests passed offline: 3 test files, 10 passing tests.
- `npm run test:address-intake` passed: 13 tests.
- An earlier `npm run test:docket` run passed the docket suites except the pre-existing lock-route fixture now receives the designed `409 ADDRESS_NORMALIZATION_REVIEW_REQUIRED` when mock CASS normalizes its unit. I reported this to checkout-authority for fixture alignment; rerun after their change.

## Remaining integration gaps

- Address evidence signing uses `ADDRESS_VERIFICATION_EVIDENCE_SECRET`, falling back to the existing Stripe webhook signing secret. Production must keep a stable signing secret configured so evidence survives across app instances.
- Recovery remains tab-scoped by design. Closing the tab ends the ordinary session draft.
- On guest/account scope changes, the workspace switches to that scope's saved draft or its own initial values and clears signature/address/checkout readiness. Guest data stays in the guest tab key; automatic guest-to-account draft transfer is unsupported.
- Browser history and checkout modal behavior have pure readiness coverage; a full mounted browser Back/Forward accessibility run remains an integration check.
- The final review shows the returned frozen HTML in an isolated iframe. Physical line-wrap parity remains with the later renderer workstream.
