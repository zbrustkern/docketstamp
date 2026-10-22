# SPRINT-0014 Independent Share Preview QA

**Checkout:** `/private/tmp/docketstamp-share-release-20261022`
**Target:** local staging configuration at `http://127.0.0.1:3124`
**Evidence:** `local-http-evidence.json`

The read-only checker covered the homepage, company directory and all nine canonical notice routes using a normal user agent, Twitterbot and facebookexternalhit. It also exercised all 38 aliases from the current notice registry, an unknown slug, query-value sentinels, staging robots metadata, images and private metadata.

Result: **1,227 checks passed; no failures.** All checked public pages returned server-rendered HTML and the expected versioned image path. Every image returned `image/png`; local and hosted bytes matched the manifest SHA-256, declared byte size and dimensions. Staging metadata emitted `noindex, nofollow, nocache` for all checked public routes. Query sentinels did not appear in title, description, canonical, Open Graph or Twitter tags.

Account and admin returned 200 with noindex/nofollow/nocache, no canonical link, no `og:url`, and no record identifier in metadata. The synthetic route `/docket/DS-QA-NONEXISTENT` returned 404, so its private metadata was unavailable for this build; no real docket identifier or customer data was used.

The image contact sheet was visually inspected. The nine notice variants remain consistent with the home artwork, with clear headline hierarchy and legible brand marks at the supplied review size. No implementation blocker was found.

Run again with:

```sh
node --import tsx .delivery/share-previews/verify-share-http.mjs https://BASE --staging --evidence .delivery/share-previews/evidence.json
```
