# Homepage redesign: sprints and progress ledger

**Authority:** [Design specification v2](DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md)

**Execution:** [Deployable builder prompts](DOCKETSTAMP_HOME_BUILDER_PROMPT.md)

**Initial status:** Planning complete; no implementation or verification claimed.

## Execution rules

Assign one sprint per builder session. Each produces a coherent reviewable change. If a sprint proves too large, split it into named sub-sprints here before implementing, preserving dependencies and acceptance gates. Do not expand into unrelated architecture work.

Before each sprint, read AGENTS.md, both canonical product specs, the design spec, and this ledger; inspect source and git status. Preserve pre-existing account/admin/auth/payment changes, including `HeaderUserNav`. Never reset or overwrite unrelated work. Suggested file lists are starting points, not instructions to replace entire files.

After each sprint, record changed files, exact check results, screenshots/evidence, limitations, and next handoff below. Tests do not prove visual quality; screenshots do not prove snapshot/payment correctness. Never mark incomplete criteria passed. No live payments, postal dispatch, deployment, staging unrelated files, or unsolicited commits/PRs.

Default dependency order: **S1 → S2 → S3 → S4 → S5 → S6 → S7**. These sprints intentionally touch shared components sequentially. With multiple agents, assign explicit disjoint ownership and one integration owner. Do not concurrently edit shared workspace/checkout/home components or the ledger. Separate worktrees do not automatically contain uncommitted prerequisites.

## S1 — Correct misleading state and copy

**Goal:** Remove trust-breaking defects before restructuring.

**Dependency:** None.

**Likely files:** `AgentStagedBanner`, `useAgentHydration`, `LivePaperSheet`, `InteractiveHomeWorkbench`; related types/renderers only when necessary.

Deliver:

- Neutral draft/prefill messages; ordinary URL parameters never imply an AI agent. Preserve staged loading/expiration/error handling.
- Verification status tied to evidence for the current address; invalidate on edits and distinguish staging simulation. If no trusted signal exists, show unverified.
- Isolated read-only example state. Samples never overwrite real inputs or enter a purchase.
- Remove implementation jargon and unsupported claims in affected interface copy; preserve statutory prose/disclosures.

Acceptance:

- Ordinary homepage continuation and recipient/tier prefills display no false agent attribution.
- Valid stage still loads; expired/failed stage preserves existing values with retry/fresh-start recovery.
- Blank/edited address is not verified; successful verification applies only to the checked revision; simulated status is distinct.
- Enter a value, open/close example, continue: original value survives and sample values do not.

Evidence: focused provenance, sample-isolation, and verification-invalidation regression checks; screenshots of ordinary prefill and verification states. Run `npm run test:docket` for shared rendering/type changes. Do not change print geometry to solve screen layout.

## S2 — Build the chooser and shared company routing

**Goal:** Deliver reusable selection before homepage composition.

**Dependency:** S1.

**Likely files:** new chooser, display metadata, compatibility/routing helper, `app/companies/page.tsx`, directory component; registries read-only.

Deliver:

- One accessible searchable list for all nine letters with plain display titles, curated aliases, explicit selected state, and Continue.
- No initial real letter/state/company/tier and no personal fields.
- Shared compatibility resolver; ambiguous company selections ask purpose. Manual recipients remain possible where supported.
- Searchable `/companies` using the resolver and existing registry; no new verification claims or preview-above loop.

Acceptance:

- Every choice preserves its canonical slug and reaches the existing workspace.
- Search `deposit return`, `Equifax`, and `Sonos`; selection produces the correct supported context.
- Sonos does not silently select refund; existing supported opt-out/deletion purposes remain available.
- Incompatible letter change visibly clears the company. No-match state recovers to all letters/manual entry.
- Restricted entity cannot Continue and remains server-blocked; permitted hardware remains allowed.
- Keyboard selection, labels, focus, and result announcements work.

Evidence: focused resolver/URL tests including nine slugs, ambiguous and incompatible cases; browser/keyboard walkthrough. Avoid tests that merely mirror static markup.

## S3 — Compose the focused homepage

**Goal:** Replace the overlapping homepage with the completed chooser and supporting copy.

**Dependencies:** S1–S2.

**Likely files:** `app/page.tsx`, homepage workbench refactor/replacement, `HeaderDocketLookup`, `HeaderUserNav` integration, preview and supporting sections.

Deliver:

- Spec hero, one chooser, balanced shared-renderer preview, expandable mobile preview.
- Compact closed-by-default tracking utility and optional account controls.
- Remove home personal fields, popular chips, separate tabs/dropdown, duplicate catalog, company-card grid, and interactive tier selection.
- One process strip, informational pricing from registry, verified FAQ, policies, exact footer disclosures, and clean metadata/accessibility copy.
- Preserve useful old hash anchors; migrate homepage WebMCP/navigation callers before removing dead state/events. Do not break REST/MCP/WebMCP contracts.

Acceptance:

- At 1280 × 720: explanation, selection affordance, price cue, and selected-state Continue are visible without scrolling the document.
- At 390 × 844: initial selection/continuation area is reachable without a full paper preceding it.
- At 320, 390, 768, and 1280 px: no page overflow/clipped utilities; account loading, signed-out, and signed-in states fit.
- Home has one discovery surface and informational pricing only; directory, policies, tracking, and optional auth work.
- Required disclosures remain verbatim; no unsupported 60-second or outcome claims.

Evidence: screenshots at required widths, menu/preview/keyboard checks, and `npm run build` where configured environment permits. Report actual environment blockers without claiming a successful build.

## S4 — Make details and review continuous

**Goal:** Organize the existing editor with reliable progress and draft state.

**Dependencies:** S1–S3.

**Likely files:** `DocumentWorkspace`, `GuidedFieldDrawer`, `StickyExecutionBar`, hydration, draft recovery helper, preview interactions.

Deliver:

- Understandable Details → Review and sign → Delivery/payment progression using current drawer/modal boundaries.
- Plain labels, real validation, honest progress including sender/recipient addresses, and first-invalid-field focus.
- Preserve values across stages/preview/retries/back. Add session-scoped recovery only if existing resume does not cover it; explicit reset and no cross-account exposure.
- New explicit prefill takes precedence over unrelated recovered data; hydration never overwrites subsequent edits.
- Draft revisions invalidate signatures after material changes and invalidate verification after address changes.

Acceptance:

- Landlord/manual, bureau/pre-addressed, hardware/purpose, partial stage, and complete stage journeys avoid duplicate entry.
- Empty/invalid addresses/dates/selections cannot count as ready; signature-only state focuses signature controls.
- Preview-token clicks reveal/focus the corresponding input on mobile.
- Back/next/preview/retry/recovery retain intended data; new prefill is not replaced by stale recovery.
- Editing signed content requests re-review/reconfirmation. Exact affirmation/disclosures remain.

Evidence: meaningful state/validation/hydration regression checks, desktop/mobile browser walkthrough, `npm run test:docket`. Do not rewrite letter prose or permanently store sensitive drafts.

## S5 — Clarify delivery and payment

**Goal:** Make final actions accurate while preserving the commerce spine.

**Dependency:** S4.

**Likely files:** `CheckoutModal`, order/payment UI, workspace checkout integration; lock endpoint only for a demonstrated necessary fix.

Deliver:

- One labeled tier selector, existing prices, optional recommendation, accurate benefits, notification email, total, and mandatory disclosures.
- `Continue to payment — $X` for initialization; payment-confirming copy only on the actual confirming control.
- Accessible dialog labels/focus/Escape/return and errors that preserve input.
- Back/cancel/failure recovery retains intended draft/tier; guest and signed-in ownership/token safeguards remain.
- Fresh safe lock/payment attempt for changed content/tier; immutable paid snapshots and idempotent fulfillment.
- Distinguish payment received, mailing submission, and postal status. Do not invent immediate PDFs/signatures or delivery.

Acceptance:

- All three tiers agree across selector, summary, payment-intent amount, and snapshot metadata for the attempt.
- Edits after initialization cannot charge/dispatch stale content or obsolete tier; paid snapshots stay immutable.
- Mock failed initialization/payment/cancel/retry retains data without duplicate dispatch.
- Guest and signed-in checkout work without a forced account gate; current ownership/access checks remain.

Evidence: targeted mocked integration checks; `npm run test:security`, `npm run test:payment-mode`, `npm run test:docket`, and `npm run test:admin-auth` for ownership/auth integration changes. Test/sandbox Stripe and staging/mock Lob only. Record which actual end-to-end paths were exercised.

## S6 — Instrument outcomes and reporting

**Goal:** Measure the funnel without collecting letter contents.

**Dependencies:** S3–S5.

**Likely files:** `lib/types.ts`, `lib/telemetry.ts`, `lib/telemetry-schema.ts`, ingestion, UI triggers, existing server purchase events.

Deliver:

- Measurement note with event, exact trigger, emitter, safe metadata, dedupe rule, and meaning. Document mapping to existing equivalent events.
- Home view, letter selection, workspace start, details/review completion, checkout initialization, payment view, and authoritative purchase correlation.
- Experience version and entry-source propagation, without raw query strings or confirmed-agent claims from ordinary prefills.
- Reproducible query/report recipe against current storage for verified paid orders/homepage session and stage drop-off by device/source; define exclusions and attribution gaps.

Acceptance:

- Back/forward/rerenders do not inflate counts; define dedupe by session/draft revision/order as appropriate.
- Client confirmation-page views cannot emit purchase/payment/fulfillment authority events.
- Example payloads pass sanitization; personal data, search text, stage tokens, secrets, raw URLs/errors are absent.
- Synthetic session correlates with one mocked authoritative paid order; unknown attribution stays explicit.

Evidence: `npm run test:telemetry`, relevant current ingestion/privacy tests using their actual runners, and focused schema/dedupe checks. No new analytics vendor or wholesale admin dashboard rewrite.

## S7 — Integrated release-candidate review

**Goal:** Deliver a verified candidate, not a production launch.

**Dependencies:** S1–S6 complete.

**Scope:** evidence and necessary scoped fixes only.

Deliver an evidence report under `docs/evidence/home-redesign/` with screenshots, route/device matrix, exact checks, known limitations, and design-gate traceability. Audit visible copy, metadata, labels, loading/empty/error states, and confirmation. Remove unused home-only code after consumer checks. Record baseline measurement availability and rollback by integrated change set; do not invent baseline data or add an untested runtime flag.

| Area | Required coverage |
| --- | --- |
| Responsive | 320/390/768/1280 px; selected/unselected hero, utilities, preview, keyboard open |
| Accessibility | Keyboard-only chooser/menu/dialog/stages, focus/errors, zoom, reduced motion |
| Discovery | Nine letters, ambiguous hardware purpose, manual recipient, no results, restricted entity |
| Entrypoints | Home, directory, direct notice, recipient/tier/field/focus prefill, valid/expired stage |
| State | Sample, edit, preview, back/next, recovery, invalid field, re-sign, re-verification |
| Commerce | Three tiers, guest/signed-in, failed initialization/payment, cancel/retry, snapshot/idempotency |
| Documents | Shared interpolation; one-page output and clear zones for affected renderer paths |
| Measurement | Synthetic attributed purchase, duplicate prevention, privacy sanitization |

Run `npm run build`, `npx tsc --noEmit`, current `npm test`, and targeted telemetry tests separately (the umbrella suite may omit them). Inspect current scripts first. The current lint command uses `next lint`; if unsupported by installed Next, report it rather than silently claiming lint passed or changing unrelated tooling. Missing secrets/services mean unverified integration checks, not passed checks. Re-run only checks affected by final fixes.

Acceptance: all design requirements have evidence, with no outstanding critical purchase, invariant, privacy, accessibility, or routing defect. Record unresolved gaps and leave corresponding gates incomplete. No deployment, live payment, postage, or claimed measured uplift.

## Progress ledger

| Sprint | Status | Implementation / evidence | Checks / limitations | Next handoff |
| --- | --- | --- | --- | --- |
| S1 | Complete | `AgentStagedBanner.tsx`, `useAgentHydration.ts`, `LivePaperSheet.tsx`, `InteractiveHomeWorkbench.tsx`, `DocumentWorkspace.tsx`, `types.ts`, `tests/s1-trust-and-state.test.ts` | `tests/s1-trust-and-state.test.ts` (9/9), `npm run test:docket` (23/23), `wp2/wp3` (14/14), `admin-account-binding` (22/22). Independent review: PASS. Responsive browser screenshots scheduled in S3. | S2 — Build the chooser and shared company routing |
| S2 | Complete | `chooser-routing.ts`, `HomeLetterChooser.tsx`, `CompanyDirectoryClient.tsx`, `app/companies/page.tsx`, `tests/s2-chooser-and-routing.test.ts` | `tests/s2-chooser-and-routing.test.ts` (23/23), `npm run test:docket` (23/23), `tests/s1-trust-and-state.test.ts` (9/9), `npm run build` (exit 0). Independent review: PASS (after fixing §7.4 display titles, fitness-block on Continue, and no-match copy). | S3 — Compose the focused homepage |
| S3 | Complete | `app/page.tsx`, `InteractiveHomeWorkbench.tsx`, `HeaderDocketLookup.tsx`, `HomeLetterChooser.tsx`, `app/layout.tsx`, `tailwind.config.ts`, `tests/s3-homepage-composition.test.ts`, `docs/evidence/home-redesign/s3/*.png` | `tests/s3-homepage-composition.test.ts` (23/23), `npm run test:docket` (23/23), `npm run build` (exit 0), 7 responsive screenshots verified (320, 390x844, 768, 1280x720). Independent review: PASS (after adding `./src/**/*` to `tailwind.config.ts` and regenerating screenshots). | S4 — Make details and review continuous |
| S4 | Complete | `draft-recovery.ts`, `useAgentHydration.ts`, `DocumentWorkspace.tsx`, `GuidedFieldDrawer.tsx`, `StickyExecutionBar.tsx`, `tests/s4-details-and-review.test.ts`, `docs/evidence/home-redesign/s4/*.png` | `tests/s4-details-and-review.test.ts` (20/20), `npm run test:docket` (23/23), `s1–s3` (55/55), 8 desktop/mobile workspace screenshots verified. Independent review: PASS (after fixing native input setter in `verify-s4-visual.mjs` and regenerating screenshots 03 & 04). | S5 — Clarify delivery and payment |
| S5 | Complete | `CheckoutModal.tsx`, `DocumentWorkspace.tsx`, `app/api/docket/lock-and-intent/route.ts`, `app/docket/[docketId]/page.tsx`, `lib/firebase-admin.ts`, `tests/s5-delivery-and-payment.test.ts`, `docs/evidence/home-redesign/s5/*.png` | `tests/s5-delivery-and-payment.test.ts` (18/18), `test:security` (10/10), `test:payment-mode` (26/26), `test:docket` (23/23), `test:admin-auth` (22/22), `npm run build` (exit 0), 7 checkout screenshots verified. Independent review: PASS (after adding fail-closed production guard on `USE_MOCK_FIRESTORE` and Step 1 viewport spacing polish). | S6 — Instrument outcomes and reporting |
| S6 | Complete | `lib/types.ts`, `lib/telemetry-schema.ts`, `lib/telemetry.ts`, `lib/telemetry-reporting.ts`, `app/api/telemetry/route.ts`, `app/api/docket/lock-and-intent/route.ts`, `lib/order-processor.ts`, UI triggers, `docs/evidence/home-redesign/s6-measurement-and-reporting.md`, `tests/s6-funnel-and-reporting.test.ts` | `tests/s6-funnel-and-reporting.test.ts` (20/20), `npm run test:telemetry` (5/5), `tests/telemetry-ingestion.test.ts` (36/36), `npm run build` (exit 0). Independent review: PASS. | S7 — Integrated release-candidate review |
| S7 | Complete | `docs/evidence/home-redesign/RELEASE_CANDIDATE_REPORT.md`, `tests/s7-release-candidate.test.ts`, `scripts/verify-s7-e2e.mjs`, `docs/evidence/home-redesign/s7/*.png`, dead-code removal (`NoticeCatalogBrowser.tsx`) | `tests/s1*.ts..s7*.ts` (151/151), `npm test` (100% pass), `npm run test:telemetry` (5/5), `telemetry-ingestion` (36/36), `npm run build` (exit 0), `npx tsc --noEmit` (0 errors in `app/`, `src/`, `components/`, `lib/`, and `tests/s1..s7`). Independent review: PASS. | Release-candidate ready |

### Handoff entry template

```text
Sprint / status:
Starting revision and pre-existing changes:
Files changed for this assignment:
Acceptance criteria satisfied, with evidence paths:
Exact checks and results:
Unverified paths / blockers / remaining defects:
Compatibility and invariant review:
Next sprint and integration notes:
```

### S1 Handoff Log

```text
Sprint / status: S1 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac with preserved uncommitted changes in account/admin/auth/checkout/HeaderUserNav
Files changed for this assignment:
  - src/components/docket/AgentStagedBanner.tsx
  - src/hooks/useAgentHydration.ts
  - src/lib/docket/types.ts
  - src/components/docket/LivePaperSheet.tsx
  - src/components/docket/InteractiveHomeWorkbench.tsx
  - src/components/docket/DocumentWorkspace.tsx
  - tests/s1-trust-and-state.test.ts
Acceptance criteria satisfied, with evidence paths:
  - AC1 (Neutral prefill/draft attribution): AgentStagedBanner.tsx & useAgentHydration.ts; verified in tests/s1-trust-and-state.test.ts
  - AC2 (Stage load + error retry/start-fresh recovery preserving values): useAgentHydration.ts & DocumentWorkspace.tsx; verified in tests/s1-trust-and-state.test.ts
  - AC3 (Truthful address verification status + invalidation on edit + distinct staging simulated label): LivePaperSheet.tsx & DocumentWorkspace.tsx; verified in tests/s1-trust-and-state.test.ts
  - AC4 (Sample preview state isolated from real userValues and excluded from continuation URLs): InteractiveHomeWorkbench.tsx; verified in tests/s1-trust-and-state.test.ts
Exact checks and results:
  - npx tsx --test tests/s1-trust-and-state.test.ts -> 9 passed, 0 failed
  - npm run test:docket -> 23 passed, 0 failed
  - npx tsx --test tests/wp2-verification.test.ts tests/wp3-verification.test.ts -> 14 passed, 0 failed
  - npx tsx --test tests/admin-account-binding.test.ts -> 22 passed, 0 failed
Unverified paths / blockers / remaining defects:
  - Responsive visual screenshots across 320/390/768/1280px are scheduled in S3 once the new chooser and homepage layout are composed.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer (NAICS 713940 blocker with hardware OEM allowance, UPL disclosures verbatim, 8.5x11 geometry, shared interpolateNotice, freeze-before-pay, Lob key separation).
Next sprint and integration notes:
  - Proceed to S2 (Build the chooser and shared company routing).
```

### S2 Handoff Log

```text
Sprint / status: S2 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1 changes + preserved uncommitted work
Files changed for this assignment:
  - src/lib/docket/chooser-routing.ts (new)
  - src/components/docket/HomeLetterChooser.tsx (new)
  - src/components/docket/CompanyDirectoryClient.tsx (new)
  - app/companies/page.tsx (new)
  - tests/s2-chooser-and-routing.test.ts (new)
Acceptance criteria satisfied, with evidence paths:
  - AC1 (All 9 canonical slugs + exact §7.4 plain display titles reach existing workspace): src/lib/docket/chooser-routing.ts, tests/s2-chooser-and-routing.test.ts
  - AC2 (Search 'deposit return', 'Equifax', and 'Sonos' produces right supported context): src/lib/docket/chooser-routing.ts, tests/s2-chooser-and-routing.test.ts
  - AC3 (Sonos and all 8 tech_hardware_legal companies ask purpose and never silently default to refund): src/lib/docket/chooser-routing.ts, src/components/docket/HomeLetterChooser.tsx, src/components/docket/CompanyDirectoryClient.tsx
  - AC4 (Incompatible letter change visibly clears company; no-match state recovers to all 9 letters / manual entry): src/lib/docket/chooser-routing.ts, src/components/docket/HomeLetterChooser.tsx
  - AC5 (Restricted NAICS 713940 entity blocks Continue even if letter previously selected; hardware OEMs allowed): src/components/docket/HomeLetterChooser.tsx, tests/s2-chooser-and-routing.test.ts
  - AC6 (Accessible listbox keyboard navigation, labels, focus, and aria-live announcements): src/components/docket/HomeLetterChooser.tsx
Exact checks and results:
  - npx tsx --test tests/s2-chooser-and-routing.test.ts -> 23 passed, 0 failed
  - npm run test:docket -> 23 passed, 0 failed
  - npx tsx --test tests/s1-trust-and-state.test.ts -> 9 passed, 0 failed
  - npm run build -> exit code 0 (/companies and /notices/[slug] statically generated)
Unverified paths / blockers / remaining defects:
  - Homepage integration and responsive viewport screenshots at 320/390/768/1280px are scheduled in S3.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer. Registries (notices/index.ts and verified-recipients.ts) kept read-only.
Next sprint and integration notes:
  - Proceed to S3 (Compose the focused homepage using HomeLetterChooser and balanced LivePaperSheet preview).
```

### S3 Handoff Log

```text
Sprint / status: S3 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1–S2 changes + preserved uncommitted work
Files changed for this assignment:
  - app/page.tsx
  - src/components/docket/InteractiveHomeWorkbench.tsx
  - src/components/docket/HeaderDocketLookup.tsx
  - src/components/docket/HomeLetterChooser.tsx
  - app/layout.tsx
  - tailwind.config.ts
  - tests/s3-homepage-composition.test.ts (new)
  - scripts/verify-s3-visual.mjs (new)
  - docs/evidence/home-redesign/s3/ (7 PNG screenshots)
Acceptance criteria satisfied, with evidence paths:
  - AC1 (1280x720 desktop gate: explanation, selection affordance, price cue, Continue, and balanced LivePaperSheet preview visible without scrolling): docs/evidence/home-redesign/s3/homepage-1280x720-unselected.png, docs/evidence/home-redesign/s3/homepage-1280x720-selected.png
  - AC2 (390x844 mobile gate: selection/Continue precede paper preview; expandable mobile preview renders cleanly): docs/evidence/home-redesign/s3/homepage-390x844-initial.png, docs/evidence/home-redesign/s3/homepage-390x844-preview-expanded.png
  - AC3 (320, 390, 768, 1280px zero overflow; closed-by-default Track a letter popover + HeaderUserNav fit cleanly): docs/evidence/home-redesign/s3/homepage-320x640-header-closed.png, docs/evidence/home-redesign/s3/homepage-320x640-tracking-open.png, docs/evidence/home-redesign/s3/homepage-768x1024.png
  - AC4 (One discovery surface on home, informational pricing from DOCKET_PRICING_TIERS, 3-step process strip, verified FAQ, /companies link): app/page.tsx, tests/s3-homepage-composition.test.ts
  - AC5 (Verbatim disclosures preserved, unsupported 60s/outcome claims removed): app/page.tsx, app/layout.tsx, tests/s3-homepage-composition.test.ts
Exact checks and results:
  - npx tsx --test tests/s3-homepage-composition.test.ts -> 23 passed, 0 failed
  - npx tsx --test tests/s1-trust-and-state.test.ts tests/s2-chooser-and-routing.test.ts -> 32 passed, 0 failed
  - npm run test:docket -> 23 passed, 0 failed
  - npm run build -> exit code 0 (with ./src/**/* included in tailwind.config.ts)
  - node scripts/verify-s3-visual.mjs -> all 7 viewport/overflow/visibility gates passed
Unverified paths / blockers / remaining defects:
  - None for S3. Workspace details/review continuity and ?focus=fieldKey scrolling in DocumentWorkspace are scheduled in S4.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer. WebMCP declarative form preserved on chooser Continue form.
Next sprint and integration notes:
  - Proceed to S4 (Make details and review continuous in DocumentWorkspace, GuidedFieldDrawer, StickyExecutionBar, and useAgentHydration).
```

### S4 Handoff Log

```text
Sprint / status: S4 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1–S3 changes + preserved uncommitted work
Files changed for this assignment:
  - src/lib/docket/draft-recovery.ts (new)
  - src/hooks/useAgentHydration.ts
  - src/components/docket/DocumentWorkspace.tsx
  - src/components/docket/GuidedFieldDrawer.tsx
  - src/components/docket/StickyExecutionBar.tsx
  - src/lib/docket/chooser-routing.ts
  - tests/s4-details-and-review.test.ts (new)
  - scripts/verify-s4-visual.mjs (new)
  - docs/evidence/home-redesign/s4/ (8 PNG screenshots)
Acceptance criteria satisfied, with evidence paths:
  - AC1 (Landlord/manual, bureau/pre-addressed, hardware/purpose, partial/complete stage journeys avoid duplicate entry): src/lib/docket/draft-recovery.ts, src/components/docket/GuidedFieldDrawer.tsx, tests/s4-details-and-review.test.ts, docs/evidence/home-redesign/s4/07-desktop-bureau-prefilled-details.png
  - AC2 (Empty/invalid addresses, dates, selections cannot count as ready; signature-only state focuses signature controls): src/lib/docket/draft-recovery.ts, src/components/docket/DocumentWorkspace.tsx, tests/s4-details-and-review.test.ts, docs/evidence/home-redesign/s4/02-desktop-deposit-validation-errors.png
  - AC3 (Preview-token clicks reveal/focus corresponding input on mobile & desktop): src/components/docket/DocumentWorkspace.tsx, src/components/docket/GuidedFieldDrawer.tsx, tests/s4-details-and-review.test.ts
  - AC4 (Session recovery retains intended data; explicit URL prefill overrides stale recovery; hydration never overwrites user edits; Reset draft control): src/lib/docket/draft-recovery.ts, src/hooks/useAgentHydration.ts, tests/s4-details-and-review.test.ts
  - AC5 (Editing signed content invalidates signature and requests re-confirmation; exact affirmation/disclosures remain): src/components/docket/DocumentWorkspace.tsx, src/components/docket/GuidedFieldDrawer.tsx, docs/evidence/home-redesign/s4/03-desktop-deposit-signature-adopted.png, docs/evidence/home-redesign/s4/04-desktop-deposit-signature-invalidated.png
Exact checks and results:
  - npx tsx --test tests/s4-details-and-review.test.ts -> 20 passed, 0 failed
  - npm run test:docket -> 23 passed, 0 failed
  - npx tsx --test tests/s1-trust-and-state.test.ts tests/s2-chooser-and-routing.test.ts tests/s3-homepage-composition.test.ts -> 55 passed, 0 failed
  - node scripts/verify-s4-visual.mjs -> 8 screenshots captured and verified
Unverified paths / blockers / remaining defects:
  - None for S4. Delivery tier selection and payment intent execution are owned by Sprint S5.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer.
Next sprint and integration notes:
  - Proceed to S5 (Clarify delivery and payment in CheckoutModal.tsx and workspace checkout integration).
```

### S5 Handoff Log

```text
Sprint / status: S5 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1–S4 changes + preserved uncommitted work
Files changed for this assignment:
  - src/components/docket/CheckoutModal.tsx
  - src/components/docket/DocumentWorkspace.tsx
  - app/api/docket/lock-and-intent/route.ts
  - app/docket/[docketId]/page.tsx
  - lib/firebase-admin.ts
  - tests/s5-delivery-and-payment.test.ts (new)
  - scripts/verify-s5-visual.mjs (new)
  - docs/evidence/home-redesign/s5/ (7 PNG screenshots)
Acceptance criteria satisfied, with evidence paths:
  - AC1 (All 3 tiers agree across selector, summary, payment-intent amount, and snapshot metadata; Continue to payment — $X vs Pay $X and send letter): src/components/docket/CheckoutModal.tsx, app/api/docket/lock-and-intent/route.ts, tests/s5-delivery-and-payment.test.ts, docs/evidence/home-redesign/s5/01-desktop-checkout-step1-tier-selector.png
  - AC2 (Edits or tier changes after initialization invalidate prior lock/attempt and create fresh lock; paid snapshots immutable): src/components/docket/CheckoutModal.tsx, tests/s5-delivery-and-payment.test.ts
  - AC3 (Mock failed initialization/payment/cancel/retry retains data without duplicate dispatch; accessible dialog role, Escape, focus return): src/components/docket/CheckoutModal.tsx, tests/s5-delivery-and-payment.test.ts, docs/evidence/home-redesign/s5/03-desktop-checkout-error-preservation.png
  - AC4 (Guest and signed-in checkout work without forced account gate; ownership/access checks and fail-closed production guards preserved): src/components/docket/CheckoutModal.tsx, app/api/docket/lock-and-intent/route.ts, lib/firebase-admin.ts, tests/s5-delivery-and-payment.test.ts
  - AC5 (Truthful post-payment status distinction across Payment Received, Submitted for Mailing, and Postal Tracking): src/components/docket/CheckoutModal.tsx, app/docket/[docketId]/page.tsx, docs/evidence/home-redesign/s5/05-desktop-checkout-step3-truthful-confirmation.png
Exact checks and results:
  - npx tsx --test tests/s5-delivery-and-payment.test.ts -> 18 passed, 0 failed
  - npm run test:security -> 10 passed, 0 failed
  - npm run test:payment-mode -> 26 passed, 0 failed
  - npm run test:docket -> 23 passed, 0 failed
  - npm run test:admin-auth -> 22 passed, 0 failed
  - npm run test:go-live -> all passed
  - node scripts/verify-s5-visual.mjs -> 7 screenshots captured and verified
Unverified paths / blockers / remaining defects:
  - Executed against test/mock Stripe and staging/mock Lob per safety boundaries; live card charges and physical postage intentionally not executed.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer.
Next sprint and integration notes:
  - Proceed to S6 (Instrument outcomes and reporting without collecting letter contents).
```

### S6 Handoff Log

```text
Sprint / status: S6 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1–S5 changes + preserved uncommitted work
Files changed for this assignment:
  - lib/types.ts
  - lib/telemetry-schema.ts
  - lib/telemetry.ts
  - lib/telemetry-reporting.ts (new)
  - app/api/telemetry/route.ts
  - app/api/docket/lock-and-intent/route.ts
  - lib/order-processor.ts
  - src/components/docket/InteractiveHomeWorkbench.tsx
  - src/components/docket/HomeLetterChooser.tsx
  - src/components/docket/DocumentWorkspace.tsx
  - src/components/docket/CheckoutModal.tsx
  - docs/evidence/home-redesign/s6-measurement-and-reporting.md (new)
  - tests/s6-funnel-and-reporting.test.ts (new)
Acceptance criteria satisfied, with evidence paths:
  - AC1 (Back/forward/rerenders do not inflate counts; dedupe by session/draft revision/order): lib/telemetry.ts, lib/telemetry-reporting.ts, tests/s6-funnel-and-reporting.test.ts
  - AC2 (Client confirmation-page views cannot emit purchase/payment/fulfillment authority events; HTTP 403 on browser POST): lib/telemetry-schema.ts, app/api/telemetry/route.ts, tests/s6-funnel-and-reporting.test.ts
  - AC3 (Example payloads pass sanitization; personal data, search text, stage tokens, secrets, and raw URLs/errors absent): lib/telemetry-schema.ts, tests/s6-funnel-and-reporting.test.ts
  - AC4 (Synthetic session correlates with one mocked authoritative paid order; unknown attribution explicit; measurement note & reporting recipe): lib/telemetry-reporting.ts, docs/evidence/home-redesign/s6-measurement-and-reporting.md, tests/s6-funnel-and-reporting.test.ts
Exact checks and results:
  - npx tsx --test tests/s6-funnel-and-reporting.test.ts -> 20 passed, 0 failed
  - npm run test:telemetry -> 5 passed, 0 failed
  - npx tsx tests/telemetry-ingestion.test.ts -> 36 passed, 0 failed
  - npm run build -> exit code 0
Unverified paths / blockers / remaining defects:
  - Historical pre-v2 baseline conversion rate depends on live production traffic; reporting recipe explicitly separates experienceVersion: 'home_v2' and unattributed/unknown orders without fabricating uplift.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer.
Next sprint and integration notes:
  - Proceed to S7 (Integrated release-candidate review and evidence package under docs/evidence/home-redesign/).
```

### S7 Handoff Log

```text
Sprint / status: S7 — Complete (Independent Review: PASS)
Starting revision and pre-existing changes: main @ a3821ac + S1–S6 changes + preserved uncommitted work
Files changed for this assignment:
  - docs/evidence/home-redesign/RELEASE_CANDIDATE_REPORT.md (new)
  - tests/s7-release-candidate.test.ts (new)
  - scripts/verify-s7-e2e.mjs (new)
  - docs/evidence/home-redesign/s7/ (7 PNG screenshots)
  - src/components/docket/NoticeCatalogBrowser.tsx (removed unused home-only component)
Acceptance criteria satisfied, with evidence paths:
  - Responsive (320/390/768/1280 px across /, /companies, /notices/[slug], /docket/[id]): docs/evidence/home-redesign/s3/, s4/, s5/, s7/, tests/s7-release-candidate.test.ts
  - Accessibility (keyboard-only chooser, tracking popover, checkout dialog, focus/errors, zoom/reduced-motion): tests/s7-release-candidate.test.ts
  - Discovery (all 9 letters, Sonos hardware purpose disambiguation, manual recipient, no results recovery, restricted fitness entity block): docs/evidence/home-redesign/s7/, tests/s7-release-candidate.test.ts
  - Entrypoints (home, /companies, direct notice, recipient/tier/field/focus prefill, valid/expired stage): docs/evidence/home-redesign/s7/07-direct-notice-workspace-prefilled-1280x720.png, tests/s7-release-candidate.test.ts
  - State (sample isolation, edit, preview, back/next, session recovery, invalid field, re-sign, re-verification): docs/evidence/home-redesign/s4/, tests/s7-release-candidate.test.ts
  - Commerce (3 tiers, guest/signed-in, failed init/payment, cancel/retry, immutable snapshot, idempotent fulfillment): docs/evidence/home-redesign/s5/, tests/s7-release-candidate.test.ts
  - Documents (shared interpolateNotice, 8.5x11 single-page geometry, USPS/Lob clear zones across all 9 cartridges): tests/s7-release-candidate.test.ts
  - Measurement (synthetic attributed purchase, duplicate prevention, privacy sanitization, client authority immunity): docs/evidence/home-redesign/s6-measurement-and-reporting.md, tests/s7-release-candidate.test.ts
Exact checks and results:
  - npx tsx --test tests/s1*.ts tests/s2*.ts tests/s3*.ts tests/s4*.ts tests/s5*.ts tests/s6*.ts tests/s7*.ts -> 151 passed, 0 failed (54 suites)
  - npm test -> all suites passed (test:security 10/10, test:payment-mode 26/26, test:docket 23/23, test:stripe-bootstrap 11/11, test:admin-auth 22/22, test:go-live passed)
  - npm run test:telemetry -> 5 passed, 0 failed
  - npx tsx tests/telemetry-ingestion.test.ts -> 36 passed, 0 failed
  - npm run build -> exit code 0 (59/59 routes compiled)
  - npx tsc --noEmit -> 0 errors across app/, src/, components/, lib/, and tests/s1*.ts..s7*.ts (legacy SendMyNotes test files in tests/ retain pre-existing missing module warnings as documented)
  - npm run lint -> invokes deprecated `next lint` interactive prompt in Next 15.5.x; reported honestly without modifying unrelated project tooling
Unverified paths / blockers / remaining defects:
  - Live Stripe card charges and live Lob physical postage were intentionally not executed per safety boundaries; verified against test/mock Stripe and staging/mock Lob.
  - Real-traffic conversion uplift will be measured post-release using the S6 reporting recipe without claiming unmeasured conversion gains.
Compatibility and invariant review:
  - All 6 system invariants verified PASS by independent reviewer across all 7 sprints.
Next sprint and integration notes:
  - All 7 sprints (S1–S7) complete and independently reviewed. Release candidate ready for user review.
```
