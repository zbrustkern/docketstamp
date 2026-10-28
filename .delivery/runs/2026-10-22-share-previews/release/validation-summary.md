# Share-preview release validation

User approved the design and staging/production deployment on 2026-10-22.

- Main 1200×630, square 1080×1080, and cancellation images match the approved PNG hashes exactly; eight additional static cards cover the remaining canonical notice types.
- Existing SendMyNotes social and app-icon sources were replaced by the approved DocketStamp art and DS monogram. Source font licenses are bundled.
- Shared metadata uses canonical aliases, absolute environment URLs, static images, descriptive alt text, query-independent content and neutral private-page metadata. No notice, payment, policy, mail dispatch or environment configuration logic changed.
- Focused metadata/routing tests: 27 passed. TypeScript and production Next build passed. Independent local development HTTP QA: 1,227 checks passed. Final production-build HTTP QA: 1,231 checks passed, including home/directory/nine canonical letters, 38 aliases, three user agents, query sentinels, all image bytes and private metadata.
- `npm test` reached one pre-existing reminder failure: `tests/notice-deadline-reminders.test.ts:62` uses a fixed date and now receives `expired` instead of `scheduled`. Reproduced on unmodified production baseline `4c6eeb8`. All remaining test groups were run individually and passed; no unrelated reminder changes were made.
- Original dirty checkout is excluded. Staging baseline: `11ee79f`; production baseline: `4c6eeb8`. Same scoped source change applied independently to retain existing environment configurations.

Hosted staging and production results will be recorded after deployment. These local checks do not claim a social-network cache has refreshed.

### Hosted packaging repair

The first staging rollout (`4f93026`, build/rollout `2026-10-22-001`) served correct page metadata but returned 404 for public images and the web manifest. The same legacy public asset failures were reproduced on unchanged production. This matches Firebase App Hosting adapter [issue #630](https://github.com/firebase/apphosting-adapters/issues/630) / [fix #683](https://github.com/firebase/apphosting-adapters/pull/683): a partially traced public directory can cause remaining files to be omitted. The managed adapter version was not established.

Added `outputFileTracingIncludes` for `./public/**/*` in `next.config.ts` to include the finite 1.5 MB public directory in server traces. No environment settings or runtime business logic changed. A fresh standalone production build passed; all 21 public files were present with matching hashes, and all 21 were fetched successfully from the standalone server with exact source bytes. Hosted checks are repeated on the repaired staging release before production promotion.
