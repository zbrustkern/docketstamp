# SPRINT-0009 — Notice analytics and provider/admin namespace migration

**Status:** Active
**Run:** `2026-10-20-legacy-replacement`
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_analytics`

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

1. Make destinations explicit per environment and disable unverified/missing Google/Meta destinations with an observable admin/config state. Do not invent account IDs or equate Firebase Analytics with Ads ownership.
2. Emit actual order/tier values and notice categories. Version notice funnel events and keep legacy card cohorts separate; preserve consent, server purchase authority and browser/server dedupe.
3. Replace flat card economics and font/occasion reporting with tier-aware estimates/actual evidence using existing admin-console finance authority. Keep unknown costs unknown.
4. Move provider admin modules/routes and browser cookie/session namespaces to canonical names with bounded dual-read/canonical-write compatibility. Preserve existing flags, dedupe and truthful no-probe states.

Allowed implementation surface: lib/google-ads.ts, lib/meta-ads.ts, related pixel/CAPI destination consumers, lib/telemetry.ts/schema, metrics/reporting, feature flags, canonical admin Lob widget/routes and focused tests. Coordinate order-type consumers. Do not touch auth or reminder delivery.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Missing/unverified destinations emit no conversion requests; configured destinations receive exact paid order values/currency and stable dedupe IDs.
2. Legacy/test/live cohorts stay separate. Tier economics reconcile to configured estimates or provider evidence with unknowns explicit.
3. Canonical routes preserve authorization and cannot misroute legacy provider IDs. Namespace migration preserves flag choices and does not double count.
4. Current draft recovery keys and all six invariants remain intact.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_analytics.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Explicit per-environment destination verification, namespace migration, notice cohorts and tier/evidence costs are integrated (1e455c8, 6769963). No inherited destination is enabled. Review repairs reject unsupported report filters and scope Meta test codes; only accepted sends can mark tracked. Server CAPI is safely disabled because JSON consent is not proof. Remaining acceptance: build the preferences UI, verified purpose-bound consent issuance/revocation with server GPC enforcement, then test minimized values/dedupe with approved owned destinations. See ../marketing-consent-readiness.md; no environment toggle substitutes for this work.

Coordinator validation and exact release evidence: [verification report](../../.delivery/runs/2026-10-20-legacy-replacement/verification.md). Luna reports and independent cross-lane reviews are preserved in the same run. Single-app Codex/Luna validation is claimed; no Antigravity review occurred.
