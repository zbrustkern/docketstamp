# Physical fit preflight result

## Delivered

- Added `assessPhysicalFit(doc)` in `src/lib/docket/renderer/physical-fit.ts`. The browser and `/api/docket/lock-and-intent` use the same deterministic check against the shared 8.5 × 11 inch body budget. The lock route returns `422 PHYSICAL_FIT_REQUIRED` before reserving a checkout attempt, persisting an order, or creating payment credentials when the check fails.
- The workspace marks checkout readiness false when the current interpolated letter fails. Checkout shows an actionable shorten-content or shorten-address message and disables Continue; the handler repeats the check before requesting the lock.
- Address checks enforce the locally chosen supplier-independent limits of 80 characters for name/company, 60 per address line, 40 for city, 2 for state, and 10 for ZIP. These limits are shown to users as a request to shorten mailing details; they do not alter saved historical snapshots.
- The preflight estimates rendered line wrapping from character classes and the current print font sizes. It does not reflow, hide, clip, shrink, or rewrite letter content. Its estimate is a conservative application gate, not a browser layout measurement or guarantee about Lob's physical output.

## Verification

- `tests/physical-fit-preflight.test.ts`: 7 tests passed. The fixtures cover all 9 notices × 3 tiers (27 max-field combinations), 9 ordinary-length template cases, a standard deposit example, wide/unbroken CJK content, repeated-word wrapping, emoji graphemes, and over-limit address/name values. The deterministic max-field gate blocks all credit-dispute cases and the close security-deposit max combination; the remaining max combinations pass this estimate.
- `tests/docket-lock-input-validation.test.ts`: 2 tests passed with isolated mock Firestore and offline external-effect guard. The oversized case returned 422 before any checkout attempt or Stripe intent; the ordinary deposit lock passed using the mock payment seam.
- The combined docket engine/input/lock suite passed 36 tests.
- `npx tsc --noEmit --pretty false` passed.

## Evidence limits

The line estimator is font-metric approximation, so successful preflight is not proof that every accepted string fits in a particular browser or Lob's renderer. The blocked max-field cases are intentionally not made payable to preserve fixed typography and legal prose. Parent browser review should remeasure the ordinary and accepted max fixtures with the current client bundle; any provider-layout proof remains separate from local tests.

Parent browser integration measured 27 stress renders: all three credit-dispute cases overflowed; the other 24 fit the measured body. The preflight now rejects the overflowing cases plus three close deposit cases. Measurements and their finite-fixture limits are in [browser-physical-measurements.json](browser-physical-measurements.json). The ordinary deposit flow reached a whole-width, scaled frozen review with the footer present in the document. Lob proofs remain pending.
