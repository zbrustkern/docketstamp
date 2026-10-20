# SPRINT-0004 — Firebase trust and admin session boundaries

**Status:** Planned  
**Run:** `2026-10-20-legacy-replacement`  
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)  
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_identity`

## Pyramid index

1. Objective and authority
2. Scope, tasks and dependencies
3. Acceptance and validation
4. Risks, unknowns and review provenance

## Objective and authority

Implement this bounded package from [the replacement roadmap](../DOCKETSTAMP_LEGACY_REPLACEMENT_PLAN.md), using `AGENTS.md`, the [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md). Build the replacement behavior and compatibility before retiring the predecessor contract.

All six invariants are release gates: fitness exclusion with hardware OEM allowance; deterministic notices/UPL footer; single-page USPS geometry; shared interpolation; freeze-before-pay integrity; split Lob verification/dispatch keys with staging isolation.

## Scope, ordered tasks and dependencies

Dependencies: none beyond the completed Firebase repair. Contract design and isolated fixture work may begin early; integration waits for dependency contracts and coordinator review.

1. Pin Admin initialization and token verification to the configured DocketStamp project before reading any unverified audience. Require cryptographic verification and issuer/audience/expiry/revocation checks.
2. Replace non-production decoded-claim reconstruction with an explicit isolated offline test verifier or Firebase Auth emulator. Hosted/production execution must reject mock tokens. Preserve local test utility through an explicit test-only boundary.
3. Version the admin session cookie to a DocketStamp name. Clear the old cookie during login/logout and require reauthentication; retain signed/expiring account-bound sessions and historical weak-secret blocklists.
4. Inventory user/order identity migration prerequisites in a read-only report specification. No account linking by email or cross-project data copying.

Allowed implementation surface: lib/firebase-admin.ts, lib/admin-auth.ts, app/api/admin/auth/route.ts, auth/account verification callers and dedicated auth tests. Do not alter order writers, reminders, analytics or ledger.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Valid tokens for the configured project work; wrong-project, wrong-issuer, expired, forged and revoked tokens fail, including when Admin verification throws.
2. Real staging/production builds cannot reconstruct claims or accept mock tokens. Offline tests require explicit test-only configuration.
3. Authorized admin login/logout and customer account ownership tests pass; legacy cookie alone cannot authenticate; predictable keys remain rejected.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_identity.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Pending.
