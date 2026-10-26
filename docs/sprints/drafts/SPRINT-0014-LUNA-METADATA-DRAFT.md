# SPRINT-0014 — Share-preview metadata and release plan (Luna lane B)

**Status:** Draft for coordinator synthesis; implementation held for the user’s preview review  
**Scope owner:** Luna metadata/release planning lane  
**Authority:** Master Build Specification, Agentic Expansion Specification and SPRINT-0011/0012 addenda; SPRINT-0014 intent  
**Implementation boundary:** Metadata, public share assets, route metadata/privacy, and release evidence only. No changes to notice content, availability rules, customer data, payments, postal dispatch, credentials, or production before preview approval.

## Concrete findings

1. The root metadata in `app/layout.tsx` points Open Graph and Twitter cards at `/og-image.png` and supplies explicit 1200×630 PNG properties. Intent records that the current image is obsolete SendMyNotes handwriting artwork. A stale `public/og-image.jpg` remains alongside it.
2. `app/twitter-image.png` and `app/icon.png`, `app/apple-icon.png` are Next metadata-file conventions that can override or supplement configured metadata. The icons under `public/` and `public/site.webmanifest` are also separate surfaces. Inventory every emitted asset before choosing the one authoritative social-card path; do not assume changing root metadata disables file-convention output.
3. `app/notices/[slug]/page.tsx` constructs its own `openGraph` object but omits `images`, `locale`, and a versioned card URL. Next nested metadata replacement can drop parent Open Graph fields. It hardcodes canonical URLs to docketstamp.com and resolves aliases through `getNoticeBySlug()`, but does not explicitly set canonical through a shared origin helper.
4. Notice pages accept arbitrary `?stage=...` and direct field query values for preparation. Their metadata is currently indexable and does not inspect query state. Root canonical is the bare origin, but no consistent query-stripping/route canonical policy exists. Stage IDs and prefilled personal values must never enter metadata.
5. `/order/[id]` has noindex metadata in its layout. `/docket/[docketId]` sets noindex but its title and description include the docket ID. `/account` and `/admin` lack page-level robots metadata. `/admin/feature-flags` redirects to admin. Keep these private or identity-bearing surfaces noindex and use neutral metadata with no IDs or personal content.
6. `/companies` has a canonical and description but no route-specific Open Graph/Twitter card metadata. Home, notice, and directory should share or deliberately select the approved card design without altering route data or asserting that a given template is enabled.
7. Public availability is a separate mutable overlay. The sitemap already catches policy read errors and emits no notice URLs (fail closed). Page generation includes every cartridge, while preparation/checkout policy remains authoritative. Share metadata must be descriptive only; it cannot make a paused template appear usable or expose review notes. On policy read/parse failures, keep metadata generic or omit template-specific routing data and preserve the existing deny-new-work behavior.
8. The 2026-10-20 deployment record verifies SPRINT-0011/0012 on staging and production at `4e24aec`, with paid production checkout held pending live configuration at that time. Current local `HEAD` is `4c6eeb8` on `codex/admin-outgoing-email`; `origin/main` and `origin/staging` are behind the local branch pointers recorded in the checkout, and the worktree has substantial uncommitted changes. Re-read branch/remotes and deployment state immediately before any release; do not treat the old deployment report or dirty checkout as the release candidate.
9. The required baseline `.delivery/runs/2026-10-22-share-previews/baseline.json` records a dirty-worktree snapshot including SPRINT-0013 local letter-library files. The repository already contains those unrelated edits. Release must use an isolated clean/current release baseline and select only reviewed SPRINT-0014 paths; never bundle `app/letters/page.tsx`, `src/components/docket/LetterLibraryClient.tsx`, `src/lib/docket/letter-library.ts`, `tests/letter-library.test.ts`, SPRINT-0013 docs, or its delivery run unless separately authorized.

## Outcome and scope

After preview review, replace stale share artwork with the approved deterministic public assets and make bot-visible metadata consistent across home, the company directory, and canonical notice routes. Canonical aliases resolve to the canonical slug; unknown routes remain 404s. Query strings are excluded from canonical URLs. Stage/prefill URLs receive neutral, nonpersonal metadata and noindex/nofollow; clean public routes retain route-specific share metadata. Private/identity-bearing pages remain noindex and never put IDs, personal details, stage token, or order fields into title, description, image URL, canonical, alt text, or structured data.

Maintain all six system invariants and the UPL positioning. Use only the approved headline “Make it formal. We’ll print and mail it.”, approved concise workflow wording, and existing approved self-help/not-a-law-firm positioning. No legal outcomes, delivery promises, universal availability, affiliation or live-price claims. Card illustrations remain abstract (rules and amber tags), not rendered notices or postal records.

Asset scope: reviewed 1200×630 PNG wide card and deliberately composed 1:1 companion, both immutable/versioned public URLs with explicit dimensions, MIME type and useful alt text. Retire stale OG PNG/JPG references and Next Twitter-image convention only after callers are migrated; leave unrelated app icons untouched unless the approved review explicitly included them. Public cache identity changes with the versioned asset URL. Browser/platform card mockups are design evidence, not actual scraper proof.

## Exact implementation files

Expected bounded write set after checkpoint:

- `app/layout.tsx`: central root metadata/canonical origin, social card and icons/manifest references if selected.
- `app/notices/[slug]/page.tsx`: canonical notice metadata, alias normalization, query-sensitive neutral metadata and inherited card fields.
- `app/companies/page.tsx`: directory canonical and route metadata/card.
- `app/order/[id]/layout.tsx`: preserve noindex with neutral nonidentifying metadata.
- `app/docket/[docketId]/page.tsx`: remove identifier from title/description; preserve noindex.
- `app/account/layout.tsx` (new, if no existing layout): noindex for the authenticated account surface.
- `app/admin/layout.tsx` (new, if no existing layout): noindex for admin and descendants.
- `public/og-image-v2.png`, `public/og-square-v2.png`: approved versioned assets (final filenames may follow asset lane’s agreed names).
- `public/og-image.png`, `public/og-image.jpg`: remove or replace only after reference audit; no legacy stale file may continue to be the declared card.
- `app/twitter-image.png`: remove/replace only after metadata-file precedence is verified.
- `public/site.webmanifest`: correct inaccurate “legal notice” / “dispatch registry” description if carried by approved copy review; preserve PWA identity and colors.
- Focused metadata tests under `tests/` (one dedicated `tests/share-metadata.test.ts` preferred) plus narrowly scoped updates to relevant existing tests.

Do not edit `app/page.tsx`, `app/sitemap.ts`, notice cartridge prose/SEO, `src/lib/docket/template-policy*`, API/MCP, rendering, checkout, fulfillment, or credentials for this lane. If code review proves one is necessary, return it to the coordinator for scope resolution before implementation.

## Privacy, alias, and availability rules

- Derive public canonical origin from the existing environment configuration but validate/fallback to the production origin; do not canonicalize staging to production unless this is intentional and staging remains globally noindex. Preserve staging’s robots metadata and `X-Robots-Tag`.
- Construct canonical URLs from normalized pathname only; omit query and fragments. For aliases, use the cartridge returned by `getNoticeBySlug(alias)` and emit the existing canonical slug. Never use a raw unrecognized slug as positive template metadata.
- For any query-bearing preparation route (including `stage`, `field.*`, recipient or nexus data), use nonpersonal generic title/description and `robots: { index: false, follow: false }`; canonical still resolves to the clean canonical notice URL. Do not reflect query keys or values in metadata. Keep stage functionality intact.
- Mark account, admin, order and docket routes noindex/nofollow; docket/order metadata remains generic, with no opaque identifiers.
- Availability stays authoritative in the existing policy gates. Metadata is not a readiness/availability API. Public route descriptions say users can prepare/review and choose from services available at checkout, with no assurance a specific notice is enabled. If metadata chooses to consult policy for a particular notice, any read/parse failure must suppress template-specific promotional metadata and must never relax the existing fail-closed preparation and checkout behavior. Prefer a static, availability-neutral route description to avoid adding a fragile policy read.
- Continue honoring robots exclusion for staging and avoid adding public routes/images containing private/user data.

## Ordered implementation and review

| Work | Owner | Result | Gate |
|---|---|---|---|
| Reconcile approved wide/square artwork names and wording | Asset lane + coordinator | Final preview assets and copy | User preview checkpoint |
| Inventory metadata-file conventions, page metadata and route access | Luna implementation | Confirmed precedence and bounded diff | Before edits |
| Implement card references and route privacy/canonicals | Luna implementation | Exact scoped files, no customer-flow change | After preview approval |
| Focused tests and bot-view checks | Independent reviewer/coordinator | Passed route matrix and image inspection | Before staging |
| Isolated release selection | Coordinator/release owner | Clean candidate with explicit allowlist; SPRINT-0013 excluded | Before deploy |
| Staging rollout and hosted proof | Release owner | Image bytes/cache, headers and metadata verified | After staging build passes |
| Production rollout and hosted proof | Release owner | Production asset and route proof | Only after staging proof; existing scope authorization applies |

## Acceptance and verification

1. Approved wide/square images are exact dimensions, deterministic, publicly fetchable, versioned and correctly typed. No stale card appears in Open Graph, Twitter, Next metadata image routes, HTML, or manifest.
2. Bot-visible tags on `/`, `/companies`, every canonical notice, and representative aliases contain correct title/description, canonical, locale/type, image dimensions/type/alt, Twitter summary-large-image and robots directives. Nested metadata does not lose the approved card.
3. Alias metadata points only to canonical slug. Unknown slug returns 404 and does not emit invented notice metadata.
4. Query-bearing notice examples (`?stage=...`, `?field.senderFullName=...`, recipient/nexus values and combined query) preserve the review-link behavior while producing a clean canonical, neutral metadata, noindex/nofollow, and zero leaked values. Automated assertions inspect full generated HTML head.
5. `/account`, `/admin`, `/order/[id]`, `/docket/[docketId]` have noindex/nofollow and no IDs, emails, addresses or user content in title/description/canonical/image metadata. Staging remains noindex through both metadata and response header.
6. Availability paused, missing or malformed store behavior remains unchanged and denies new work. No metadata path turns an unavailable cartridge into an offer; sitemap remains fail-closed. No paid checkout, outbound mail or policy mutation is part of verification.
7. Run focused metadata/route tests, existing relevant routing/template-availability tests and `npx tsc --noEmit --incremental false`; production build passes. Inspect rendered social previews at wide and square display sizes and check response headers/image bytes on staging. Do not claim actual social-network scraper behavior unless tested with those platforms.
8. Release artifact contains only SPRINT-0014 allowlisted paths. Compare the original baseline fingerprints and prove all SPRINT-0013 letter-library files remain out of the diff/release. Record current source commit, deployed revision, staging and production response evidence, and cache/version results.

Suggested focused regression targets (adapt after inspecting suite): `tests/s2-chooser-and-routing.test.ts`, `tests/template-policy*.test.ts`, and the new share-metadata route/HTML test. Existing deployment flow is Firebase App Hosting with staging/main branches. The historical 2026-10-20 report is evidence of prior setup, not current release state. Do not invoke production secrets or reveal credential values in logs or reports. Paid production checkout readiness remains a separate operational gate.

## Explicit non-goals and risks

No logo/icon redesign beyond approved asset scope; no title/body rewrite outside approved meta copy; no availability-policy changes; no sitemap expansion; no legal research/clearance; no social account submission; no metadata claims of postal tracking, legal efficacy, delivery, successful cancellation, government/court endorsement, or assured service. No production work until the preview checkpoint is resolved. Once reviewed, staging/production rollout remains within the user’s SPRINT-0014 authorization unless a new material risk appears.
