# Share-preview release validation

User approved the design and staging/production deployment on 2026-10-22.

- Main 1200×630, square 1080×1080, and cancellation images match the approved PNG hashes exactly; eight additional static cards cover the remaining canonical notice types.
- Existing SendMyNotes social and app-icon sources were replaced by the approved DocketStamp art and DS monogram. Source font licenses are bundled.
- Shared metadata uses canonical aliases, absolute environment URLs, static images, descriptive alt text, query-independent content and neutral private-page metadata. No notice, payment, policy, mail dispatch or environment configuration logic changed.
- Focused metadata/routing tests: 27 passed. TypeScript and production Next build passed. Independent local development HTTP QA: 1,227 checks passed. Final production-build HTTP QA: 1,231 checks passed, including home/directory/nine canonical letters, 38 aliases, three user agents, query sentinels, all image bytes and private metadata.
- `npm test` reached one pre-existing reminder failure: `tests/notice-deadline-reminders.test.ts:62` uses a fixed date and now receives `expired` instead of `scheduled`. Reproduced on unmodified production baseline `4c6eeb8`. All remaining test groups were run individually and passed; no unrelated reminder changes were made.
- Original dirty checkout is excluded. Staging baseline: `11ee79f`; production baseline: `4c6eeb8`. Same scoped source change applied independently to retain existing environment configurations.

Hosted staging and production results are verified below. These local checks do not claim a social-network cache has refreshed.

### Hosted packaging repair

The first staging rollout (`4f93026`, build/rollout `2026-10-22-001`) served correct page metadata but returned 404 for public images and the web manifest. The same legacy public asset failures were reproduced on unchanged production. This matches Firebase App Hosting adapter [issue #630](https://github.com/firebase/apphosting-adapters/issues/630) / [fix #683](https://github.com/firebase/apphosting-adapters/pull/683): a partially traced public directory can cause remaining files to be omitted. The managed adapter version was not established.

Added `outputFileTracingIncludes` for `./public/**/*` in `next.config.ts` to include the finite 1.5 MB public directory in server traces. No environment settings or runtime business logic changed. A fresh standalone production build passed; all 21 public files were present with matching hashes, and all 21 were fetched successfully from the standalone server with exact source bytes. Hosted checks are repeated on the repaired staging release before production promotion.

### Completed release

Completed 2026-10-22T16:55:07.953844+00:00. Staging serves `614899b3364b13bdd6f3b27185e1d230a690bd35` (build `build-2026-10-22-003`, successful rollout `rollout-2026-10-22-002`); production serves `b66b69956eae54f59e3ef608be29207d7b143f45` (build/rollout `2026-10-22-001`). Both have 100% traffic on the verified release. Staging passed 1,241 crawler/metadata checks plus 13 asset checks; production passed 1,230 plus 13. No failures or unavailable checks remain. All nine canonical notice types and 38 legacy aliases were checked. The wide, square and letter assets, icons, legacy image fallbacks and manifest fetch successfully with expected hashes. Production indexing and staging/private noindex metadata remain correct.

The delayed automatic staging trigger created a second build of the identical repaired commit after the explicit rollout; both completed successfully. The final serving staging build is recorded above. Production used its automatic rollout. No payments, dispatches or live policy changes were performed. Rollback sources remain staging `11ee79f` and production `4c6eeb8`, before this release.

The deployment checkout contained only this sprint's changes. All 213 pre-existing local files were checked, with no unexpected differences; pending homepage body changes and all earlier ledger entries are preserved. Release source changes are integrated in the original workspace. Evidence: `.delivery/runs/2026-10-22-share-previews/release/deployment-verification.json`, hosted HTTP/identity reports, standalone packaging checks, and `workspace-preservation.json`. The unrelated fixed-date reminder test failure remains documented above. Social-network cache refresh timing is external to this release.
