# SPRINT-0012 — Template review and availability controls

**Status:** Complete (local implementation; not deployed)
**Run:** `2026-10-20-template-governance`
**Source:** Current working tree on `4225135eb5bc0d1b35407851a809a69480a571c6`, including SPRINT-0011 and existing admin changes; fingerprints in run.
**Owner:** Codex coordinator; Luna backend and admin UI workers in isolated clones.

## Pyramid index

1. Objective and authority
2. Product and policy design
3. Interface contract and enforcement
4. Ordered work and acceptance criteria
5. Validation, limits and provenance
6. Execution evidence

## Objective and authority

Give operators a reviewable, audited way to pause individual templates and configure service geography. Research official consumer templates and design a future California product area. This scope is authorized by the user's October 20 request. Read [Master Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md); preserve all six invariants. Static registry remains the historical source; mutable availability is an overlay and never edits paid snapshots or letter prose.

## Product and policy design

**Admin: Templates & coverage.** Search/list all nine compiled notices; inspect title, slug, category, deterministic body/fields, exact UPL disclosure, content digest, source links and review record. Edit enabled state, review requirement, source/review metadata and geographic rules. Show global controls, derived effective status, unreviewed/stale/expired warnings, change reason, confirmation, latest audit history and stale-save conflicts. Link from admin navigation; responsive and keyboard usable. Read capability is reports.read; mutations use controls.manage (owner by default). Display actual edit permission.

**Review lifecycle:** unreviewed / in_review / approved / hold. “Approved” is an operator-recorded review, never a system-generated legal opinion. Approval records reviewer, reviewed date, next review date, evidence reference and server-verified current content digest. Hold denies service. Global or per-template require-current-review additionally denies unreviewed, stale or expired approvals. Approval does not auto-enable a template. Source records identify official guidance, official sample or original content, URL, jurisdiction, retrieval date, reproduction status and notes; current templates are not automatically relabeled official.

**Geographic rules:** global and per-template residence/property rules each use all / allowlist / blocklist plus validated 50-state/DC codes. Global restrictions cannot be overridden by a template; both must allow. Property rules apply to tenant notices. Missing location blocks only where the relevant rule needs a location; invalid supplied locations fail. Consumer residence is explicitly declared and separate from sender address; tenant property state is distinct from recipient address. No IP-only enforcement or automatic address inference. The same property declaration drives deposit citation selection, rejecting conflicts. This first version handles these two explicit nexuses; other service-specific conditions remain review notes and future work, not auto-approved logic.

**Defaults:** the known existing nine are enabled/unreviewed with unrestricted geography and no mandatory-review gate, preserving current operation without claiming clearance. Unknown/new templates default disabled. No recommended state hold is seeded as an active block. A missing policy document uses only explicit migration defaults; malformed or unavailable storage fails closed for new preparation/checkout.

**Cutoff:** policy changes apply to NEW preparation/staging and checkout locks committed after the policy update. Read policy and persist the new stage or frozen order within one Firestore transaction. A lock committed first is grandfathered, including its later Stripe intent creation/confirmation. This policy control does not cancel issued intents, refund charges, halt already-paid dispatch or rewrite letters. UI must explain this boundary; retroactive order intervention is separate work.

## Interface contract and enforcement

Coordinator will freeze TypeScript/HTTP shapes in [contract](../../.delivery/runs/2026-10-20-template-governance/contract.md) before concurrent implementation. Use `src/lib/docket/template-policy.ts` for browser-safe types/pure evaluation, `lib/template-policy-store.ts` for server policy/catalog/storage and `GET/POST /api/admin/console/templates` for administration. `GET /api/docket/availability` returns only public availability/required-location information with no private reviewer notes or audit data. All policy responses are no-store and dynamic.

Authoritative new-work checks: shared createStagedDraft (REST/MCP), staged retrieval recheck, direct workspace entry, and lock-and-intent before order/payment. Public chooser, direct URLs, account reuse, sitemap, llms and remote/browser MCP discovery must reflect availability or route through the same gate. Unavailable choices cannot be offered as immediately usable. Ordinary partial letter fields remain allowed in agent staging; missing required policy nexus returns a structured actionable error. Frozen order stores decision revision, compiled content digest, explicit declared nexus and decision time. Admin and public browser state never overrides server decisions.

Admin writes use strict bounded schemas, known slugs, validated states and safe URL schemes; same-origin/capability authorization; expected revision and content digest checks; request idempotency; policy+successful immutable audit in one transaction. Conflicting reuse of request ID fails. Audit includes actor, time, environment, reason and before/after; error responses do not leak private content. No arbitrary client timestamp/actor or review hash trusted.

## Ordered work and acceptance criteria

| Task | Owner | Dependencies |
| --- | --- | --- |
| T01 Source research and product area recommendation | Coordinator | none |
| T02 Plan, API/type contract, actual Luna critique, isolated baselines | Coordinator + Luna | inventory |
| T03 Pure policy, versioned store, admin/public APIs, stage/lock/discovery enforcement and tests | Luna high | T02 |
| T04 Admin Templates & coverage panel and nav, bounded UI tests | Luna medium | T02 contract |
| T05 Customer location gate, availability-aware chooser and workspace integration | Coordinator | T02 contract; T03 for final integration |
| T06 Integrate, independently review, test API bypasses and browser behavior; record evidence | Coordinator/Luna reviewer | T03–T05 |

- AC1: Admin can inspect every compiled notice and its current content/review/source record, pause/enable it and persist a reasoned change; required-review, stale/expired and hold behavior is explicit.
- AC2: Global and template rules combine correctly; residence/property inputs are explicit, missing/invalid required nexus blocks, recipient/mail state cannot bypass, conflicting deposit property state rejected.
- AC3: Unauthorized/wrong-origin updates fail; strict input validation, CAS conflicts, same-request replay and conflicting replay behave correctly; policy and successful audit are atomic and scoped to environment.
- AC4: Paused/held/restricted new work is denied on direct UI, REST stage, resumed stages, MCP and lock; discovery/public surfaces cannot bypass; policy errors fail closed. Re-enabling restores new work.
- AC5: Transaction cutoff/decision evidence is tested; already frozen/paid orders continue exact stored content. No arbitrary template/body mutation, live services or changes to six invariants.
- AC6: Relevant regression suites, typecheck, actual desktop/mobile admin and customer gates pass using local mocks; test payment/postage side effects are suppressed and asserted absent for denied paths.
- AC7: Official-source memo separates official samples, tools and guidance, covers CA privacy/free official alternatives and other states, notes provider/reuse restrictions and future area design. No new legal clearance or paid product is claimed.
- AC8: Run, plan, ledger and authority addenda accurately record scope/results; baseline user changes outside owned paths preserved.

## Validation, limits and provenance

Test the pure matrix, future-template defaults, review expiration/content staleness, global precedence, empty allowlists, NC residence with CA recipient versus permitted residence, tenant matter state, hidden direct/API bypasses, stale stages, read failures, concurrent policy saves, role/origin, same/conflicting idempotency keys and audit persistence. Add meaningful route tests using actual local mock Firestore; do not describe mocks as distributed/emulator proof. Run existing staging/MCP, draft/signature, snapshot/integrity, checkout and admin-security regressions plus TypeScript. Use Chrome browser screenshots/behavior at desktop/mobile and independent diff review. Repair at most three cycles before reporting any unresolved blocker honestly.

No production deployment, external policy writes, registrations, payment/postage, new notice bodies, text editor, uploads/attachments, approved-state seed list, retroactive Stripe cancellation/refund or full 50-state legal audit. Official wording is product evidence; provider authorization, reproduction rights, correct channels and template-specific suitability remain separate launch checks. Future CA/other state product area is designed/researched here, not launched.

Single-app Codex delivery. Actual Luna architecture reviews inform the plan; optional Antigravity handoff is unexecuted. Coordinator owns all plan/ledger changes. Each worker has one isolated checkout and disjoint write scope; coordinator integrates reviewed files only.

## Execution evidence

Implemented and independently reviewed. Two Luna workers delivered backend and admin UI in isolated clones; coordinator integrated customer gates and source research. Final integrated run: **195 tests passed, 0 failed**, TypeScript and diff checks passed. Actual Chrome desktop/mobile checks passed for admin mutation/permissions/conflict/retry, customer geography, stage/MCP/WebMCP and failure states; screenshots inspected. Final Luna review found no concrete blocker.

| Acceptance | Evidence |
| --- | --- |
| AC1 | Admin UI, review matrix/API tests, Chrome save/inspect/read-only checks |
| AC2 | Pure rule matrix, stage resume/conflict tests, browser distinct residence/property/recipient checks |
| AC3 | Admin route/store tests and actual stale-save/retry browser checks |
| AC4 | REST/MCP creation/resume and direct/chooser/WebMCP browser checks; malformed-store/client response tests |
| AC5 | Lock pause test: frozen order preserved, later order denied before second mock payment; snapshot regressions |
| AC6 | Final 195-test log, typecheck, 1440/390px browser artifacts |
| AC7 | [Official-source research and California design](../legal/OFFICIAL_TEMPLATE_PRODUCT_REVIEW_2026-10-20.md) |
| AC8 | Baseline fingerprints, narrow integration, authority addenda and completed ledger/run |

See [implementation result](../../.delivery/runs/2026-10-20-template-governance/implementation-result.md) and [run index](../../.delivery/runs/2026-10-20-template-governance/INDEX.md) for exact commands, repairs and limits. Local mock Firestore tests are not emulator/distributed concurrency proof. No production deployment, external policy changes or new legal templates occurred. Existing nine remain unreviewed migration defaults; state launch/reuse clearance remains separate.
