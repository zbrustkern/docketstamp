# SPRINT-0006 — Legacy order inventory and migration tooling

**Status:** Complete
**Run:** `2026-10-20-legacy-replacement`
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_orders`

## Pyramid index

1. Objective and authority
2. Scope, tasks and dependencies
3. Acceptance and validation
4. Risks, unknowns and review provenance

## Objective and authority

Implement this bounded package from [the replacement roadmap](../DOCKETSTAMP_LEGACY_REPLACEMENT_PLAN.md), using `AGENTS.md`, the [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md). Build the replacement behavior and compatibility before retiring the predecessor contract.

All six invariants are release gates: fitness exclusion with hardware OEM allowance; deterministic notices/UPL footer; single-page USPS geometry; shared interpolation; freeze-before-pay integrity; split Lob verification/dispatch keys with staging isolation.

## Scope, ordered tasks and dependencies

Dependencies: SPRINT-0005. Contract design and isolated fixture work may begin early; integration waits for dependency contracts and coordinator review.

1. Build a read-only record classification/inventory command using the canonical order adapter. Report counts and schema/provenance unknowns without printing personal data.
2. Implement fixture-driven dry-run/resumable migration manifests, stable IDs/checkpoints, count reconciliation and rollback mappings. Preserve original provider fields and frozen HTML/digests.
3. Document the reviewed apply boundary and rollback window. Default execution is dry-run; do not run against live databases or migrate identities.

Allowed implementation surface: New isolated migration/inventory modules and scripts, fixture tests and migration runbook. No actual cloud apply or customer-data access.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Dry-run changes no records; checkpoint resume is idempotent and reconciled totals agree.
2. Before/after/rollback fixtures preserve ownership, payment IDs, postal evidence and frozen content byte-for-byte.
3. Migration has no Stripe, Lob, email or dispatch side effects; ambiguous provider/identity records remain quarantined.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_orders.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Fixture-only inventory and resumable migration plans are implemented. Independent two-batch dry-run completed with two proposed annotations and two quarantines; source/run/cursor binding, unchanged bytes, rollback maps and no external effects are covered. Actual data inventory/apply and identity linkage remain outside this sprint. See fixture-inventory.json and fixture-migration-summary.json in the run.

Coordinator validation and exact release evidence: [verification report](../../.delivery/runs/2026-10-20-legacy-replacement/verification.md). Luna reports and independent cross-lane reviews are preserved in the same run. Single-app Codex/Luna validation is claimed; no Antigravity review occurred.
