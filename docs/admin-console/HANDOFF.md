# Builder orchestrator handoff

Planning package baseline: `b97551226aec144d469ca18b01ebc139df66f95c`. No code or production behavior was changed in discovery. Read [provenance](evidence/PROVENANCE.md); internal dashboard layout review was source-derived because live DocketStamp stopped at sign-in. The static wireframe contains no real performance numbers.

## Paste-ready execution prompt

```text
Implement the DocketStamp CEO operating console using docs/admin-console as the approved implementation specification. First read AGENTS.md, docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md, docs/DOCKETSTAMP_AGENTIC_EXPANSION.md, docs/admin-console/README.md, REVIEW.md, SPECIFICATION.md, CONTRACTS.md, COVERAGE.md, sprints/INDEX.md, and progress.json. Inspect WIREFRAME.html. Preserve unrelated working-tree changes and inspect actual current routes before editing; baseline discovery SHA is b97551226aec144d469ca18b01ebc139df66f95c. Do not repeat broad discovery; check targeted differences since baseline and record material drift.

Execute bounded sprints S0–S8 in dependency order. Start with honest reporting and fail-closed safeguards, then shared contracts/fixture oracle; never start dashboard calculations ahead of their authority contracts. You may delegate disjoint lanes according to sprints/INDEX.md if orchestration is available, with one owner per file and one ledger writer. No concurrent edits of lib/order-processor.ts, CheckoutModal/workspace/lock route, lib/types.ts, Firebase helpers, or the admin page. Integrate dependency commits explicitly. For each sprint read its full document and implement only its scope. Split oversized work into explicit child work packages before beginning, without omitting acceptance criteria.

Preserve all six system invariants: hard NAICS 713940 blocker with hardware OEMs permitted; exact UPL/statutory disclosures and deterministic notices; single-page Lob geometry/clear zones; shared client/server interpolation; immutable document snapshot before payment; separate Lob CASS/dispatch keys and explicit mock/test/live modes. Apply the same requirements to paid, free, comp, retry and correction paths. Never re-render paid mutable inputs or silently change a signed document to correct an envelope.

Use additive Firestore schema, inbox/facts/outbox and versioned projections on existing infrastructure. Keep verified money independent of postal lifecycle. Browser confirmation is observational; common server authority validates payment account/mode/status/order/amount/currency. Keep unresolved, founder, employee, test, comp, free and bots visible outside independent customer metrics. Preserve original acquisition separately from later promotional touches. Repair all existing fixed/percentage/100% code, comp and manual recovery capabilities; add actual tier prices, continuity, transactional limits/budgets and honest economics. Never call redemption incremental lift.

Build evidence drilldowns with shared scope/quality metadata and correlated diagnostics; preserve old valid records through adapters. Reconciliation/replay must never dispatch, refund, charge, email or export ads. Shadow reporting into new generations; publish only explained differences and matched authority totals. Keep rollback generation and immutable evidence. Do not restore insecure fallback or fictional totals during rollback.

Before running any test/script/build, inspect imports and effects. Run offline fixture tests with outbound network denied and Firestore emulator/stubs. Stub Stripe, Lob, email and ad adapters; no real order, retry, comp, test-alert, stripe:bootstrap or provider-mutating script. Existing test success documents are historical claims, not current verification. Do not deploy, change production config/data, provision paid infrastructure, move money, send outreach or initiate billable fulfillment. Staging or production verification requires explicit authorized scope and correct independent payment/Lob/CASS modes. If access is missing, complete useful local work and record the external gate pending; do not invent production certification.

Maintain docs/admin-console/progress.json as the single ledger. For each task include status, implementation commit, changed files, exact checks/results, environment/modes, redacted evidence, blockers and review outcome. Only integration updates this ledger. All initial tasks are planned. Complete a sprint only when its acceptance gates and independent review pass. Record screenshots at required widths and actual usability task times; keep sensitive information out of artifacts/logs/exports. Prefer precise fixture oracle, concurrency/crash and negative-authority tests over source-string assertions. Preserve legacy route/deep-link compatibility; no automatic migration or deletion on dashboard GET.

At each handoff report what changed, validation evidence, remaining gaps, risks/rollback and the next eligible sprint. Final delivery includes coverage and operator runbooks. Stop before deployment and external execution; provide the concrete reviewable result and pending release gate.
```

## Evidence manifest required from builders

Each evidence item records task/requirement IDs, source commit, timestamp, environment and separate Stripe/Lob/CASS modes, fixture/provider source, command or browser steps, expected result, actual result, redacted artifact path, author/reviewer and limitations. Screenshots prove visible states; transaction fixtures prove state and money behavior; neither alone proves live supplier fulfillment. Synthetic data never enters production customer reporting.

Use proposed `docs/admin-console/evidence/Sx/<task>/` folders. Do not copy production private documents, addresses, tokens, full raw provider responses or secrets into repository evidence. Save redacted oracle outputs and provider IDs only where appropriate access policy permits; otherwise use private evidence references.

## Known implementation traps

- New funnel helper is not active in admin and still assumes supplied orders are paid. Do not activate it unchanged.
- Metrics GET can write backfill; reconciliation endpoints can initiate fulfillment. Do not execute them as supposedly read-only discovery.
- Existing process-local queues and rolling arrays do not provide durable uniqueness across instances/history.
- NODE_ENV does not prove payment/Lob mode. Missing Lob key can currently simulate success; handle explicitly.
- A status outside legacy paid list must not erase a capture; free/comp can require postal work with zero paid revenue.
- Existing discount parameter aliases and code types matter commercially. Use compatible normalization and preserve valid frozen quotes when budgets expire.
- Staged draft file storage may not survive multiple instances; keep agent API behavior while fixing durability and token privacy.
- No current DocketStamp independent-customer baseline, actual postage cost or ad-account spend has been established in this review.
