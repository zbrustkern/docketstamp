# Marketing wrapper privacy result

## Changes

- Direct Google Ads and GA4 helpers now require explicit consent (including GPC handling) and the current public acquisition route/query allowlist before sending.
- Google commerce payloads use a fixed generic DocketStamp mailing identity. Caller-provided order IDs, template names, customer email, and other arbitrary fields are ignored. Conversion events no longer carry transaction IDs. Custom events are limited to generic `mailing_progress` with a bounded step number.
- `MarketingTags` now observes both pathname and search-parameter changes. The navigation-aware component is under `Suspense` so Next.js can render routes that use `useSearchParams`.
- Added an outbound-call regression test against the actual Google wrapper functions for no-consent/GPC, sensitive paths and query strings, and PII/internal-ID stripping. First-party telemetry remains unchanged per the product policy.

## Verification

- `node --import tsx --test tests/marketing-privacy-boundary.test.ts tests/marketing-destinations.test.ts tests/marketing-consent.test.ts` — 6 passed.
- `npm run test:meta` — 18 passed, including mocked CAPI egress/opt-out checks.
- `npx tsc --noEmit --pretty false` — passed.
- `git diff --check` on the changed source and test paths — passed.

Tests use local mocks and make no provider calls. They verify wrapper payloads and URL gating, not actual browser network behavior or third-party collection after already-loaded scripts are removed.
