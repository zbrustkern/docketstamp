# SPRINT-0014 — DocketStamp thumbnails and link previews

<<<<<<< HEAD
**Status:** Complete — implemented with Luna agents; staging and production deployed and verified
=======
**Status:** Active — design approved; Luna implementation and staging/production rollout authorized
>>>>>>> origin/staging
**Run:** `2026-10-22-share-previews`
**Owner:** Codex coordinator; user-requested GPT-6 Luna asset, metadata and QA agents
**Chapter:** None

## Pyramid Index

- **L0:** Replace obsolete SendMyNotes previews with a branded, readable DocketStamp share system, then verify and release it through staging and production after the preview checkpoint.
- **L1:** Reviewed wide/square art; explicit route metadata and cache identity; no personal data in previews; disjoint Luna execution; isolated release and hosted evidence.
- **L2:** See Design handoff, Architecture, Implementation plan, Definition of done, and Release boundary below.

## Overview and authorization

The user requested first-class thumbnails and link previews that follow the brand and sell DocketStamp's value proposition, Luna implementation under a sprint plan, and staging/production deployment after seeing a preview. The coordinator has produced concrete local design artifacts and shown the primary card. The user approved the preview on 2026-10-22: “Looks great! Let’s implement and push to staging and prod.” Proceed with the recommended matching variants for existing letter types. Existing release authorization applies once the design checkpoint is resolved; no redundant release permission is needed unless a material new risk appears.

Read `AGENTS.md`, the [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md), [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md), their SPRINT-0011/0012 authority updates, and the current design system. All six invariants stay unchanged. No token cache, semantic index or chapter ledger is configured; use repository source directly.

## Observed problem

Four active or potentially active image surfaces still contain the obsolete SendMyNotes handwritten-card artwork: `public/og-image.png`, `public/og-image.jpg`, `app/opengraph-image.png`, and `app/twitter-image.png`. Root metadata points at the public PNG, while file conventions can take precedence. Notice-level Open Graph objects omit images, so a root-only change is insufficient. Route metadata and canonical alias handling need an explicit, tested shared definition.

The original checkout is heavily dirty and contains the completed but undeployed SPRINT-0013 letter library. Its baseline is saved in the run. The installed ledger utility supports YAML/TSV rather than this repository's JSON; maintain `docs/sprints/ledger.json` without creating a second ledger.

## Use cases

1. Someone shares the homepage: the image immediately communicates formal-letter preparation plus USPS mailing under the correct brand.
2. Someone shares a supported letter: the title describes that letter and, if selected at the preview checkpoint, the image matches it.
3. A platform uses a smaller card: the brand and headline remain recognizable. A square asset is deliberately composed, with no promise of platform-specific automatic selection.
4. Someone shares a prefilled/staged link or order record: preview metadata never contains names, addresses, stage/order/docket identifiers, signatures, or query values.

## Design handoff

All paths below are relative to `.delivery/runs/2026-10-22-share-previews/design/`:

| Artifact | Size | Purpose |
| --- | --- | --- |
| `home.png` | 1200 × 630 | Primary OG/large-image card |
| `square.png` | 1080 × 1080 | Companion square composition |
| `cancellation.png` | 1200 × 630 | Proposed letter-specific example |
| `preview.html` | Responsive | Local design presentation with link mockup |
| `preview-1440.png` / `preview-390.png` | Full-page renders | Desktop/mobile review boards |
| `build-preview.mjs`, `fonts.css`, `fonts/` | Editable source | Reproducible design source; adapt renderer paths for durable tooling |
| `render-checks.json` | Evidence | Font loading, dimensions, text bounds, overflow |

**Main image:** “Make it formal.” / “We’ll print and mail it.” / “Prepare online. Review. Send by USPS.” / “Certified Mail available.”

**Metadata title:** “Make it formal. We’ll print and mail it. | DocketStamp”

**Metadata description:** “Prepare and review a formal letter online. We print and mail it by USPS, with Certified Mail available. Self-help preparation; not a law firm.”

**Image positioning line:** “Self-help document preparation. Not a law firm. No legal advice.” This concise image line supplements the existing required page/instrument disclosures; it never replaces them.

Use the existing blue DS monogram and mono wordmark, navy #0F172A, crisp white paper, slate borders, registry blue #0284C7, existing sky tints for legible text on navy, and amber detail tags. Merriweather headlines, Inter guidance, JetBrains Mono labels. No gradients or invented government seals. Letter art consists only of generic headings, abstract rules, and tags; it contains no separately authored notice prose or postal record. The physical letter renderer is not changed.

**Matching variants approved for implementation:** use the same design system for the existing nine canonical notice types. Reuse current approved action titles or short accurate equivalents. Initial cancellation example is “Cancel a service. Put it in writing.” with “Prepare your cancellation letter. We’ll print and mail it.” This describes the user's notice action, consistent with the approved chooser; never claim successful cancellation. Keep the arbitration card explicitly about requesting procedure information. Every variant gets visual review for text fit before integration.

Canonical map starts from the actual registry: `tenant-notice-of-intent-to-vacate`, `security-deposit-accounting-request`, `tenant-repair-and-maintenance-notice`, `credit-report-dispute-request`, `debt-dispute-information-request`, `service-cancellation-request`, `product-complaint-refund-request`, `arbitration-opt-out-procedure-request`, `personal-data-deletion-request`. Resolve legacy aliases through the existing registry; do not key assets to old aliases.

## Architecture

- Static, deterministic images under a versioned namespace such as `public/share/v1/`. Manifest records image source, bytes/hash, dimensions, MIME type, alt text and canonical-route mapping. Prefer PNG under 1 MB per wide card. Actual dimensions must match tags.
- One typed shared metadata helper, e.g. `src/lib/docket/share-metadata.ts`, with public origin, shared title/description/image data and a finite canonical route map. No generated image endpoint, AI runtime, arbitrary text rendering or customer-data lookup.
- Root, homepage metadata, company directory and notice metadata use explicit complete Open Graph and Twitter values. No reliance on deep merging nested metadata. Use `summary_large_image`, absolute public URLs, descriptive image alt and correct MIME/dimensions. Avoid duplicate brand suffixes in the title.
- Remove the stale Next convention files once explicit tags are verified. Replace legacy public PNG/JPG with the approved home art for still-cached external references; all active new tags point to versioned files. Do not redesign browser/app icons unless a separate issue is confirmed and brought into scope.
- Public notice metadata stays static and query-independent, with canonical URLs based on normalized canonical slugs. Never read or reflect fields, recipient/stage tokens or user data. Do not turn every notice dynamic just to add blanket query noindex. Preserve staging robots and existing private-route noindex. Add narrowly scoped neutral metadata/noindex for account/admin and remove docket IDs from docket metadata, without modifying auth or order lookup behavior. Private routes use generic images and never publish record-specific canonical/OG URLs. Additional query-indexing changes require a concrete need and measured rendering impact, not speculative scope expansion.
- Availability-neutral descriptions do not declare a template enabled/reviewed, invent verified recipients or guarantee legal effect. Existing availability and readiness enforcement remains untouched. The image's Certified Mail line describes the already-advertised product option, not an override of eligibility/readiness.

## Implementation plan

| Phase | Owner | Work and output | Depends on |
| --- | --- | --- | --- |
| 0. Preview checkpoint | User + coordinator | Review wide/square/cancellation designs; choose shared-only or matching variants. Record actual response without inferring approval from silence. | Current preview |
| 1. Release baseline | Coordinator | Re-read current remotes/deployed revisions; create/reuse a suitable isolated release checkout from the current release branch. Capture source/dirty-file fingerprints and explicit file allowlist. Do not deploy the original dirty directory. | 0 |
| 2A. Assets | GPT-6 Luna, high | Adopt reviewed source; export the finite approved set into versioned paths, update legacy public image fallbacks, write manifest and asset report. No metadata edits. | 1 |
| 2B. Metadata | GPT-6 Luna, high | Implement the shared helper, route metadata, canonical aliases and bounded private metadata fixes; remove stale convention images. Work only in assigned metadata/test paths. | 1; agreed asset filenames from 2A |
| 3. Independent QA | GPT-6 Luna, high + coordinator | Review integrated diff and every render. Run metadata matrix, image validation, relevant regressions, typecheck/build and bot-visible HTML checks. Repair bounded findings with assigned owner. | 2A + 2B |
| 4. Staging | Coordinator/release owner | Deploy reviewed candidate using existing Firebase App Hosting process. Verify public image bytes/headers, bot-visible tags, staging noindex and unchanged customer routes. Record deployment revision and evidence. | 3 |
| 5. Production | Coordinator/release owner | Promote the same reviewed change onto current production baseline after staging proof. Verify production tags/assets and published revision. Record rollback source. | 4 |
| 6. Close | Coordinator | Map acceptance to evidence, update only SPRINT-0014 ledger status and report preview/deployment results honestly. | 5 |

Asset and metadata writers own disjoint paths. Coordinate one integration writer; do not let workers edit the ledger, deploy, or stage unrelated files. QA is independent of authorship. Preserve all pre-existing local edits byte-for-byte where untouched; integrate any local metadata hunk carefully so the letter-library body changes remain intact. A worker's reported success is provisional until actual outputs are checked.

## Files summary

**Asset lane:** `public/share/v1/*`; legacy `public/og-image.png` and `.jpg`; a reproducible asset source/export task under a suitable existing scripts/design location; role report/manifest.

**Metadata lane:** new shared helper; `app/layout.tsx`; metadata-only hunk in `app/page.tsx` if needed for coherent homepage title/description; `app/notices/[slug]/page.tsx`; `app/companies/page.tsx`; removal of `app/opengraph-image.png` and `app/twitter-image.png`; metadata-only changes in `app/docket/[docketId]/page.tsx`, existing order layout and new account/admin metadata layouts where warranted; focused `tests/share-metadata.test.ts` plus relevant test updates. No edits to page bodies or business logic.

**Coordinator only:** this sprint, its draft/critique/merge records, the sprint ledger and this delivery run. `app/letters/page.tsx` is currently undeployed; it can inherit the shared root card later, but its implementation is outside this release.

## Definition of done

- [x] Main wide, composed square and cancellation example produced and visually inspected.
- [x] Desktop/mobile presentation checked; brand fonts loaded; primary card text bounds pass; no page overflow.
- [x] Two Luna planning drafts and independent peer critiques recorded and synthesized.
- [x] User approved the preview and implementation/deployment on 2026-10-22; proceed with matching variants.
- [x] Versioned static image set and manifest match reviewed source; no stale SendMyNotes bytes remain in active share sources or declared tags.
- [x] Actual rendered HTML for `/`, `/companies`, all nine canonical notices, every accepted alias and unknown route has correct metadata. Unknown routes remain 404. Test ordinary crawler plus Facebook/Twitter-style user agents to catch metadata streaming/file-convention differences. Do not infer emitted tags from source strings alone.
- [x] Query/stage/recipient sentinel tests prove no personal values in title/description/canonical/OG/Twitter/alt. Staging and private routes retain appropriate noindex. Private IDs never enter metadata. No policy/readiness behavior changes.
- [x] Images fetch without cookies/auth/JS, correct image Content-Type, dimensions, byte size and readable art. All variants at 600×315/300×158 and square at 160×160 inspected; tiny thumbnails need brand/headline recognition, not every disclosure word.
- [x] Focused metadata/routing tests, relevant existing regressions, TypeScript, production build and `git diff --check` pass. Existing unrelated failures are reported separately, never hidden by broad edits.
- [x] Staging then production hosted GET checks confirm deployed revision, absolute image URLs, matching image hashes and intended bot-visible tags. No charge, postal dispatch or live policy write occurs. Public scraper caches may refresh on their own schedule; do not promise instant replacement of old shares.
- [x] Release diff includes only this sprint's implementation; no undeployed SPRINT-0013 or unrelated work is carried along. Original baseline files and older ledger entries remain preserved.

## Risks and mitigations

- **Old image overrides/cache:** remove both Next file conventions, publish versioned URLs, refresh legacy bytes, inspect real emitted tags and hosted bytes. No social-network posts or account changes are authorized or required.
- **Copy overflow:** finite shared art system and visual checks for the longest canonical titles; no automatic shrink-to-illegible typography.
- **Misleading service/legal claims:** use approved preparation/mailing action language. No court-proof, successful refund/cancellation, live-price, deadline or outcome promises; no new fitness uses.
- **Sensitive URLs:** use static nonpersonal metadata and clean canonical paths; no customer-data image rendering. Existing access control is not redesigned in this sprint.
- **Dirty checkout / environment drift:** isolated current release baseline and allowlisted integration. Historical deployment evidence is context only. Staging/prod remain operationally separate; no secrets or credentials are changed to make preview tests pass.
- **Scope escalation:** no new letters, pricing, renderer geometry, payment/dispatch, policy, compliance-footer changes, app-icon redesign or legal research.

## Dependencies and sources

The existing fonts and brand/source files, current canonical registry, Next 15 metadata behavior, established Firebase App Hosting release process, and the user's preview decision. [Open Graph protocol](https://ogp.me/) documents required page/image metadata and image dimensions/MIME/alt; implement against the installed Next version and test emitted output. The attempted old X documentation URL redirects to a general overview, so no fresh platform-specific size/crop guarantee is inferred from it.

## Execution record

2026-10-22: Design/planning only. No public assets or application source modified; no deployment, charge, mailing or external message. User has been shown the main card and asked design/scope questions. See the run's preview renders, `render-checks.json`, baseline and peer drafts/critique. This sprint remains planned until that decision is received.

2026-10-22 execution start: Explicit approval received. Fresh remote staging baseline is `11ee79fcfef9ad966dfda02148a4543f5dc77506`; production is `4c6eeb8eafcfa1757e9a3175199695e6cb893eb3`. Preserve their existing environment configuration differences and deploy the same scoped asset/metadata change to each.

### Verified implementation before release

Luna asset and metadata lanes implemented the approved main/square/cancellation artwork, eight additional letter variants, and shared query-independent route metadata. Both obsolete Next convention images were removed. Concrete follow-up inspection found SendMyNotes branding in the app/favicon/touch icons; those existing surfaces now use the already-approved blue DS mark, and the manifest description uses self-help mailing language. No business-flow or environment configuration changed.

The production build passed. Focused metadata/routing tests passed 27/27. Independent local development HTTP checks passed 1,227 assertions; final production-build HTTP checks passed 1,231 assertions, covering all 38 aliases and neutral private metadata. The repository suite has one pre-existing date-sensitive reminder failure (`expired` vs `scheduled` at tests/notice-deadline-reminders.test.ts:62), reproduced on untouched production baseline `4c6eeb8`; all remaining npm test groups passed. It is not a preview regression and is not changed in this release.

The same scoped implementation will be committed on staging baseline `11ee79f` and cherry-picked onto production baseline `4c6eeb8`, preserving their differing apphosting.yaml settings. Release results are recorded after each hosted rollout.

### Hosted packaging repair

The first staging rollout (`4f93026`, build/rollout `2026-10-22-001`) served correct page metadata but returned 404 for public images and the web manifest. The same legacy public asset failures were reproduced on unchanged production. This matches Firebase App Hosting adapter [issue #630](https://github.com/firebase/apphosting-adapters/issues/630) / [fix #683](https://github.com/firebase/apphosting-adapters/pull/683): a partially traced public directory can cause remaining files to be omitted. The managed adapter version was not established.

Added `outputFileTracingIncludes` for `./public/**/*` in `next.config.ts` to include the finite 1.5 MB public directory in server traces. No environment settings or runtime business logic changed. A fresh standalone production build passed; all 21 public files were present with matching hashes, and all 21 were fetched successfully from the standalone server with exact source bytes. Hosted checks are repeated on the repaired staging release before production promotion.
### Completed release

Completed 2026-10-22T16:55:07.953844+00:00. Staging serves `614899b3364b13bdd6f3b27185e1d230a690bd35` (build `build-2026-10-22-003`, successful rollout `rollout-2026-10-22-002`); production serves `b66b69956eae54f59e3ef608be29207d7b143f45` (build/rollout `2026-10-22-001`). Both have 100% traffic on the verified release. Staging passed 1,241 crawler/metadata checks plus 13 asset checks; production passed 1,230 plus 13. No failures or unavailable checks remain. All nine canonical notice types and 38 legacy aliases were checked. The wide, square and letter assets, icons, legacy image fallbacks and manifest fetch successfully with expected hashes. Production indexing and staging/private noindex metadata remain correct.

The delayed automatic staging trigger created a second build of the identical repaired commit after the explicit rollout; both completed successfully. The final serving staging build is recorded above. Production used its automatic rollout. No payments, dispatches or live policy changes were performed. Rollback sources remain staging `11ee79f` and production `4c6eeb8`, before this release.

The deployment checkout contained only this sprint's changes. All 213 pre-existing local files were checked, with no unexpected differences; pending homepage body changes and all earlier ledger entries are preserved. Release source changes are integrated in the original workspace. Evidence: `.delivery/runs/2026-10-22-share-previews/release/deployment-verification.json`, hosted HTTP/identity reports, standalone packaging checks, and `workspace-preservation.json`. The unrelated fixed-date reminder test failure remains documented above. Social-network cache refresh timing is external to this release.
