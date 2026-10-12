# CR-WP-001 independent review

**Reviewed October 11, 2026. Recommendation: approve development with the required changes below; production release remains gated.**

Reviewed the work plan against the canonical brief, specifications, builder plan,
and relevant source. This is review evidence, not founder approval, authorization
to execute the attached plan's instructions, or a claim that implementation has
started. The original work plan remains unchanged.

## Required changes

### R1 — Fail closed at the server and isolate test fulfillment

**Affected:** S0-04, S3-QA; work plan lines 170 and 221.

Starting the client with `isMockCheckout = false` does not suffice: the server can
still return mock mode when Stripe configuration is missing. `lib/stripe.ts`
currently returns simulated intents for placeholder keys. Add this file's mode
handling to S0-04 ownership and its production tests.

Require production configuration to reject missing/placeholder payment credentials
and mock/free-order misclassification. A failed provider load must never enter a
success path. Preserve genuine authorized zero-cost orders as a separate mode.

Also require a test-mode Stripe event to be rejected or isolated from live
Handwrytten submission regardless of the supplier key present. The current webhook
calls the same order processor after signature verification; signature validity
alone does not distinguish a test payment from a paid live transaction. Define the
mode boundary server-side, test `livemode: false` and mixed-key scenarios, and
ensure tests use isolated storage and mocked supplier calls. Do not weaken the
existing signature checks to support mock browser posts. The current webhook
already rejects unsigned events outside an explicit server-controlled test bypass.

**Acceptance:** missing live configuration, unsigned events, test payments, and
client-controlled mode flags cannot cause simulated production purchase or real
supplier dispatch. Genuine paid live and valid comp paths remain distinct.

### R2 — Protect purchase authority and telemetry content at ingestion

**Affected:** S0-02/S0-03; work plan lines 168–169.

Server-generated `purchase_verified` is useful only if the public telemetry route
cannot accept a forged event with that name. Explicitly reject all browser-submitted
purchase/fulfillment-authority events. Derive those outcomes from protected server
state and deduplicate across both webhook and client-confirmation paths.

Replace the metadata denylist with an event-specific allowlist/schema. Unknown,
nested, or renamed fields can bypass a key-name denylist. Constrain attribution
and path/referrer fields too; never retain raw query strings containing names,
messages, addresses, or receipt tokens.

Add explicit ownership for purchase classification in the order model and rollup.
Founder/comp/test flags must be server-authoritative, not trusted from a checkout
payload. Define how eligible sessions are linked to paid orders so numerator and
denominator cover the same date window and cohort.

**Acceptance:** a browser POST cannot increment paid counts; webhook/confirmation
replays count once; arbitrary nested personal metadata is rejected; a forged test
classification cannot change customer counts or payment processing.

### R3 — Implement A2 geometry; do not stop at the audit

**Affected:** S0-07 and S1-04; work plan lines 173 and 189.

S0-07 explicitly leaves `lib/image-optimizer.ts` unchanged, and S1-04 changes the
gallery to 17:22. No task clearly implements the artwork/physical-preview alignment.
Changing a tile's aspect ratio does not correct the uploaded 5:7 artwork or physical
layout.

Add a task with ownership of `lib/image-optimizer.ts`, `components/CardPreview.tsx`,
custom generation output handling, and affected preset derivatives. Apply the
verified folded-front/open-spread geometry and supplier bleed/safe-area rules.
Preserve original artwork; choose crop or regeneration deliberately for each
preset. Validate actual uploaded output against the reviewed preview. No stretch.
Do not claim exact physical text fit based on a 450-character application limit.

Likewise, S0-07 cannot wire a shared message composer into preview and dispatch
without owning their call sites. Assign those files and serialize overlapping work.

**Acceptance:** catalog, preview, and upload use compatible A2 geometry; crop and
safe-area decisions are documented; composed text matches at real integration call
sites, not merely in a standalone helper test.

### R4 — Tighten release gates around real-device checks

**Affected:** G3, G4, S4-06/S4-07; work plan lines 209, 225, 238–244.

It is reasonable to proceed with development while checks are marked not verified.
It is not sufficient for release merely to have a recorded device matrix with no
successful outcomes. Require completed real-phone ordinary journeys, keyboard
checks, card fallback, cancellation preservation, and protected receipt access.
Apple Pay claims require a successful authorization in each context claimed.
Do not require certification of every conceivable device to release a working
fallback, but explicitly record unsupported and untested contexts.

Make simulated success, wrong amount/recipient/content, duplicate payment or
fulfillment, personal-data exposure, and inability to complete the supported
payment path non-waivable launch blockers. Cosmetic issues may be accepted with
an owner and follow-up. No accidental live test transaction is authorized by this
review.

### R5 — Repair task ownership and dependency omissions

**Affected:** S0-03/S0-04/S0-06/S0-07, S2-03/S2-04, S3-02/S3-03/S3-04.

The disjoint-ownership rule is good but the table doesn't fully satisfy it:

- S0-04 requires webhook changes while S0-03 owns that route. Give one task ownership
  and make the other depend on its merged result.
- S0-07 needs preview/dispatch callers that are not assigned, including overlap
  with S0-06's fulfillment files.
- S2-04 modifies the same address component as S2-03 without a merged dependency.
- Checkout revision and guest view-token handling need client orchestrator changes
  in `TargetPurchaseExperience.tsx`; assign them explicitly to S3 work.

Use one integrator for shared checkout/state contracts. Avoid invoking specialized
QA branches that change the same tests concurrently. These are execution fixes,
not reasons for a new product-planning cycle.

## Recommended sequencing for speed

Start checkout failure safety, minimally trustworthy measurement, truthful product
copy, and first-screen/card prototype work now in compatible lanes. UI prototyping
can proceed before the full admin analytics rewrite; live conversion evaluation
must wait for reliable measurement.

Move S3-01 Stripe compatibility research and operator domain/device preparation to
the start. This is low-cost discovery with no production mutation. Do not postpone
it until after the note/address sprint.

Keep supplier answers asynchronous. Neutral cardstock wording and broad delivery
estimates permit implementation to proceed. Actual artwork crop and message fit
remain release concerns; a paper-weight marketing claim is optional.

Require type/build and relevant contract checks for each integrated increment.
Broaden tests at release or when a changed dependency warrants it. Avoid making
routine UI progress depend on repeated full-suite runs and founder approval of
every internal merge. Founder review is most useful for meaningful product
choices, real transactions, and production release.

The Antigravity/Gemini operating model describes that execution environment, not a
product requirement. An executor elsewhere should map roles to available tools
without installing a new orchestration system. The review did not dispatch agents.

## Verdict

The four-step journey, custom path, editor-first note screen, personal return
address, real wallet/card fallback, privacy rules, and reversible candidate rollout
align with the founder's intent. Proceed with implementation after incorporating
R1–R5 into task contracts. Do not wait for another broad redesign proposal.

This is readiness to build, not proof of future conversion uplift. The first
commercial milestone is independent paid customer orders, measured honestly and
fulfilled correctly.
