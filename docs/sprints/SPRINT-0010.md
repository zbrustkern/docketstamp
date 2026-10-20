# SPRINT-0010 — DocketStamp documentation and verification authority

**Status:** Complete
**Run:** `2026-10-20-legacy-replacement`
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_docs`

## Pyramid index

1. Objective and authority
2. Scope, tasks and dependencies
3. Acceptance and validation
4. Risks, unknowns and review provenance

## Objective and authority

Implement this bounded package from [the replacement roadmap](../DOCKETSTAMP_LEGACY_REPLACEMENT_PLAN.md), using `AGENTS.md`, the [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md). Build the replacement behavior and compatibility before retiring the predecessor contract.

All six invariants are release gates: fitness exclusion with hardware OEM allowance; deterministic notices/UPL footer; single-page USPS geometry; shared interpolation; freeze-before-pay integrity; split Lob verification/dispatch keys with staging isolation.

## Scope, ordered tasks and dependencies

Dependencies: SPRINT-0004, SPRINT-0005, SPRINT-0007, SPRINT-0008, SPRINT-0009. Contract design and isolated fixture work may begin early; integration waits for dependency contracts and coordinator review.

1. Replace README/architecture with accurate supported DocketStamp setup and operational contracts. Mark old briefs/audits historical while preserving original evidence and links.
2. Replace obsolete card tests with equivalent DocketStamp acceptance checks before archiving predecessor-only suites. Separate historical tests explicitly without suppressing current source errors.
3. Build a recursive active-source/config legacy audit with reviewed, bounded compatibility exceptions and behavior checks. Trace assets/fonts/callers before retirement.
4. Repair existing renderer assertion and current-contract test mismatches based on actual requirements; achieve clean supported typecheck/build/test evidence without hiding errors.

Allowed implementation surface: README.md, ARCHITECTURE.md, historical doc banners/archive, audit scripts/allowlists, test authority/configuration, legacy test migration and current-contract fixture fixes. Do not silently delete failed tests or alter production behavior to satisfy stale assertions.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Documented local setup boots DocketStamp staging with current env/three tiers/split Lob keys and no card-art dependencies.
2. Supported tests/typecheck/build pass; historical suites are clearly identified and retain provenance. No current-source errors are excluded to force green.
3. Recursive audit distinguishes intentional security/historical/compatibility artifacts from active defects, with owner and retirement condition.
4. Integrated invariants, account flows, reminder semantics and payment/provider behavior are independently verified.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_docs.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

README and architecture now describe supported DocketStamp behavior. Unreferenced predecessor modules and obsolete suites are byte-preserved in documented archives with hashes and named replacement coverage. Supported TypeScript/build/tests pass without excluding current source. Recursive active code/config audit has zero unclassified matches and 78 exact bounded compatibility matches with owner, context, quota and retirement conditions. Duplicate identical favicon was removed after local preview found the route conflict.

Coordinator validation and exact release evidence: [verification report](../../.delivery/runs/2026-10-20-legacy-replacement/verification.md). Luna reports and independent cross-lane reviews are preserved in the same run. Single-app Codex/Luna validation is claimed; no Antigravity review occurred.
