# SPRINT-0005 — Canonical notice orders and payment entry points

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

Dependencies: SPRINT-0004. Contract design and isolated fixture work may begin early; integration waits for dependency contracts and coordinator review.

1. Trace paid, free, discount and admin entry points; define a versioned notice-order/provider contract with an explicit adapter for historical records. Preserve the immutable snapshot and integrity fields from Sprint 0003.
2. Move new writers and API responses to canonical Lob fields. Centralize historical reads; never infer Lob provenance from an arbitrary legacy vendor ID.
3. Bring supported legacy checkout entry points onto the authoritative lock/freeze contract or reject unsupported card payloads before Stripe/payment/order dispatch. Preserve meaningful free/discount workflows using complete validated notices.
4. Update proof/sync/retry paths to require explicit provider provenance and retain unknown/historical evidence truthfully.

Allowed implementation surface: lib/order-processor.ts, lib/types.ts order-specific fields, canonical order/provider helper, checkout/webhook/admin proof/sync routes and focused tests. Coordinate lib/types.ts changes through coordinator; no auth/reminder/reporting changes.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Every supported paid/free/discount entry point persists immutable HTML/integrity before payment or dispatch authorization; mutable edits cannot change post-payment fulfillment.
2. Concurrent calls, retries and replayed/out-of-order webhooks cause at most one authorized dispatch.
3. Genuine legacy or unknown provider IDs never trigger Lob requests. New writes do not dual-write misleading vendor aliases; existing history remains readable.
4. Existing six invariants and test/live payment/Lob isolation pass focused safety checks.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_orders.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Canonical frozen notice/provenance and paid/free authorization are integrated (64db645, 22bf6c1, db33aad, 44f12e3). New v2 payment hashes bind adoption evidence; historical markerless payment hash shape is preserved. Mocked concurrent/replayed/out-of-order postal and payment paths pass. Legacy/provider-conflict IDs cannot trigger Lob. No actual charge or postage was initiated.

Coordinator validation and exact release evidence: [verification report](../../.delivery/runs/2026-10-20-legacy-replacement/verification.md). Luna reports and independent cross-lane reviews are preserved in the same run. Single-app Codex/Luna validation is claimed; no Antigravity review occurred.
