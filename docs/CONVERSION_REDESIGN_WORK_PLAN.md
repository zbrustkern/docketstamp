# SendMyNotes: conversion redesign work plan

**Document ID:** CR-WP-002 (revises CR-WP-001)
**Prepared:** October 11, 2026. **Revised:** October 11, 2026, incorporating the [independent review](CONVERSION_REDESIGN_WORK_PLAN_REVIEW.md), required changes R1–R5.
**Status:** `APPROVED FOR DEVELOPMENT — production release gated`. The founder approved starting development with R1–R5 applied (§0). Production launch stays gated on working payments, preserved drafts, accurate fulfillment, and reliable measurement (§0.5). Task status is tracked in §9. Nothing is *Verified* until QA evidence and the relevant gate say so.
**Implements:** [Conversion redesign builder plan](CONVERSION_REDESIGN_BUILDER_PLAN.md) (the "source plan")
**Governed by:** [Canonical project brief](CANONICAL_PROJECT_BRIEF.md), [canonical product specifications](CANONICAL_PRODUCT_SPECS.md), [Handwrytten integration audit](HANDWRYTTEN_INTEGRATION_AUDIT.md), and [`AGENTS.md`](../AGENTS.md)
**Planning provenance:** Written by a single agent (Antigravity) from the source plan, the canonical documents, and source inspection on October 11, 2026. The [independent review](CONVERSION_REDESIGN_WORK_PLAN_REVIEW.md) recommended approval with required changes R1–R5. Those changes are incorporated in §0 and are binding.

> [!IMPORTANT]
> If this plan conflicts with the canonical documents, the canonical documents win. This plan schedules work. It does not change founder decisions, promote unresolved supplier facts, or set a conversion baseline. As of the canonical baseline there are **zero independent customer conversions**, and **Apple Pay is untested**.

---

## 0. Revision 002: binding amendments (supersede conflicting rows below)

Where §0 conflicts with §3–§9, **§0 wins**. Original rows are kept for traceability and marked *superseded*.

### 0.1 Development baseline (recorded October 11, 2026, before any change)

On `main` at `4351309` with an uncommitted documentation-only working tree:
- `npx tsc --noEmit` produced no errors.
- `npm run test:` `target`, `security`, `telemetry`, `flags`, `ads`, `meta`, `sync` and `intent` all exit 0.

Any later failure in these is a regression owned by the task that caused it.

### 0.2 Amended task contracts (R1–R3)

**R1: server-side mode boundary (amends S0-04).** S0-04 now also owns:
- `lib/stripe.ts` (mode handling),
- `app/api/webhooks/stripe/route.ts`,
- `app/api/checkout/confirm-order/route.ts`,
- `app/api/checkout/complete-free-order/route.ts`,
- the payment-mode boundary in `lib/order-processor.ts`.

Required behaviour:
- **Explicit server mode** (`live` | `stripe_test` | `local_mock`), resolved only from server environment. In production, missing or placeholder Stripe credentials are a configuration error, never a simulated intent. `local_mock` is impossible when `NODE_ENV=production`.
- **Free orders are separate.** Genuine zero-cost orders remain a distinct server-validated path (valid discount, server-computed $0). They are never reached through a mock or misclassification.
- **Test payments can't trigger live mail.** A Stripe event with `livemode: false`, or a test-mode PaymentIntent, must never cause live Handwrytten submission, whatever supplier key is present. It is either rejected or routed to supplier test mode / mocked dispatch, and the order is labelled test.
- **Signature checks stay.** The existing webhook signature check is kept. The test bypass stays limited to `NODE_ENV=test` plus a server env flag.
- **Failed loads fail.** A failed provider load or initialization never enters a success path, on the client or the server.
- **Tests:** missing live config; placeholder key in production; unsigned event; `livemode:false` event with a live supplier key present; a client-sent mode flag; valid comp. All use isolated mock storage and a mocked supplier.

**R2: purchase authority and telemetry ingestion (amends S0-02/S0-03).**
- `/api/telemetry` rejects any browser-submitted purchase- or fulfillment-authority event (`payment_succeeded`, `purchase_verified`, `fulfillment_*`, and future authority names) with 4xx, and counts nothing.
- Metadata goes through **per-event allowlist schemas**: known keys only, primitive values only, bounded lengths. Unknown or nested fields are dropped or the event is rejected. `path`, `referrer` and `landingPath` are reduced to origin + pathname. Query strings are never kept, apart from an allowlisted set of UTM/click-ID keys whose values are length-bounded.
- **Server-only classification.** Order fields (`customer` | `founder_test` | `comp` | `stripe_test`) are set only by the server: by mode, discount type, and an operator-maintained exclusion list. They are never taken from a checkout payload.
- **One purchase per order.** `purchase_verified` is derived from protected order state and de-duplicated across the webhook and client-confirmation paths by order ID and PaymentIntent ID.
- **Linking sessions to orders.** Orders store the telemetry `sessionId` and `experienceVersion` given at intent creation (non-authoritative linkage only). Conversion = verified customer orders / eligible landing sessions over the same date window and cohort.
- **Acceptance:** a browser POST can't increase paid counts. Replays count once. Nested personal metadata is rejected. A forged classification changes neither counts nor payment processing.

**R3: A2 geometry implementation (new task S0-08; S0-07 narrowed).**
- **S0-07** (narrowed): create `lib/message-compose.ts` and its tests only, plus the audit note `docs/redesign/evidence/fit-crop-audit.md`.
- **S0-08** owns:
  - `lib/image-optimizer.ts`,
  - `components/CardPreview.tsx`,
  - custom-generation output handling (`lib/nano-banana.ts` output stage, the `app/api/generate-cover/route.ts` response shape),
  - preset derivatives under `public/presets/` (originals kept),
  - the message call sites: preview in `CardPreview`, dispatch in `lib/handwrytten.ts` message assembly.
- **What S0-08 does:** apply the 17:22 folded front and 17:11 open spread with documented supplier bleed and safe area. Make a deliberate crop-or-regenerate decision for each preset (never stretch). Wire `composeDispatchMessage()` into the real preview and dispatch call sites.
- **Dependencies:** runs after S0-04 and S0-06 merge, because it shares `lib/handwrytten.ts` and `lib/order-processor.ts` neighbours. S1-04 uses CSS cropping until S0-08's derivatives land.
- **Acceptance:** catalog, preview and upload use compatible A2 geometry. Crop and safe-area decisions are written down. Composed text matches at the integrated call sites (test through the real functions, not only the helper). No physical text-fit claim is based on the 450-character limit.

### 0.3 Corrected ownership and merge order (R5)

**Single integrator.** `ORCH` is the only integrator of shared contracts:
- `components/v3/TargetPurchaseExperience.tsx` state and orchestration,
- the checkout request/response contract,
- the `Order` and `TelemetryEvent` types in `lib/types.ts`.

A task that needs a contract change describes it in its report. `ORCH` applies it during integration, or hands ownership to one named task at a time.

| Shared file / area | Owner order (serialize; each waits for the previous merge) |
| --- | --- |
| `app/api/webhooks/stripe/route.ts`, `confirm-order`, `complete-free-order`, `lib/stripe.ts` | S0-04 → S0-03 |
| `lib/order-processor.ts` | S0-04 (mode boundary) → S0-06 (sender validation) → S0-03 (classification and `purchase_verified`) |
| `lib/handwrytten.ts` | S0-06 (sender block) → S0-08 (message assembly and geometry) |
| `lib/types.ts` | S0-02 (telemetry types) → S0-03 (order classification fields). Edits are applied by `ORCH` at integration if two tasks run at once. |
| `lib/metrics-rollup.ts`, `app/api/telemetry/route.ts`, `lib/telemetry.ts` | S0-02 → S0-03 |
| `lib/stripe.ts` product description (5×7 text) | S0-04 replaces it with a neutral string. S0-05 later switches it to `lib/product-facts.ts` constants. |
| `components/v3/TargetPurchaseExperience.tsx` | S0-04 (checkout init handlers) → S1-02 (route/context convergence) → S3-02 (checkout snapshot/revision) → S3-04 (guest `viewToken` storage/navigation) |
| `components/v3/Step4ReviewAndPayment.tsx` | S0-04 (submit path) → S3-03 |
| `components/v3/Step3EnvelopeAddressing.tsx` | S2-03 → S2-04 (S2-04 now depends on S2-03 being merged) |
| `app/api/checkout/create-intent/route.ts` | S0-04 → S0-03 (session linkage fields) → S2-03 (address validation block) → S3-02 |
| `components/CardPreview.tsx`, `lib/image-optimizer.ts` | S0-08 only, until it merges |
| `tests/` | Each task adds **new** test files. Edits to existing shared test files are serialized by `ORCH`. QA branches don't run at the same time against the same test file. |

### 0.4 Speed sequencing: Wave 1 starts now (amends §5)

Compatible lanes start immediately. UI prototyping goes ahead before the full analytics rewrite, but **live conversion evaluation waits for reliable measurement**.

| Lane | Tasks | Agent | Notes |
| --- | --- | --- | --- |
| A: checkout safety | S0-04 (with R1) → S0-06 | `smn-implementer` (branch) | Highest priority. Fixes apply to all traffic once `OP` deploys. |
| B: measurement | S0-02 (with R2) | `smn-implementer` (branch) | S0-03 follows after lane A merges. |
| C: truthful copy | S0-05 (includes the former S0-01 claims inventory) | `smn-implementer` (branch) | Mustn't edit lane A or lane D files. Claim lines found there are reported to their owners. |
| D: mobile entrance prototype | S1-03 shell + S1-04 card step + S1-01 draft model | `smn-implementer` (branch) | New `components/flow/` and `lib/draft/` plus `Step1CardSelection.tsx`. Doesn't touch `TargetPurchaseExperience.tsx`. A temporary `?proto=entry` mount in a new route, `app/preview/entry/page.tsx`, so no flag or route change is needed yet. |
| E: discovery (moved from S3-01) | Stripe Express Checkout compatibility | `research` (read-only) | Starts now. Feeds D6. |
| OP prep (moved forward) | Stripe payment-method domain registration in **test** mode for preview hostnames. List the devices and app browsers available. Supplier questions sent. | Founder | No production mutation. Supplier paper answers stay pending; neutral "cardstock" wording is used meanwhile. |

Wave 2 (after lane A merges): S0-03, S0-06 (if not yet done), S0-07/S0-08, S1-02, S1-05. Wave 3: Sprint 2. Wave 4: Sprint 3 (S3-01 is already done in lane E). Wave 5: Sprint 4.

**Merge checks for each increment:** `npx tsc --noEmit`, `npm run build`, plus the contract tests for the files changed. The full suite runs at gates and when a shared dependency changes. Internal merges don't need founder approval. Founder review is reserved for product decisions (§7), real transactions, and production deploy and release.

### 0.5 Release gates tightened (R4; amends G3, G4, G5, S2-02, S3-OP-02, S4-06, S4-07)

*Not verified* is acceptable **during development only**. It is never a release pass. Production release (G5) requires completed, recorded real-phone evidence for:

1. An ordinary journey (card → note → address → pay → confirmation) on at least one real iPhone (Safari) and one real Android phone (Chrome), plus the Meta in-app browser for the actual ad destination on at least one platform.
2. Keyboard behaviour on those phones: the note textarea and address fields stay visible, and the action bar comes back.
3. Card payment fallback completes (Stripe test mode before release; live only with written founder authorization).
4. Cancelling payment keeps the draft and review intact.
5. Protected receipt access works with a valid token and is denied with an invalid one.
6. Apple Pay / Google Pay is **claimed only** in contexts where a successful authorization was recorded. Unsupported and untested contexts are listed explicitly, and the card fallback must work in them.

**Non-waivable launch blockers.** Any one of these stops release or forces rollback:
- simulated success in production,
- wrong amount, recipient or content,
- duplicate payment or fulfillment,
- test payment causing live fulfillment,
- personal-data exposure,
- forged or duplicated purchase counts,
- inability to complete the supported payment path,
- loss of draft content on cancel or back.

Cosmetic and minor accessibility issues may be accepted by `OP` with an owner and a follow-up date. This review authorizes no live transaction.

---

## Pyramid index

1. **Goal.** Ship one mobile-first SendMyNotes purchase flow: **Card → Note → Address → Pay → Confirmation**. It must be truthful, fail safely, and be measurable. It ships as a reversible candidate.
2. **Shape.** Five sprints (S0–S4), each closed by a gate (G1–G5). They map to the source plan's packages 0–6. Indicative effort is 12–20 working days plus supplier, device and observation time. This is an estimate, not a commitment.
3. **Who does what.**
   - The **orchestrator agent** splits the work into single tasks for **Gemini subagents**, each working in an isolated branch workspace.
   - A separate **QA validator subagent** checks every task.
   - The **founder/operator** owns everything that touches money, devices, suppliers, ads, photos or production allocation.
4. **Order of work.** Safety and measurement come first (S0), because the UI can't be judged without trustworthy counts or with a checkout that can fake success. Then entry → note/address → payment, then proof, usability and rollout.
5. **Hard guardrails.** Agents must not:
   - place billable orders or run fulfillment scripts,
   - make live transactions without written authorization,
   - change ad destinations or production flags,
   - publish unsanitized photos,
   - send personal data in telemetry,
   - make product claims beyond the canonical specs.

---

## 1. Objective, scope, and non-goals

### 1.1 Objective

A personal sender on a phone can:
- understand the offer,
- choose or create a card,
- write their words,
- give correct recipient and personal return addresses,
- pay with a method verified to be available,

without losing work or needing an account. Each step is counted with unique-session, server-verified measurement. This is the source plan's §13 definition of done.

### 1.2 In scope

All source plan sections §2–§12 and packages 0–6 (§11), including:
- fixes applied to **all traffic** for correctness defects: false product claims, simulated production success, and the A&B sender fallback;
- a feature-flagged candidate flow for the redesigned UI.

### 1.3 Non-goals (explicitly excluded)

- A new supplier, a native app, a multi-product "factory", multi-tenancy, or new account requirements (source §11).
- Rebuilding the Aster & Blanche recipient site, or removing the A&B backplate or physical colophon (source §7).
- A third independent purchase flow. Routes converge on one implementation (source §2).
- Changing ad destinations, campaign spend, or launching paid A/B tests during these sprints (source §12 Rollout, step 1).
- Declaring commercial validation. That requires independent customer orders after release (source §13).
- Address-verification services, unless decision D7 approves them.

---

## 2. Verified starting state (source inspection, October 11, 2026)

These are code facts that shape the task order. They are observations, not test results.

| # | Finding | Location | Consequence for plan |
| --- | --- | --- | --- |
| F1 | The homepage serves the legacy builder unless the v3 flag or `?v3=1` is set. `/send/[occasion]` and `/send/[occasion]/[slug]` always mount the legacy builder. `/new` always mounts v3. | [`ExperienceRouter.tsx`](../components/ExperienceRouter.tsx), [`app/send/[occasion]/page.tsx`](../app/send/%5Boccasion%5D/page.tsx), [`app/new/page.tsx`](../app/new/page.tsx) | Two purchase flows exist today. S1-02 converges them on one flow behind a candidate flag. |
| F2 | When v3 checkout fails to initialize, it still goes to step 4 ("sandbox mode"). `isMockCheckout` starts as `true`. | [`TargetPurchaseExperience.tsx` L391-L395](../components/v3/TargetPurchaseExperience.tsx#L391-L395), [L114](../components/v3/TargetPurchaseExperience.tsx#L114) | A P0 safety defect, fixed in S0-04 before any UI work is judged. |
| F3 | Payment simulates success if `isMock` is set **or** if Stripe or Elements failed to load. It posts a mock `payment_intent.succeeded` to the webhook route, then calls the success handler. | [`Step4ReviewAndPayment.tsx` L189-L224](../components/v3/Step4ReviewAndPayment.tsx#L189-L224), [L662](../components/v3/Step4ReviewAndPayment.tsx#L662) | S0-04 removes the client-decided mock path and confirms the webhook rejects unsigned mock events in production. |
| F4 | `payment_succeeded` telemetry fires from the browser. Rollup counters add up events and count step navigation as completion. | [`TargetPurchaseExperience.tsx` L431-L435](../components/v3/TargetPurchaseExperience.tsx#L431-L435), [`lib/metrics-rollup.ts`](../lib/metrics-rollup.ts) | S0-02/S0-03 rebuild the funnel on unique sessions and a server-verified `purchase_verified` event. |
| F5 | The delivery estimate skips only Sundays and uses an assumed studio day. | [`lib/delivery-estimate.ts`](../lib/delivery-estimate.ts) | S0-05 replaces it with broad supplier guidance from the canonical specs. |
| F6 | Sender-facing files reference A&B, and customer surfaces include 5×7, paper-weight, cotton or letterpress-type claims. Examples: `app/layout.tsx`, `app/page.tsx`, the legacy builder, `CardPreview`, `CheckoutStep`, `Step1CardSelection`, `Step5Confirmation`, `app/order/[id]`, `lib/meta-ads.ts`, `lib/google-ads.ts`. | `grep` inventory; exact lines are confirmed in S0-01 | S0-05 (claims) and S4-04 (brand cleanup) work from a line-level inventory, not this summary. |
| F7 | The fulfillment request falls back to sender name "Aster & Blanche" / "Press" when it's missing. | [`lib/handwrytten.ts`](../lib/handwrytten.ts) (per integration audit) | S0-06 adds server-side personal-sender validation. |
| F8 | Installed SDKs: `@stripe/react-stripe-js` ^3.1.1, `@stripe/stripe-js` ^5.6.0, `stripe` ^17.6.0, `next` ^15.1.7. Lint uses `next lint`. Tests are standalone `tsx` scripts (`npm run test:*`). | [`package.json`](../package.json) | S3-01 checks Express Checkout compatibility. S4-07 confirms lint tooling works. |
| F9 | `scripts/test-card-creation.ts` uploads assets and calls the fulfillment pipeline. | Integration audit | **Agents must never run it**, nor any other fulfillment script. |

---

## 3. Roles and operating model

### 3.1 Roles

| Role | Who | Responsibilities | May not |
| --- | --- | --- | --- |
| **Founder / operator** (`OP`) | Founder | Approves gates and decisions. Handles Stripe dashboard, domains, supplier email, ad configuration, real devices, private photo originals, production flags/allocation, and any live transaction. | — |
| **Orchestrator** (`ORCH`) | Primary Antigravity agent | Breaks sprints into tasks and dispatches subagents. Enforces file ownership and merge order. Integrates branches, runs gate checks, updates the tracker (§9). Writes gate reports. | Approve its own gates. Do any `OP` task. |
| **Implementer** (`IMPL`) | Gemini subagent, `pro` model, `branch` workspace, write tools | Carries out one task: code, tests and notes inside its assigned files. | Deploy, change production config or flags, run fulfillment scripts, use live keys, edit files outside its assignment without asking `ORCH`. |
| **Researcher** (`RES`) | Built-in `research` subagent, `flash` model, read-only | Inventories, SDK and documentation checks, line-level audits. | Edit files. |
| **QA validator** (`QA`) | Gemini subagent, `pro` model, `branch` workspace, write tools limited to `tests/` and evidence notes | Independently checks a finished task against its acceptance criteria. Adds or extends tests. Reports pass/fail with evidence. | Change product code to make its own checks pass. Validate a task it implemented. |
| **Copy & privacy auditor** (`AUD`) | Gemini subagent, `flash` model, read-only | Checks diffs for claims beyond canonical specs, A&B leaks in sender UI, personal data in telemetry/URLs, and unsanitized assets. | Edit files. |

### 3.2 Subagent definitions (created once by `ORCH` with `define_subagent`)

| Name | Tools | System-prompt essentials |
| --- | --- | --- |
| `smn-implementer` | write tools | Read `AGENTS.md`, both canonical docs, the source plan section cited by the task, and this plan's §4 guardrails. Work only in assigned files. Return the report in §3.4. |
| `smn-qa-validator` | write tools (tests/evidence only) | Same reading. Check each acceptance criterion separately. Run listed commands and include their output. Never mark a criterion passed without evidence. Label anything mock-only as such. |
| `smn-auditor` | read-only | Same reading plus the claims rules in the canonical specs. Report each violation with file, line, rule and suggested neutral wording. |

The built-in `research` agent handles `RES` tasks.

### 3.3 Dispatch protocol

1. **One task per subagent invocation.** The prompt contains: task ID, goal, assigned files, dependencies already merged, acceptance criteria copied verbatim from this plan, guardrails (§4), and the report template (§3.4).
2. **Isolation.** `IMPL` and `QA` run with `Workspace: branch`. Branches are named `cr/<task-id>`.
3. **File ownership.** Tasks running in parallel must not share files. The ownership table in each sprint section is binding. If a task needs a file it doesn't own, it stops and asks `ORCH`.
4. **Merge order.** Implementer report → `AUD` (when the task touches customer copy, telemetry or assets) → `QA` → `ORCH` integrates into `cr/sprint-N` → type check, build and listed tests on the integrated branch.
5. **Rework.** A failed QA or audit goes back to the same implementer conversation with the findings. After two failed cycles, `ORCH` escalates to `OP`.
6. **No silent scope growth.** Defects found outside scope go into the tracker as new candidate tasks. They aren't fixed in passing.

### 3.4 Required subagent report

```text
Task: <ID>   Status: implemented | blocked | partial
Files changed: <list>
Acceptance criteria: <each criterion> — PASS/FAIL/NOT VERIFIED — <evidence: command + output excerpt, screenshot path, or file:line>
Commands run: <exact commands and exit codes>
Mock vs real: <what was verified only against mocks/test mode>
Claims touched: <customer-visible copy changed, with canonical-spec row relied on>
Open issues / follow-ups: <list>
```

Status words follow the source plan's maintenance rule: **Proposed → Implemented → Verified**. Only a passing `QA` report plus gate review may move a task to *Verified*.

---

## 4. Guardrails (binding on every agent)

1. **No physical or billable side effects.** Don't run `scripts/test-card-creation.ts`, any `scripts/*` that calls Handwrytten, or any code path that submits a live supplier order. Supplier calls in tests must be mocked.
2. **No live money.** Use Stripe **test mode** only. A live transaction needs the founder's written authorization naming the purpose. It is done by `OP` and recorded as a test, never as a conversion.
3. **No production mutation.** No deploys, production feature-flag changes, Firestore production writes, ad changes, or Stripe dashboard changes by agents.
4. **Truthful copy.** Customer copy may only state facts marked confirmed in [the canonical specs](CANONICAL_PRODUCT_SPECS.md). Never claim: 5×7, paper weight, cotton, archival, letterpress, embossing, human handwriting, a sender-local postmark, guaranteed arrival, "mailed today", a measured "60 seconds", or "Apple Pay ready".
5. **Privacy.** Never put names, note text, prompts, addresses, emails or raw payment errors in telemetry, URLs or logs. Don't copy unsanitized photos into the repo or `public/`. Originals stay private with `OP`.
6. **Brand roles.** The SendMyNotes purchase journey uses SendMyNotes branding. The A&B backplate, physical colophon and recipient site are preserved.
7. **Baseline honesty.** Don't present mock results, test-mode results or founder tests as customer evidence or measured improvement.

---

## 5. Sprint plan

Durations are indicative working days for one engineer-equivalent. Parallel lanes run only where file ownership is disjoint.

```mermaid
flowchart LR
  G0["G0 Plan approved"] --> S0["S0 Baseline and safety"]
  S0 --> G1["G1 Safe and measurable"]
  G1 --> S1["S1 Foundation, entry and card"]
  S1 --> G2["G2 Entry verified"]
  G2 --> S2["S2 Note and address"]
  S2 --> G3["G3 Composition verified"]
  G3 --> S3["S3 Payment and receipt"]
  S3 --> G4["G4 Payment and device verified"]
  G4 --> S4["S4 Proof, usability, rollout"]
  S4 --> G5["G5 Candidate release ready"]
  G5 --> G6["G6 Commercial validation (post-release, out of sprint)"]
```

### Sprint 0: evidence, product truth, checkout safety (source packages 0–1, §9, §10; 2–4 days)

**Sprint goal:** counts can be trusted, and no production failure can look like success.

> [!NOTE]
> Revision 002: S0-01 is folded into S0-05. S0-03, S0-04 and S0-07 are amended, and S0-08 is added, by §0.2. Ownership and order follow §0.3. Gate approvals follow §0.4 (internal merges) and §0.5 (release).

| ID | Owner | Depends on | Files owned | Deliverable | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| S0-01 | `RES` (flash) | G0 | none (read-only) → `docs/redesign/evidence/current-state-inventory.md` written by `ORCH` | Line-level inventory covering: route→component map; every `trackEvent` call and rollup counter; every unsupported claim (§4.4 list); every A&B mention in sender-facing UI, metadata, emails and Stripe descriptions. | Each item has file:line. Claims are classed as *remove*, *neutralize* or *keep (canonical)*. Legal pages are flagged for decision D5, not edited. |
| S0-02 | `IMPL` (pro) | S0-01 | `lib/types.ts` (telemetry types), `lib/telemetry.ts`, `app/api/telemetry/route.ts`, `lib/metrics-rollup.ts` (telemetry ingestion/summary only) | Event contract from source §10. Unique-per-session funnel counting. `experienceVersion` and `draftRevision` dimensions. A server-side denylist that drops personal fields. Legacy events stay readable. | Repeated events don't inflate step completion (test). Visiting a step isn't counted as completing it (test). Payloads with name, note, address or email keys are stripped or rejected (test). `npm run test:telemetry` passes and is extended. |
| S0-03 | `IMPL` (pro) | S0-02 merged | `app/api/webhooks/stripe/route.ts`, `app/api/checkout/confirm-order/route.ts`, `lib/meta-conversions-api.ts`, admin metrics route + dashboard purchase panels | `purchase_verified` is emitted server-side only, de-duplicated by order/PaymentIntent. Orders carry an `isTest` / `isComp` / founder-exclusion flag. The admin view separates customer orders from tests and comps. Meta/Ads events match real actions (no AddPaymentInfo on step load). | A replayed webhook doesn't create a second purchase event (test). The founder test order is excluded from customer conversion in the admin summary (seeded test). The client `payment_succeeded` event no longer drives purchase counts. `npm run test:meta`, `test:security` pass. |
| S0-04 | `IMPL` (pro) | G0 (parallel with S0-02) | `components/v3/TargetPurchaseExperience.tsx` (init/checkout handlers only), `components/v3/Step4ReviewAndPayment.tsx` (submit path only), `app/api/checkout/create-intent/route.ts`, legacy `components/CheckoutStep.tsx` and `VendingMachineBuilder.tsx` checkout handlers | Remove the "still navigate to step 4" fallback. `isMockCheckout` starts as `false`, and mock mode can only come from the server's explicit response. A missing `stripe`/`elements` object shows an error with Retry, not success. The webhook route rejects `x-mock-payment-intent` unless the server is in a non-production mock mode. Same fix applied to the legacy flow. | A unit or integration test shows that init failure keeps the user on review with an error and Retry. Stripe failing to load can't call `onPaymentSuccess`. In production config, a POST with the mock header returns 4xx and creates no order or fulfillment (test with mocked supplier). `npm run test:target`, `test:security` pass. |
| S0-05 | `IMPL` (pro) | S0-01 | new `lib/product-facts.ts`, `lib/delivery-estimate.ts`, `lib/stripe.ts` (product description/metadata only), `app/layout.tsx` + `app/new/page.tsx` metadata, `public/llms.txt`, claim lines listed by S0-01 outside files owned by S0-04 | One shared source for A2 4.25 × 5.5 in, 17:22, $9 including mailing, "cardstock", and timing guidance (1–2 business days preparation, typically 2–7 business days transit, estimates only). The delivery estimate uses this wording, with no hard cutoff. Unsupported claims are removed from in-scope surfaces. | `AUD` finds no §4.4 claims on in-scope surfaces. Stripe metadata no longer says 5×7. Delivery wording has unit tests at weekend and holiday boundaries, or explicitly gives no date. |
| S0-06 | `IMPL` (pro) | G0 | `lib/handwrytten.ts` (sender block only), `lib/order-processor.ts` (validation hook) | Remove the A&B / "Press" sender-name fallback. Reject orders without a personal sender name and return address before fulfillment, keeping the paid order reconcilable. | Test with a mocked supplier: a missing sender name never produces an A&B sender. The order goes to a recoverable state that `OP` can see. `npm run test:sync` passes. |
| S0-07 | `IMPL` (pro) | S0-05 | new `lib/message-compose.ts`, `lib/image-optimizer.ts` (audit notes only, no geometry change yet), `docs/redesign/evidence/fit-crop-audit.md` | One `composeDispatchMessage()` used by both preview and dispatch (greeting + note + separators). A written audit of current 5:7 artwork against the 17:22 front and supplier bleed. | Preview and dispatch produce byte-identical text for representative samples (test). The audit lists affected presets and the planned treatment (crop or regenerate) without stretching images. |
| S0-OP-01 | `OP` | G0 | — | Confirm the real ad destination URL, UTMs and optimization event. Define the clean baseline window. Identify the founder test order ID(s). Send the supplier question list from the integration audit. | Answers recorded in the tracker. Anything unanswered stays marked *unknown*. |

**Ownership note:** S0-04 and S0-05 both touch claim text inside checkout components. S0-04 owns those files, and S0-05 sends any claim lines found there to S0-04.

**Gate G1 (approver: OP).** Evidence package: integrated `cr/sprint-0` passes `npx tsc --noEmit`, `npm run build`, and all `npm run test:*`. A seeded journey reconciles (unique counts ≤ sessions, purchase counted once). Proof that init failure and missing Stripe can't produce success. `AUD` claims report is clean for in-scope surfaces. Safety and truth fixes are approved for **all traffic** (source §12 Rollout, step 2). `OP` deploys them; agents don't.

### Sprint 1: shared foundation, entry and card selection (source package 2, §2, §3, §8; 2–3 days)

**Sprint goal:** at 390 × 844, the first screen shows real card choices, the price and a next action. Preset and custom paths both lead to the same note step.

| ID | Owner | Depends on | Files owned | Deliverable | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| S1-01 | `IMPL` (pro) | G1 | new `lib/draft/` (model, reducer, store), `tests/draft.test.ts` | Versioned draft (design, custom-generation state, note, style, addresses, schedule, discount, attribution, experience version, checkout snapshot ID). Expiring per-session storage with a clear-draft action. Required content kept separate from optional preferences. | Survives refresh and back/forward (test). Never stores client secrets or card data (test asserts the stored keys). Expired drafts are discarded. Version mismatches migrate or reset safely. |
| S1-02 | `IMPL` (pro) | S1-01 | `components/ExperienceRouter.tsx`, `app/page.tsx`, `app/new/page.tsx`, `app/send/[occasion]/page.tsx`, `app/send/[occasion]/[slug]/page.tsx`, `lib/feature-flags.ts`, `components/AttributionTracker.tsx` | One candidate flow (evolved from `TargetPurchaseExperience`) that takes an explicit initial context (occasion, preset, scenario). All four routes mount it when the candidate flag is on, and the legacy builder otherwise. Sticky assignment recorded as `experienceVersion`. The full-screen "Atelier" loading gate is replaced with server-rendered entry content. | Each route renders the candidate with the right initial context when the flag is on (test). Flag off keeps the current behaviour. No route shows a second large hero above the builder. `npm run test:flags`, `test:ads` pass. |
| S1-03 | `IMPL` (pro) | S1-01 | new `components/flow/` shell: header, progress indicator, `ActionBar` | Compact SendMyNotes header. One labelled progress indicator. A persistent action bar (total + next action) replaces the fixed Preview Card bar. 16px minimum text and inputs, 44 × 44 targets, visible focus. | No duplicated progress ribbons. The action bar never covers focused inputs (checked again in S2-02). Contrast checked with a tool, values recorded. |
| S1-04 | `IMPL` (pro) | S1-02, S1-03 | `components/v3/Step1CardSelection.tsx`, `lib/card-presets.ts` (display metadata only), thumbnail assets/config | Two-column 17:22 grid with short titles. Occasion chips with a clear active state and an empty state. A contextual preselection with a checkmark. A preview sheet that keeps scroll position and selection. Optimized thumbnails with explicit dimensions. | The first row of cards and the action are visible without scrolling at 390 × 844. Usable at 320 wide. Changing selection doesn't advance the step. Showing a default doesn't emit a selection event. |
| S1-05 | `IMPL` (pro) | S1-04 | `components/v3/CustomAiCommissionDrawer.tsx` (rename allowed), `app/api/generate-cover/route.ts` (UI-contract fields only) | A compact "Make a custom design" entry near the first choices. A sheet with starters and accurate AI-assistance disclosure. Generation is explicit only. Truthful pending state. Retry or "Use a ready-made card" on failure. The last valid card is kept. Results must be accepted explicitly. | Nothing generates on load or on minor edits. Cancel keeps the note and doesn't log an order failure. A failure or timeout never clears the working selection (tests with a mocked generator). The existing rate limit still applies. |
| S1-QA | `QA` | S1-01…05 | `tests/`, `docs/redesign/evidence/s1/` | Screenshots at 320/375/390/430 and in landscape. Preset and custom journey checks. | Every S1 acceptance criterion is marked PASS with evidence, or listed as a defect. |
| S1-AUD | `AUD` | S1-04, S1-05 | — | Copy and brand audit of the entry screens. | No §4.4 claims, no A&B in sender UI, no "commission", "stationery leaf" or "inking coordinates" jargon in primary tasks. |

**Gate G2 (approver: OP).** The S1-QA screenshot set is reviewed. Preset and custom paths both reach the note step with the selection intact through preview, filter and back.

### Sprint 2: note composition and address entry (source package 3, §4, §5; 3–4 days)

**Sprint goal:** writing comes first, addresses are quick and correctly scoped, and nothing typed is ever lost.

| ID | Owner | Depends on | Files owned | Deliverable | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| S2-01 | `IMPL` (pro) | G2 | `components/v3/Step2NoteComposition.tsx`, `lib/thematic-sentiment.ts` (starter selection only) | Textarea first. One starter with "Use this starter". "More ideas" sheet with tone controls. Undo for any replacement. "Change handwriting" as a secondary control. A fit indicator built on `composeDispatchMessage()` with a provisional 450 combined-character limit, described as an app limit only. An optional "Add your name" helper. | The editor renders before inspiration and style controls. No fictional-looking names are used as live defaults. Replacements can be undone (test). Preview and dispatch text match (reuses the S0-07 test). Empty or oversized notes show a specific nearby message. |
| S2-02 | `IMPL` (pro) | S2-01 | `components/flow/ActionBar` (keyboard behaviour), focus utilities | `visualViewport`-aware action bar. Focus management on advance, back and error. | Manual check on a real iPhone and a real Android phone by `OP`, or recorded as *not verified*: the textarea stays visible while typing, and the bar comes back when the keyboard closes. |
| S2-03 | `IMPL` (pro) | G2 (parallel with S2-01) | `components/v3/Step3EnvelopeAddressing.tsx`, address validation helpers, server validation in `app/api/checkout/create-intent/route.ts` (address block only, coordinated with S0-04's merged code) | Recipient section first: full name, street, expandable unit, then city/state/ZIP that don't become cramped. Return-address section with the explanation copy. Separate `autocomplete` section tokens for recipient and sender. Prefill only from explicit or authenticated data. Reminder, account and address-book enrolment removed from this step. Name splitting happens only in transport. | A guest can finish without signing in or seeing reminders. Autofill fills the intended section (manual check, browser recorded). Invalid input focuses the first error, and valid entries are kept. Multi-part names display unchanged. Server validation matches client rules (test). |
| S2-04 | `IMPL` (flash) | D2 decided | scheduling control in Step 3 | Send-soon is the default. Scheduling is either hidden or kept as a collapsed control labelled as a *requested mailing date*, depending on decision D2. | No arrival-date guarantee appears anywhere. |
| S2-QA | `QA` | S2-01…04 | `tests/`, `docs/redesign/evidence/s2/` | Regression rows 2–3 of source §12: notes, styles, long names, autofill, apartment, wrong ZIP/state, recipient differs from buyer. Draft survival through back, refresh and preview. | All PASS with evidence, or logged as defects. |
| S2-AUD | `AUD` | S2-01, S2-03 | — | Copy, privacy and telemetry audit. | No note text or address data in telemetry. `note_completed` and `address_completed` fire only on valid advance. |

**Gate G3 (approver: OP).** S2-QA is passed. Keyboard checks are either done on devices or explicitly recorded as *not verified*.

### Sprint 3: review, wallets, payment, receipt (source package 4, §6, §7; 3–5 days)

**Sprint goal:** real Express Checkout plus a card fallback, paying against an up-to-date server snapshot. Cancelling loses nothing, and paid orders are never duplicated.

| ID | Owner | Depends on | Files owned | Deliverable | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| S3-01 | `RES` (flash) | G3 | read-only → `docs/redesign/evidence/stripe-compat.md` | Compatibility note: Express Checkout Element with the installed SDK versions and the existing PaymentIntent architecture. Availability callbacks. Whether an SDK upgrade is needed (feeds decision D6). | Cites current Stripe documentation and the installed versions. Lists the minimum versions required. |
| S3-02 | `IMPL` (pro) | G3 | `app/api/checkout/create-intent/route.ts`, new checkout-snapshot module, order model fields | Server-priced checkout snapshot with an ID and revision. Edits to card, note, address, schedule or discount update the intent or replace it (cancelling the old one). Idempotency keys. | Authorizing against an old snapshot is impossible (test). Amount changes after a discount match the server (test). Retries don't create duplicate orders (test). |
| S3-03 | `IMPL` (pro) | S3-01, S3-02, D6 | `components/v3/Step4ReviewAndPayment.tsx`, `lib/device-wallet.ts` | A review panel above payment with Edit links (go to step, then back to review). Express Checkout + Payment Element. The wallet button appears only when the provider reports it available, emitting `wallet_availability_observed`. No placeholder or fake sticky Apple Pay button. No wallet shipping collection. Email collected once. Promo code behind "Have a code?". Invented cost line items removed. User-agent regex is no longer used to claim wallet readiness. | In Stripe test mode: decline, 3DS challenge, cancel, network failure and zero-cost paths behave per source §6 (QA scripted). Cancel returns to an intact review. Only one submit control is active at a time. |
| S3-04 | `IMPL` (pro) | S3-02 | `components/v3/Step5Confirmation.tsx`, `app/order/[id]/page.tsx`, `app/order/[id]/layout.tsx`, `app/api/orders/[id]/route.ts` | Confirmation driven by server-verified payment and order state. `viewToken` stored and passed along for guests. Protected receipt. Only known stages are shown (payment confirmed / preparing / mailed). Headline "Your card is ordered." | Refresh doesn't duplicate the order or the purchase event (test). A missing or invalid token denies order data (test). A pending or failed fulfillment isn't shown as mailed. |
| S3-QA | `QA` | S3-02…04 | `tests/`, `docs/redesign/evidence/s3/` | Source §12 regression rows 4–5 in Stripe test mode: wallet unavailable, cancel, decline, 3DS, init/network failure, discount change, zero cost, repeated submit, webhook retry, client-confirmation race, paid but fulfillment pending, receipt token. | All PASS with evidence. Every result is labelled *Stripe test mode / mocked supplier*. |
| S3-OP-01 | `OP` | S3-03 merged to a preview deployment | — | Register payment method domains in Stripe **test and live** for every hostname that collects payment. | Dashboard screenshots stored privately. Hostnames listed in the tracker. |
| S3-OP-02 | `OP` | S3-OP-01 | — | Real-device matrix (source §12): iPhone Safari, Instagram and Facebook in-app browsers, Android Chrome, available Android in-app browsers. For each, record device, OS, browser/app, date, methods available, authorization result, receipt access and draft survival on cancel. Test mode first. One controlled live transaction **only** with written founder authorization, recorded as a test. | Untested contexts stay *not certified*. Apple Pay is marked verified only for the contexts actually completed. |

**Gate G4 (approver: OP).** S3-QA is passed. The device matrix is recorded. The canonical specs' Apple Pay row is updated only to the extent the evidence shows.

### Sprint 4: proof, retention, quality, usability, rollout (source packages 5–6, §7, §8, §12; 2–4 days)

**Sprint goal:** a polished, truthful, accessible candidate, tested with real people and ready for a reversible rollout.

| ID | Owner | Depends on | Files owned | Deliverable | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| S4-01 | `OP` + `IMPL` (flash) | G4 | private working directory outside the repo; then `public/proof/` | `OP` supplies originals privately. `IMPL` produces cropped or redacted derivatives with metadata stripped. `OP` and `AUD` inspect at full resolution before anything is copied into `public/`. | No names, addresses, emails, order IDs, barcodes or EXIF in published files. Handwriting and product are not altered. Originals are never committed. |
| S4-02 | `IMPL` (pro) | S4-01 | proof panel component, `app/layout.tsx` and OG/metadata copy, `lib/meta-ads.ts`, `lib/google-ads.ts` copy | A small, secondary "What arrives" panel. Metadata and structured data drawn from `lib/product-facts.ts`. | `AUD` is clean. The panel doesn't push the first card row below the fold at 390 × 844. |
| S4-03 | `IMPL` (pro) | G4 | `components/v3/Step5Confirmation.tsx` (retention block), reminders and contact components | One contextual opt-in after purchase (birthday reminder, check-in, or save recipient). Nothing prechecked. "Send another card" as a secondary action. Optional account creation. | Choosing a reminder is voluntary (test). `reminder_opt_in` fires only on explicit consent. `npm run test:reminders` passes. |
| S4-04 | `IMPL` (flash) | S0-01 inventory, D5 | sender-facing files with A&B mentions from the inventory (excluding the backplate, `lib/handwrytten.ts` colophon logic and legal pages pending D5) | A&B removed from the SendMyNotes customer journey. | `AUD` is clean. The backplate and recipient site are untouched (diff review). |
| S4-05 | `IMPL` (pro) | S4-02 | image config, lazy-loading boundaries | Lazy-load custom generation, inspiration, contact import and secondary previews. Image dimensions set. | Lab mobile Lighthouse run recorded with device and network profile (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 as *budgets*). Field data is reported separately once it exists. |
| S4-06 | `QA` | S4-02…05 | `docs/redesign/evidence/s4/` | Accessibility pass: keyboard-only, screen reader, focus and error announcements, large text, reduced motion. | Issues logged and fixed, or accepted by `OP`. |
| S4-07 | `QA` | all S4 implementation | `tests/`, `package.json` lint config (only if broken) | Full source §12 regression matrix. `npx tsc --noEmit`, `npm run build`, all `npm run test:*`. Lint confirmed to work (and fixed if `next lint` is misconfigured). | All PASS, or open defects explicitly accepted by `OP`. |
| S4-08 | `IMPL` (pro) | S4-07 | `lib/feature-flags.ts`, admin flag tab, new `docs/redesign/ROLLOUT_RUNBOOK.md` | Preview route with explicit version attribution. Sticky cohort assignment. Operator monitoring for init failures, payment errors and fulfillment failures. Rollback runbook. | Rollback rehearsed against a preview deployment by `OP`. Order processing reconciles whatever the UI allocation. |
| S4-OP-01 | `OP` (+ `QA` notes) | S4-07 | — | Usability sessions with 5–8 personal senders: ordinary birthday or thinking-of-you send, plus a few custom-design tasks. Consent recorded. | At least 80% finish the ordinary task unaided. Every blocking issue is fixed and retested. Nobody confuses recipient and return address, or the price. Recorded as usability evidence, not conversion evidence. |
| S4-OP-02 | `OP` | G5 | — | Decide on candidate allocation using actual eligible traffic. | Allocation, date and rollback triggers recorded. |

**Gate G5: candidate release ready (approver: OP; validator countersigns).** Every item in the source plan's §13 first-release definition is met with evidence links. Rollback triggers from source §12 are configured. Then G6 (commercial validation) starts. It needs independent customer orders over complete reporting windows and is **not** a sprint deliverable.

---

## 6. Traceability to the source plan

| Source plan section | Tasks |
| --- | --- |
| §1 P0 entry, branding, custom path, editor-first, action bar | S1-02…05, S2-01, S1-03, S4-04 |
| §1 P0 address simplification, wallets, safe failure, product truth, measurement | S2-03, S3-03, S0-04, S0-05/S0-06/S0-07, S0-02/S0-03 |
| §1 P1 photography, draft saving, post-purchase reminders | S4-01/S4-02, S1-01, S4-03 |
| §2 Design system and step structure | S1-03, S1-02 |
| §3 Entry and card selection | S1-04, S1-05 |
| §4 Note composition | S2-01, S2-02, S0-07 |
| §5 Address entry | S2-03, S2-04 |
| §6 Review, wallets, payment | S3-01…04, S0-04 |
| §7 Confirmation, repeat sending | S3-04, S4-03 |
| §8 Shared state, performance, assets | S1-01, S4-05, S4-01 |
| §9 Product truth | S0-05, S0-06, S0-07 |
| §10 Measurement | S0-02, S0-03, S3-03 (wallet availability), S4-03 (reminder opt-in) |
| §11 Work packages 0–6 | S0 (0–1), S1 (2), S2 (3), S3 (4), S4 (5–6) |
| §12 Validation and launch | S1-QA, S2-QA, S3-QA, S3-OP-02, S4-06, S4-07, S4-OP-01, S4-08 |
| §13 Definition of done | Gate G5 |

---

## 7. Decisions required

| ID | Decision | Needed by | Default if undecided |
| --- | --- | --- | --- |
| D1 | Retire the legacy `VendingMachineBuilder` after rollout, or keep it as a long-term control? | G5 | Keep it as the flag-off baseline until G6. Retire it later in a separate change. |
| D2 | Keep optional scheduling (only if operationally supported) or hide it? | S2-04 | Hide it. Send-soon only. |
| D3 | How prominent the custom-design entry is on the first screen. | S1-05 | A compact button/tile beside the first choices, per source §3. Revisit after usability. |
| D4 | How long drafts are kept and where. | S1-01 | Session storage, 24-hour expiry, clear-draft action. |
| D5 | Do legal pages (terms, privacy, returns) keep an A&B entity reference? | S4-04 | Leave legal pages unchanged pending founder or legal review. |
| D6 | Approve a Stripe SDK upgrade if S3-01 finds one necessary. | S3-03 | Block S3-03 until decided. No payment-architecture migration. |
| D7 | Add an address lookup or verification service? | S2-03 | No. Manual entry with validation only. Never claim an address is "verified". |
| D8 | `hwCharity` alias maps to Casual David (integration audit). Remove Charity from choices or keep it as a compatibility alias? | S2-01 | Don't offer Charity in the new style picker. |

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Express Checkout needs an SDK upgrade or doesn't fit the PaymentIntent flow | Medium | High | S3-01 research first. D6. Card fallback always works on its own. |
| Apple Pay doesn't complete inside Meta in-app browsers | Medium | High | Card fallback. Accurate browser-switch guidance only if verified. The device matrix records real outcomes. |
| Parallel subagents produce merge conflicts or inconsistent patterns | Medium | Medium | Binding file ownership. Shared shell (S1-03) and draft (S1-01) land first. `ORCH` integrates per sprint. |
| Agent copy brings back unsupported claims | Medium | High | `AUD` on every copy diff. `lib/product-facts.ts` as the single source. |
| Personal data leaks into telemetry or published images | Low | High | Server denylist (S0-02). `AUD` review. Images inspected at full resolution. Originals never committed. |
| An accidental billable order or physical mail from tests | Low | High | Guardrail §4.1. Mocked supplier in tests. Fulfillment scripts banned. |
| Supplier answers (stock, fit, cost) arrive late | High | Low–Medium | Neutral copy. The provisional 450-character app limit. Supplier answers aren't a blocker for the UI. |
| Tiny traffic makes A/B results meaningless | High | Medium | Usability gate plus absolute counts. No uplift claims. One decision tested at a time once a baseline exists (source §12). |
| Real-device and keyboard checks can't be done by agents | Certain | Medium | Assigned to `OP`. Anything unchecked is recorded as *not verified*, never passed. |

---

## 9. Tracker

`ORCH` updates this table at each merge and gate. Status: `Proposed` → `In progress` → `Implemented` → `Verified` (QA + gate), or `Blocked`.

| Sprint | Tasks | Gate | Status |
| --- | --- | --- | --- |
| S0 | S0-02 (lane B), S0-04→S0-06 (lane A), S0-05 (lane C): **In progress**. S0-03, S0-07, S0-08 queued for Wave 2. S0-OP-01 with `OP`. | G1 (internal, §0.4) | In progress |
| S1 | S1-01, S1-03, S1-04 prototype (lane D): **In progress**. S1-02, S1-05 in Wave 2. | G2 (internal) | In progress |
| S2 | S2-01…04, S2-QA, S2-AUD | G3 (internal) | Proposed |
| S3 | S3-01 Stripe compatibility (lane E): **In progress**. S3-02…04, S3-QA in Wave 4. S3-OP-01 test-mode domains with `OP` now. | G4 (OP) | Partially started |
| S4 | S4-01…08, S4-OP-01/02 | G5 (OP, §0.5 blockers) | Proposed |

Evidence for each task goes in `docs/redesign/evidence/<sprint>/` and is linked from the gate report. Gate reports are `docs/redesign/GATE-G<n>.md`, written by `ORCH` and signed off by `OP`.

---

## 10. Subagent prompt template

```text
You are <smn-implementer | smn-qa-validator | smn-auditor> working on SendMyNotes task <ID>.

Read first, in order: AGENTS.md; docs/CANONICAL_PROJECT_BRIEF.md;
docs/CANONICAL_PRODUCT_SPECS.md; docs/CONVERSION_REDESIGN_BUILDER_PLAN.md §<sections>;
docs/CONVERSION_REDESIGN_WORK_PLAN.md §4 (guardrails) and the row for <ID>.

Goal: <deliverable from the task row>
Files you own: <list>. Do not edit other files; ask the orchestrator if needed.
Already merged dependencies: <list>
Acceptance criteria (verbatim): <list>

Forbidden: running scripts/test-card-creation.ts or any fulfillment script; live Stripe
keys or transactions; deploys; production flag/config/Firestore changes; ad changes;
copying unsanitized photos; personal data in telemetry/URLs/logs; product claims
beyond the canonical specs.

Return the report in §3.4 of the work plan. Mark anything verified only with mocks or
Stripe test mode as such. Do not mark a criterion PASS without evidence.
```

---

## 11. Validator approval checklist

The validator should confirm each item, or return it with comments.

- [ ] Scope matches the source plan §§1–13 and excludes the non-goals in §1.3.
- [ ] No task asserts a supplier fact, conversion result or Apple Pay status beyond the canonical documents.
- [ ] Every P0 item in source §1 maps to at least one task with testable acceptance criteria (§6).
- [ ] Safety and measurement work (S0) comes before UI evaluation, and correctness fixes apply to all traffic.
- [ ] Every money, device, supplier, ad, photo-original and production-allocation action belongs to `OP`, not an agent.
- [ ] Parallel tasks have disjoint file ownership. Each sprint has a single integration point.
- [ ] Every gate names its approver and its evidence package. No agent approves its own work.
- [ ] Mock and test-mode verification is labelled separately from real-device and production verification.
- [ ] Privacy rules for telemetry and photography are enforceable through specific tasks and audits.
- [ ] The rollout is reversible, rollback triggers match source §12, and commercial validation (G6) is kept separate from release readiness (G5).
- [ ] Open decisions D1–D8 have owners, deadlines and safe defaults.

| Role | Name | Decision | Date |
| --- | --- | --- | --- |
| Validator | | Approve / Approve with changes / Reject | |
| Founder (G0) | | Approve / Approve with changes / Reject | |

---

## 12. Maintenance

Update this plan when decisions are made, scope changes, or gates pass. Record proposed, implemented and verified status separately. Don't rewrite the baseline in §2 or the canonical baseline as if the redesign had already succeeded. Supersede this document by version (CR-WP-002, …) rather than silently editing approved scope.
