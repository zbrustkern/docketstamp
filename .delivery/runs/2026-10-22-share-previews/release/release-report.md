# DocketStamp share-preview release

**Status: Live on staging and production.**

- Staging: https://staging.docketstamp.com — `614899b`; 1,241 preview checks and 13 asset checks passed.
- Production: https://docketstamp.com — `b66b699`; 1,230 preview checks and 13 asset checks passed.
- Live main preview: https://docketstamp.com/share/v1/home.png
- 11 branded cards: homepage, square companion and nine letter-specific previews. Matching app icons, explicit canonical Open Graph/Twitter metadata, neutral private-page previews, and corrected legacy image fallbacks.
- Fixed the pre-existing deployment omission of public images; standalone build and all 21 public-file requests passed before release.
- Production build, focused tests, type checking and remaining regression groups passed. One unrelated fixed-date reminder test fails identically on unchanged production code; it remains unchanged.
- Luna asset, metadata and independent QA lanes completed. Existing local work and previous sprint entries were preserved.

See `deployment-verification.json`, `staging-http-evidence.json`, `production-http-evidence.json`, both identity reports, `standalone-assets-evidence.json`, `standalone-http-evidence.json`, and `workspace-preservation.json` for verification. Rollback sources are staging `11ee79f` and production `4c6eeb8`.
