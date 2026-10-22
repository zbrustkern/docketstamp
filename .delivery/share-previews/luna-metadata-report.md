# SPRINT-0014 Metadata Lane — Implementation Report

**Checkout:** `/private/tmp/docketstamp-share-release-20261022`
**Base:** `11ee79fcfef9ad966dfda02148a4543f5dc77506` (staging baseline)
**Scope:** Metadata helper, approved route metadata, private metadata, and focused tests. No source changes to letter content, policy, payment, dispatch, auth, or customer data flow. This lane did not deploy or alter a git commit.

## Implementation

- Added `src/lib/docket/share-metadata.ts` with validated environment-aware absolute URLs, a shared home title/description, complete Open Graph and Twitter fields, canonical URL construction, truthful image dimensions/MIME/alt text, a fixed map for the nine actual canonical notice slugs, and a shared noindex helper for private pages.
- Updated metadata only in `app/layout.tsx`, `app/page.tsx`, `app/notices/[slug]/page.tsx`, and `app/companies/page.tsx`. Notice aliases resolve to the canonical slug and canonical image through the existing registry. Query values are never read into metadata; staged and prefetched links use the same static, query-independent metadata as the clean canonical route. Unknown slugs receive neutral noindex metadata and the existing page remains a 404.
- Added neutral noindex metadata to the account/admin layouts, kept the order route noindex through its existing layout, and removed the docket ID from docket-page metadata. No private title, description, OG/Twitter image URL, or canonical contains a record ID or user data. Private canonical metadata explicitly clears the inherited root canonical.
- Removed the two stale Next convention files `app/opengraph-image.png` and `app/twitter-image.png`, so their implicit tags cannot continue to shadow explicit metadata.
- Updated only the name and description in `public/site.webmanifest` to remove misleading official/legal registry language. The legacy `app/icon.png` was separately confirmed to show SendMyNotes branding; replacing icon image files is owned by the asset lane, and this metadata lane did not edit icon bytes. The manifest key structure, short name, icon paths, and colors remain unchanged.
- Added `tests/share-metadata.test.ts`; it loads the live canonical registry instead of duplicating its slug list.

The homepage body remains unchanged. The root conventional title template remains in place for pages that use it.

## Verification

- `node --import tsx --test tests/share-metadata.test.ts tests/s2-chooser-and-routing.test.ts`: **27 tests passed**.
- `npx tsc --noEmit --incremental false`: passed.
- `git diff --check`: passed.
- PNG manifest check: all **11** public image hashes and declared dimensions match the files. Home and all nine notice cards are 1200×630; square is 1080×1080.
- `npm run build`: blocked before application compilation because this restricted checkout cannot resolve `fonts.googleapis.com`; existing `next/font/google` requests for Inter, Merriweather and JetBrains Mono failed. This is an environment/network limit, not a reported app compile failure. Hosted/bot-visible HTML verification remains for the coordinator’s integrated QA.
- No staging or production deployment was performed in this lane.

## Remaining integration check

The integrated deployed QA should inspect actual HTML for home, directory, every canonical notice, representative aliases, staged/query links, and private order/docket/account/admin routes. In particular, confirm Next emits no inherited canonical on private routes and that private Open Graph metadata does not inherit an `og:url`. Staging must still emit noindex metadata and its existing `X-Robots-Tag`.
