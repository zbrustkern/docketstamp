# SPRINT-0008 — One-time notice deadline reminders

**Status:** Planned  
**Run:** `2026-10-20-legacy-replacement`  
**Source:** `1226a9c` (verified Firebase repair atop `c4ede76`)  
**Owner:** Codex coordinator; requested gpt-6-luna executor `luna_reminders`

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

1. Define a versioned one-time reminder contract with explicit date/timezone, user-supplied label, consent, lead time and idempotent delivery state.
2. Replace annual occasion scheduling for new reminders with date-aware create/edit/delete/opt-out and scheduler claim/retry semantics. Preserve legacy records without inventing legal dates.
3. Locate actual scheduler entry points. Build a callable authenticated scheduler path if needed, without enabling a recurring external job or sending real email. Deep-link to notice review; never sign/pay/dispatch automatically.

Allowed implementation surface: lib/reminders.ts, lib/reminder-utils.ts, new reminder contract modules, app/api/reminders/route.ts, reminder scheduler routes, reminder-specific email functions and focused tests. Avoid account UI and order writers; coordinate lib/types.ts and lib/email-alerts.ts overlap.

Non-goals: production rollout, live postage/payment/email, deployed schedules, customer identity linking, bulk database migration, or guessed analytics account ownership. Agentic discovery/staging surfaces already in the product must remain compatible; expansion beyond existing supported behavior is a separate tranche.

## Acceptance and validation

1. Past dates do not recur next year; timezone/DST/leap-day and reschedule/opt-out tests pass.
2. Duplicate scheduler runs send at most once; failed email can retry under explicit delivery semantics.
3. Ownership and consent are enforced. Historical birthday records are not converted into legal deadlines. No live email or scheduler activation occurs.

Run focused behavioral/failure tests for each criterion, existing security/payment-mode/Firebase/integrity checks as affected, a production build and supported typechecking. Capture exact commands/results in `.delivery/runs/2026-10-20-legacy-replacement/worker-luna_reminders.md`. Worker success is provisional until coordinator reviews the diff and independently verifies it. Do not weaken geometry or legal/admin boundaries to make tests pass.

## Risks, unknowns and review provenance

Use an isolated local clone, one writer per clone. Do not edit the shared coordinator checkout or ledger; return a local commit and result report for sequential integration. Preserve concurrent outgoing-email and integrity work. Shared-type changes must be integrated before dependent UI/reporting work.

Legacy record distribution, identity migration mappings and Ads/Meta ownership remain external unknowns. Build safe defaults and explicit unknown states; report exact evidence needed. No actual cloud data movement is included.

Planning provenance: Codex synthesis plus actual gpt-6-luna read-only feasibility critique, saved in this run. No Antigravity execution or cross-app review is claimed. User requested Luna execution; coordinator owns integration and staging release. Record implementation/review evidence below before marking complete.

## Execution evidence

Pending.
