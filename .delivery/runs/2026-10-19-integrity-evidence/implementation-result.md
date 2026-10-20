# Luna implementation result — Frozen Document Integrity Evidence

## Changes

- Added `DocumentIntegrityEvidence` to the order contract and
  `src/lib/docket/integrity-evidence.ts`.
- `lock-and-intent` now requires an asserted typed-name adoption and affirmation,
  verifies the signer against the deterministic rendered document, generates the
  SHA-256 digest from the exact UTF-8 frozen Lob HTML, and persists the versioned
  evidence with the initial order before payment initialization.
- Lifted affirmation state into `DocumentWorkspace`, passes it to checkout, and
  clears both affirmation and adoption on document edits.
- Replaced unsupported copy with utility-only digest/provenance wording.
- Added focused integrity tests and updated existing lock-route fixtures for the
  new required adoption assertion.

## Luna-reported checks

- `tests/sprint-0003-integrity-evidence.test.ts`: 4/4 pass.
- Focused WP-2, WP-4, and S5 tests: 37/37 pass in Luna's environment.
- `tests/s6-funnel-and-reporting.test.ts`: 20/20 pass.
- `npm run test:security`: 10/10 pass.
- `npm run test:payment-mode`: 26/26 pass.

## Known check limitations

- `npm run test:docket` has a pre-existing rendered-HTML CASS assertion failure
  in `tests/docket-engine.test.ts:481` (22/23 pass).
- The broad `npx tsc --noEmit` reports pre-existing unrelated missing modules and
  historic test-contract errors; no error was reported in changed implementation
  files.

Luna did not commit, push, deploy, read secrets, or modify the sprint ledger.
