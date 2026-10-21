# SPRINT-0012 implementation and evidence

Implemented in the shared working tree; no commit, push, production deployment, live policy change, payment or postal dispatch. Two Luna workers used isolated source clones (high reasoning for backend/transactions; medium for admin UI and critique). Coordinator integrated bounded diffs and implemented customer gates, research and verification. Antigravity handoff remained optional/unexecuted.

## Delivered

- `/admin?tab=templates`: inspect all nine compiled templates, body/fields/footer/digest, review status, provenance and reproduction record; set individual/global availability, current-review requirements and residence/property rules. Reason, confirmation, immutable audit, optimistic revision/content checks and exact-request retry. Read-only role supported.
- Strict admin API and redacted no-store public availability. Successful policy, audit, receipt and bounded history writes share a transaction. Bounded history avoids a new composite Firestore index requirement.
- Shared explicit-location evaluator and server enforcement at new stage/order persistence. Residence is not inferred from postal state; tenant property declaration also selects the deposit citation. Staged retrieval rechecks policy and can accept missing declared locations without altering the stored draft; conflicting property changes are rejected.
- Customer chooser, workspace, account reuse, URL/recovery, REST, remote/browser MCP and discovery reflect current availability. New lock revalidates even if an already-open client is stale. Checkout denials use fixed messages and refresh availability when the customer closes denied checkout.
- New frozen orders include policy revision, template digest, nexus and decision time. Earlier locks preserve their content and may continue payment/dispatch after a pause.
- California/other-state official template research and future California-area design saved in `docs/legal/OFFICIAL_TEMPLATE_PRODUCT_REVIEW_2026-10-20.md`.

## Validation

Final command ran in `/private/tmp/docketstamp-sprint-0012-qa`, an isolated source copy without production environment files or the main development database:

```sh
NODE_ENV=test USE_MOCK_FIRESTORE=true node --import tsx --test --test-concurrency=1 tests/template-policy*.test.ts tests/template-availability-client.test.ts tests/admin-template-governance-ui.test.ts tests/agent-stage-mcp.test.ts tests/agentic-api-mcp.test.ts tests/wp4-checkout-errors.test.ts tests/account/notice-prefill.test.ts tests/s2-chooser-and-routing.test.ts tests/s3-homepage-composition.test.ts tests/s4-details-and-review.test.ts tests/s5-delivery-and-payment.test.ts tests/s7-release-candidate.test.ts tests/sprint-0011-demand-copy.test.ts tests/sprint-0003-integrity-evidence.test.ts tests/order-snapshot-integrity-evidence.test.ts tests/payment-mode-safety.test.ts tests/transaction-security.test.ts tests/admin-account-binding.test.ts
npx tsc --noEmit --incremental false
```

Result: **195 tests passed, 0 failed**; typecheck passed; `git diff --check` passed. Earlier integration run: 184 passed. Added behavioral coverage includes review expiry/future timestamps/digest staleness, missing saved entry stays paused, invalid calendar date, strict source URLs/fields, role/origin, CAS/replay, malformed policy fail-closed, resumed-stage nexus, and frozen-order pause cutoff. Lock tests assert no order and no second mock Stripe start for denied new work. Existing snapshot/integrity, checkout, guardrail, recovery and agent regressions pass.

`check-ui.mjs` used actual Chrome against an isolated Next dev server with local mock Firestore and fixture-only admin session credentials. All external browser requests and checkout/provider mutation requests were blocked. Desktop 1440×1000 and mobile 390×844 screenshots were visually inspected. `evidence/ui/results.json` and `extra-results.json` confirm typed state list/save, pause/filter/direct REST/MCP denials, resume hydration, stale-save conflict, failed-refresh lockout, read-only role, mobile policy failure, WebMCP fresh checks and safe admin retry. No uncaught browser errors in final runs, no horizontal page overflow, no checkout/dispatch requests.

An initial dev compilation yielded a transient script parse failure; a later hot reload retained stale local mock state across route bundles. The clean server restart and fresh fixture run passed. These are local-mock results, not distributed Firestore/emulator concurrency or live-provider evidence. Core transaction cutoff follows a policy read and stage/order write in the same Firestore transaction; production runtime still merits normal staging verification before deployment.

## Repairs and preservation

Review/browser repairs: editable state delimiters; clearing all-mode states; resetting raw state text on discard/template switch; definitive-vs-uncertain retry; visible failed refresh; concrete confirmation; conflict-message preservation after reload; bounded history; fixed public error messages; normalized resumed nexus; invalid-location correction; saved-policy missing-entry fail-closed; complete desktop navigation.

`baseline-hashes.json` and `changed-from-baseline.json` track existing files. Only owned integration/client/docs paths changed relative to the sprint baseline; preexisting feature-flag deletions and demand-copy work were preserved. The initial unit integration run used the main development mock store; its new governance-only fixture collections were removed afterward. Final/browser validation used an isolated store. No production database was accessed.

## Boundaries and operation

Existing nine templates retain enabled/unreviewed migration defaults until an operator saves policy. Nothing is newly legally approved or geographically blocked. Future templates and missing entries in a saved policy default paused. Review gating is optional; “approved” is an operator record, not a generated legal opinion. `TEMPLATE_RENDERING_POLICY_REVISION` must be bumped for meaningful renderer mappings or custom validation refinements not captured by serialized definitions.

No official letter text was imported. The proposed California route, new templates, attachments, conditional submission-channel logic, scheduled policies, dual approval and retroactive intervention in existing orders remain future scope. Official source/reuse and provider qualification are separate launch decisions; the previous state-launch review remains open. The two implemented nexus dimensions do not constitute a complete conflicts-of-law engine.
