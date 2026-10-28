# Robustness staging release

User authorization: “can you push this to staging please?” on October 27, 2026.

Target: Firebase project `docketstamp-staging`, App Hosting backend `docketstamp`, environment `staging`, public origin `https://staging.docketstamp.com`. GitHub `staging` is the configured automatic rollout branch. Production `main` is outside this release.

## Preflight

- Remote `staging` and the local candidate base both equal `9b852c0ebf461fbd2e6ca4d8ea1dc178579cbdae`. The serving rollback build is `build-2026-10-22-003`, source `614899b3364b13bdd6f3b27185e1d230a690bd35`, with 100% traffic. See [before.json](before.json).
- The intervening October 26 rollout failed before replacing traffic because inherited `LOB_ADDRESS_VERIFICATION_KEY` referred to missing `lob-secret`. The staging override uses the non-secret `staging_mock_cass_unused` placeholder; `LOB_ENV=staging_mock_cass` uses deterministic verification. Production YAML is unchanged. The first robustness rollout (`76f4cf7`, build `build-2026-10-27-001`) rejected an empty-string override as invalid hosting YAML before changing traffic; the nonempty placeholder corrects that configuration.
- A dedicated staging address-evidence signing secret was generated in memory, stored in staging Secret Manager and granted to the existing staging backend using the Firebase CLI. Its value was not printed or written locally. The staging manifest binds it at runtime only.
- The staging Stripe secret, publishable key and Lob dispatch key were checked in memory and classified as test keys. Backend access to each required secret was checked through IAM metadata. Only classifications/references are recorded in [config-preflight.json](config-preflight.json).
- Nine new Firestore composite indexes were submitted with `firebase deploy --only firestore:indexes --project docketstamp-staging`. The project had no existing composite indexes, so none were deleted. Readiness is recorded in [indexes.json](indexes.json).
- The full offline `npm test` suite passed again (268 TAP tests plus standalone checks). The subsequent manifest regression passes in the 8-test Firebase configuration suite. The prior exact-source optimized build passed; the hosting build will validate the final manifest and candidate.
- The supplied lesson/catch-up source documents remain local and untracked. Candidate code, authored design/chapter and implementation evidence are committed for review. No payment, postal dispatch, external email, customer data migration or scheduled worker is part of release verification.

## Promotion and verification

Commit the tested candidate and push only `HEAD:staging` without force. Observe the automatic rollout before considering an explicit one, to avoid duplicate builds. Record the exact candidate SHA, successful build/rollout, traffic and revision, index readiness, effective public staging configuration, signing bindings and public smoke results after completion.

Provider proofs, real postal delivery, interactive account sign-in, iOS acceptance, operator recovery cadence and measured commercial uplift remain the separate gates described in [RESULT.md](../RESULT.md). A staging rollout does not satisfy production release acceptance.

Rollback, if needed, must target the known ready staging build above and preserve durable payment facts, snapshots and accepted provider IDs. Never blindly retry an uncertain mailing.

## Verified completion

- Deployed source: `a6f36854c8403f78d645e8e4e71d1d1fbee3376e` (robustness implementation `76f4cf7` plus the hosting placeholder correction).
- App Hosting build `build-2026-10-27-002` reached `READY`; rollout `rollout-2026-10-27-002` reached `SUCCEEDED`. Cloud Run ready revision is `docketstamp-build-2026-10-27-002`; App Hosting traffic assigns 100% to that build. The ready condition succeeded at `2026-10-27T15:24:27.001996Z` (10:24 a.m. America/Chicago). See [after.json](after.json).
- All nine required indexes reached `READY`; [indexes.json](indexes.json) records their final state. Both dedicated signing and Stripe webhook signing reference enabled staging secret versions. Runtime environment, app origin and Firebase project remain staging; Lob remains `staging_mock_cass`.
- All 13 [public smoke checks](smoke.json) passed: home, notice workspace, admin/account shells, favicon, noindex, served new client UI and registered staging web identity; synthetic CASS returned signed revision-bound simulated evidence; fitness input remained blocked; a nonexistent scoped attempt returned 404. No order, payment, mailing or email was created. The verifier retains classifications and chunk hashes, not secret/proof tokens or customer values.
- Browser review confirmed the deployed notice workspace mounts with the address verification controls, physical sheet and form. A [screenshot](workspace.jpg) records the empty test draft. Interactive account/admin sign-in and provider-backed end-to-end payment/dispatch were not performed.
- Remote `staging` equals the deployed SHA. Remote production `main` remains `b66b69956eae54f59e3ef608be29207d7b143f45`, matching preflight; no production backend/configuration was changed.

The final verification files are local release evidence added after the source push. No redundant documentation-only staging rollout was started.
