# SPRINT-0013 — Letter library and cancellation starting points

**Status:** Complete — implemented by Luna and verified locally; not deployed  
**Run:** `2026-10-21-letter-library`  
**Source revision:** `4c6eeb8eafcfa1757e9a3175199695e6cb893eb3`, including pre-existing local work recorded in the run baseline.  
**Owner:** Codex coordinator; user-requested GPT-6 Luna executor.  
**Chapter:** None assigned.

## Pyramid index

1. Objective and authorization
2. Scope and product behavior
3. Acceptance criteria
4. Ordered implementation and dependencies
5. Verification and evidence
6. Risks, decisions, and provenance
7. Execution record

## 1. Objective and authorization

Make existing supported letters easier to browse and start through a dedicated `/letters` library, with six specific cancellation entry points that prefill the current service category. The user requested a sprint and Luna execution for low-hanging opportunities that need no additional substantive review.

The founder's click-to-cancel principle is administrative convenience: the customer fills out the form, reviews/adopts the letter, and pays; DocketStamp prepares and mails it. See the [opportunity review](../DOCKETSTAMP_PRODUCT_OPPORTUNITIES_2026-10-21.md). The scan has not cleared a new statutory or company-specific procedure for immediate launch. This sprint exposes existing supported uses without adding new legal effects, procedures, recipients, or template prose. It does not characterize existing governance defaults as legal approval.

Read [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md), [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md), and repository instructions. Preserve all six invariants and SPRINT-0012 policy enforcement.

## 2. Scope and product behavior

- A public `/letters` page with metadata, a concise explanation of the prepare/review/pay/mail workflow, existing letter choices, and a group of cancellation starting points.
- Reuse existing chooser titles/subtitles for general letters. The cancellation group derives its exact values from the existing cancellation template's `serviceTypeLabel` field: home security/monitoring, residential pest/lawn, home warranty, telecom/satellite, automobile/property insurance, and commercial/residential service subscription.
- A cancellation starting point links to `/notices/service-cancellation-request?field.serviceTypeLabel=<encoded existing value>`. It remains the same underlying letter and editable field. The URL selects no company, location, personal information, signature, date, or mailing tier.
- Use current public availability through `useTemplateAvailability`. Render actionable letters only when their canonical slug appears with `available === true`. While loading, on fetch/parse failure, or with no available entries, show an appropriate state and retry where useful. All six cancellation links disappear with their underlying template. Explicit residence/property checks remain in the workspace.
- Add access from the homepage that is visible on mobile and desktop, plus a library sitemap entry. Keep the existing homepage chooser and legacy anchors intact. Do not add a second homepage catalog.
- Preserve mandatory statutory and UPL disclosures on the new page. Group the cancellation variants honestly as starting points for an existing letter, without inflating the number of templates or suggesting new review/verification.

### Non-goals

No new notice cartridges, changed body/re-line/header prose, schemas, aliases, recipients, statutes, opt-out elections, bank-debit instructions, bundles, signature methods, enclosures, checkout behavior, pricing, review metadata, live policy writes, deployments, or postal purchases. No redesign of the existing chooser, hydration, or workspace. Preserve the historical `buildChooserWorkspaceUrl` contract by keeping preset URL construction separate.

## 3. Acceptance criteria

| ID | Required outcome |
| --- | --- |
| AC1 | `/letters` provides a browsable, responsive library of existing available letters with clear navigation and the mandatory disclosures. |
| AC2 | Six cancellation starting points derive from the existing field options; each URL hydrates the matching valid enum value in the current editable cancellation workspace. |
| AC3 | Preset URLs contain only `field.serviceTypeLabel`; no personal values, recipient, residence/property state, signature, dates, or service tier are inferred. Unknown presets do not produce actionable URLs. |
| AC4 | Missing, unavailable, paused, or held templates are excluded from discovery. Loading, availability errors, and global unavailability expose no actionable letter-start links. Retry recovers after a simulated failure. |
| AC5 | A library entry requiring location still reaches the existing location gate; direct routes and server enforcement remain unchanged. |
| AC6 | Home access is visible at desktop and mobile widths; keyboard focus, link labeling, and horizontal layout are usable. Existing homepage chooser behavior and anchors remain intact. |
| AC7 | All nine notice definitions, registry, policy implementation, recipients, guardrails, renderer, and existing hydration/workspace files remain unchanged. Cancellation variants are not presented as six additional templates. |
| AC8 | Focused tests, TypeScript, local browser verification, and protected-file/ledger preservation checks pass with recorded evidence. No external payment, dispatch, or deployment occurs. |

## 4. Ordered implementation and dependencies

1. **Coordinator — capture baseline and plan.** Record HEAD, pre-existing changed files, protected source hashes, and existing ledger entries. Read Luna's critique, synthesize this plan, reserve SPRINT-0013 once, then mark active immediately before implementation.
2. **Luna — catalog helpers.** Add `src/lib/docket/letter-library.ts` for the existing-template catalog, exact enum-derived cancellation entries, allowlisted URL builder, and pure availability filtering. Dependency: step 1. Do not modify the notice definitions.
3. **Luna — library UI and discovery links.** Add `src/components/docket/LetterLibraryClient.tsx` and `app/letters/page.tsx`; integrate the availability hook, states/retry, grouping, disclosures, and responsive design. Make small changes to `app/page.tsx` and `app/sitemap.ts` for access/discovery. Dependency: step 2.
4. **Luna — focused behavior tests and implementation report.** Add meaningful tests in `tests/letter-library.test.ts`, covering enum/prefill integrity, unknown presets, available/missing/denied entries, and compatibility with existing hydration/location gating. Run scoped checks and record real outcomes in the run's `luna-implementation-report.md`. Dependency: steps 2–3.
5. **Coordinator — independent verification.** Inspect actual diffs, run appropriate regression checks, and verify local rendered behavior with mocked availability at desktop/mobile sizes. Repair bounded findings through Luna, at most three cycles absent new user scope. Dependency: step 4.
6. **Coordinator — record result.** Update only this sprint's ledger entry and run state; map each acceptance criterion to evidence. Mark complete only after required checks pass. No deployment is implied.

Luna's allowed implementation writes: the three new source files above; `app/page.tsx`; `app/sitemap.ts`; `tests/letter-library.test.ts`; and its role-specific files inside this run. The coordinator alone owns sprint documents, ledger, run state, and opportunity-review updates. One implementation writer at a time.

## 5. Verification and evidence

- Targeted suite: `node --import tsx --test tests/letter-library.test.ts tests/s2-chooser-and-routing.test.ts tests/s3-homepage-composition.test.ts tests/template-availability-client.test.ts`.
- Relevant policy regression: `npm run test:template-governance`.
- TypeScript: `npx tsc --noEmit` or the local compiler equivalent. Record any pre-existing failures rather than changing unrelated code to hide them.
- Local browser: library at desktop and mobile; visible home entry; each cancellation link's URL and hydrated value; editability; loading/error/retry; paused cancellation; all-unavailable state; location gate; keyboard and horizontal-overflow checks. Use local mocks and block payment/dispatch or external service calls. Save screenshots and a compact result JSON in this run.
- Integrity: `git diff --check`; compare the protected source hashes and pre-existing changed-file hashes; compare earlier ledger entries against baseline. Existing template/delivery behavior should require no print-layout or payment tests because those files and contracts remain unchanged.

Run evidence index: [INDEX.md](../../.delivery/runs/2026-10-21-letter-library/INDEX.md).

## 6. Risks, decisions, and provenance

Risk: expanded browsing could be mistaken for newly reviewed legal products. Mitigation: preserve the existing letters, label cancellation starting points plainly, and avoid new approval/guarantee language or inflated counts.

Risk: stale or absent policy could expose inappropriate links. Mitigation: fresh public availability, explicit canonical-slug intersection, fail-closed rendering, and unchanged downstream gates. Library availability is not a determination that an individual user's location or circumstances qualify.

Risk: inherited URLs could alter personal data or mailing choices. Mitigation: static allowlisted enum values and a URL containing exactly one nonpersonal field.

Planning provenance: Codex local draft; GPT-6 Luna read-only feasibility/acceptance critique in [luna-plan-review.md](../../.delivery/runs/2026-10-21-letter-library/luna-plan-review.md); coordinator synthesis. No Antigravity review was executed: tool discovery exposed no connector and no `antigravity` CLI was found. The single-app route is disclosed and consistent with the user's explicit Luna executor choice; an optional handoff is retained in the run. Technical critique is not legal clearance.

No unresolved user decision blocks this bounded implementation. The statutory and company-procedure opportunities remain documented for subsequent review and sprints.

## 7. Execution record

Luna implemented the library, enum-derived cancellation starting points, homepage links, sitemap entry, and focused tests. Coordinator review requested customer-facing wording, a prominent homepage entry, and a small numbered-list spacing correction; Luna completed each adjustment.

Coordinator verification passed: 54 targeted tests, 26 template-governance tests, TypeScript, 17 browser behavior scenarios, and three final viewport/layout checks. Luna additionally reran 28 focused tests and TypeScript after the last spacing correction. All 18 protected source hashes and all 12 prior ledger entries were preserved; unrelated baseline work was unchanged. The opportunity review received a link to this completed implementation.

All AC1–AC8 are met. See [verification and acceptance mapping](../../.delivery/runs/2026-10-21-letter-library/verification.md), [Luna report](../../.delivery/runs/2026-10-21-letter-library/luna-implementation-report.md), and [final source integrity record](../../.delivery/runs/2026-10-21-letter-library/evidence/integrity.json). No deployment, live policy write, payment, or postal dispatch was performed. The new statutory and company-specific opportunities remain research backlog items.
