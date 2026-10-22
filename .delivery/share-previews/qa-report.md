# SPRINT-0014 Independent Share Preview QA

**Checkout:** `/private/tmp/docketstamp-share-release-20261022`
**Target:** local staging configuration at `http://127.0.0.1:3124`
**Evidence:** `local-http-evidence.json`

The read-only checker covered the homepage, company directory and all nine canonical notice routes using a normal user agent, Twitterbot and facebookexternalhit. It also exercised all 38 aliases from the current notice registry, an unknown slug, query-value sentinels, staging robots metadata, images and private metadata.

Result: **1,227 checks passed; no failures.** All checked public pages returned server-rendered HTML and the expected versioned image path. Every image returned `image/png`; local and hosted bytes matched the manifest SHA-256, declared byte size and dimensions. Staging metadata emitted `noindex, nofollow, nocache` for all checked public routes. Query sentinels did not appear in title, description, canonical, Open Graph or Twitter tags.

Account and admin returned 200 with noindex/nofollow/nocache, no canonical link, no `og:url`, and no record identifier in metadata. The synthetic route `/docket/DS-QA-NONEXISTENT` returned 404, so its private metadata was unavailable for this build; no real docket identifier or customer data was used.

The image contact sheet was visually inspected. The nine notice variants remain consistent with the home artwork, with clear headline hierarchy and legible brand marks at the supplied review size. No implementation blocker was found.

## Final thumbnail-size review

Read-only boards were rendered from the final public assets at 600×315 and 300×158 for the home card and all nine notice cards, and at 160×160 for the square card. At 600×315 every card has clear headline hierarchy and recognizable DS/DOCKETSTAMP branding. At 300×158 the brand mark and primary headline remain recognizable across every wide card; the smallest disclosure and supporting copy are naturally secondary at this size. At 160×160 the square card keeps the “Make it formal” headline readable and the DS mark visible; supporting copy is too small to rely on, which is acceptable for the tiny preview. No clipping or compositional issue observed.

Boards: `wide-600x315.png`, `wide-300x158.png`, and `square-160x160.png`.

Run again with:

```sh
node --import tsx .delivery/share-previews/verify-share-http.mjs https://BASE --staging --evidence .delivery/share-previews/evidence.json
```
