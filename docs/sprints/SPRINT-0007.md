# SPRINT-0007 — Recipient-first account and order history

**Status:** Active
**Run:** `2026-10-20-legacy-replacement`
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_accounts`

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

1. Replace card-builder links with notice selection and recipient-prefill through existing notice hydration. Preserve saved-address import/edit/delete and default return addresses.
2. Display canonical provider-aware history, delivery tracking and authorized proofs. Keep legacy evidence labeled honestly and unavailable proof states explicit.
3. Separate historical occasion data from active notice controls; wire supported one-time deadline reminders from Sprint 0008 without reinterpreting birthdays.

Allowed implementation surface: app/account/page.tsx, account presentation helpers, components/v3/Step5Confirmation.tsx, app/order/[id]/page.tsx and focused UI/account tests. Consume canonical order/reminder contracts; coordinate shared type changes.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Saved recipient → selected notice → prefilled review → signature → checkout works and missing fields remain highlighted.
2. Account address workflows retain ownership checks and existing records. No reachable Send Card/greeting-card builder links remain.
3. Historical provider proofs never call the wrong provider; unavailable/unknown states are visible. Desktop/mobile keyboard and recovery paths work.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_accounts.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Recipient notice chooser, private staged prefill, saved addresses, secure order DTO and truthful provider history are integrated (b7f8c9f, 01f93b5, 4eb3dbb, 453034c, db33aad). Automated prefill/hydration, recovery, authorization and history checks pass. Public account/admin/notice screens were checked in Chrome; notice viewport 390px has no horizontal overflow. Remaining acceptance: authenticated account desktop/mobile keyboard walkthrough through saved recipient, review/sign and mocked checkout. Do not claim that live browser journey is verified.

Coordinator validation and exact release evidence: [verification report](../../.delivery/runs/2026-10-20-legacy-replacement/verification.md). Luna reports and independent cross-lane reviews are preserved in the same run. Single-app Codex/Luna validation is claimed; no Antigravity review occurred.
