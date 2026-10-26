# Sprint 0014 Intent: DocketStamp share previews

## Seed

Design first-class thumbnails and link previews that follow the brand and sell the value proposition immediately. Show the user a concrete preview before implementation/release. Once the design is reviewed, use Luna agents for execution; staging and production rollout are authorized within that scope.

## Planning lanes

Coordinator: inherited model. Two user-requested GPT-6 Luna workers replace the skill's default Claude/Astra lanes: asset/design implementation plan and metadata/release implementation plan. Use independent drafts and cross-critique; coordinator synthesizes. Runtime subagents are available with explicit model selection. No Gemini lane. This follows the repository's existing Luna sprint convention. Do not launch implementation or release until the preview checkpoint is resolved.

## Orientation

- Canonical specs and their SPRINT-0011/0012 addenda govern copy, policy, all six invariants, and no implied government/law-firm affiliation.
- Current `public/og-image.png` visibly promotes SendMyNotes handwritten cards. Root Open Graph and Twitter metadata still refer to that image. Both PNG/JPG legacy files need replacement after preview approval.
- Homepage brand is a blue DS monogram with JetBrains Mono DOCKETSTAMP wordmark. Colors: midnight #0F172A, slate #1E293B/#334155, white, registry blue #0284C7, amber #FEF3C7/#D97706. Merriweather headline, Inter support, JetBrains Mono labels.
- Approved existing headline: “Make it formal. We’ll print and mail it.” Focus on prepare/review/USPS mailing and convenience. Do not promise legal outcomes, delivery, effective cancellation, or universal availability. No prices in initial design (live checkout readiness is separate).
- Recent sprints 0011/0012 delivered safer copy and availability governance to staging/production. Sprint 0013 letter library is local only and must not be swept into a preview release accidentally.
- The workspace is dirty with unrelated existing work. Baseline is `.delivery/runs/2026-10-22-share-previews/baseline.json`. Keep changes scoped, preserve old ledger entries. The repo uses `docs/sprints/ledger.json`; the installed skill CLI supports only YAML/TSV and reports zero, so use a narrowly scoped JSON append instead of creating a competing ledger.

## Pyramid Index

- L0: Replace obsolete social previews with a clear, branded and privacy-safe DocketStamp share system.
- L1: Master wide card and square thumbnail; route-aware metadata; immutable local/static assets; preview checkpoint; Luna implementation; staging then production proof.
- L2: See Context, Relevant Code, Constraints, Success Criteria below.

## Design direction

Create a polished 1200×630 master card: navy field, clear white serif “Make it formal.” headline, blue supporting “We’ll print and mail it.” line, brief sans-serif workflow, faithful blue DS wordmark, and an editorial paper/envelope product illustration using no invented legal prose. Any document content is clearly an abstract illustration (rules and amber tags), not an alternate notice renderer or actual postal record. Include a concise self-help/not-law-firm statement. Create a deliberately composed square companion, not an automatic crop. Render a service cancellation route example and compact link mockups to assess thumbnail legibility. Board labels must say these are illustrative previews, not actual platform scraper proof.

## Semantic Index

Not configured — see `docs/SEMANTIC-INDEX.md`. Use repository prior art directly.

## Chapter Context

No chapter link selected; no chapter ledger is present.

## Relevant Code

`app/layout.tsx`, `app/page.tsx`, `app/notices/[slug]/page.tsx`, `app/companies/page.tsx`, local-only `app/letters/page.tsx`, `public/og-image.png`, `public/og-image.jpg`, icons/manifest, `src/lib/docket/notices/index.ts`, guardrails and current availability rules. Existing deployment evidence: `.delivery/runs/2026-10-20-template-governance/deployment.md` (Firebase App Hosting, staging/main branches; re-check actual state before release).

## Constraints

- All six invariants remain unchanged; no modifications to letter prose, rendering, payment, freeze, dispatch, policy or credentials.
- No actual letter content authored separately from shared interpolation. Abstract artwork only unless the canonical renderer is used.
- Every metadata image must be public, deterministic, branded, readable, explicitly sized/typed/alt-texted; use a versioned URL to avoid carrying obsolete cache identity forward.
- Never include stage IDs, personal fields, recipients, addresses, query params or order/customer data in images, metadata titles or canonical URLs. Private/sensitive routes require neutral nonpersonal metadata and appropriate robots handling.
- Route metadata must not lose images through nested metadata replacement. Canonical aliases must resolve consistently; unknown routes cannot invent a template.
- No inflated verification/tracking/legal-proof/availability claims. Route cards describe preparation without claiming an enabled state; existing availability gates remain authoritative.
- No production changes before the user has seen/reviewed the design. Existing deployment authorization persists; do not demand another release approval after the design checkpoint absent a material new risk.

## Success Criteria

Reviewable wide/square/route previews and implementation-ready plan now. After checkpoint: Luna executes assets + metadata, independent QA verifies images and bot-visible tags on home/directory/notice canonical/alias routes and privacy edge cases, focused regressions and build pass, staging and production release from an isolated current release baseline, read-only hosted checks prove current asset bytes and metadata. No unrelated release, charge, mailing, or outbound communication.

## Open Questions

At the preview checkpoint ask whether the visual direction is approved and whether initial route variants should be a single shared card or the proposed focused route examples. Do not ask for service/model choices already supplied by the user.
