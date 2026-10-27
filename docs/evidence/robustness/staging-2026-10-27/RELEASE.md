# Robustness staging release

User authorization: “can you push this to staging please?” on October 27, 2026.

Target: Firebase project `docketstamp-staging`, App Hosting backend `docketstamp`, environment `staging`, public origin `https://staging.docketstamp.com`. GitHub `staging` is the configured automatic rollout branch. Production `main` is outside this release.

## Preflight

- Remote `staging` and the local candidate base both equal `9b852c0ebf461fbd2e6ca4d8ea1dc178579cbdae`. The serving rollback build is `build-2026-10-22-003`, source `614899b3364b13bdd6f3b27185e1d230a690bd35`, with 100% traffic. See [before.json](before.json).
- The intervening October 26 rollout failed before replacing traffic because inherited `LOB_ADDRESS_VERIFICATION_KEY` referred to missing `lob-secret`. The staging override now explicitly leaves that variable empty; `LOB_ENV=staging_mock_cass` uses deterministic verification. Production YAML is unchanged.
- A dedicated staging address-evidence signing secret was generated in memory, stored in staging Secret Manager and granted to the existing staging backend using the Firebase CLI. Its value was not printed or written locally. The staging manifest binds it at runtime only.
- The staging Stripe secret, publishable key and Lob dispatch key were checked in memory and classified as test keys. Backend access to each required secret was checked through IAM metadata. Only classifications/references are recorded in [config-preflight.json](config-preflight.json).
- Nine new Firestore composite indexes were submitted with `firebase deploy --only firestore:indexes --project docketstamp-staging`. The project had no existing composite indexes, so none were deleted. Readiness is recorded in [indexes.json](indexes.json).
- The full offline `npm test` suite passed again (268 TAP tests plus standalone checks). The subsequent manifest regression passes in the 8-test Firebase configuration suite. The prior exact-source optimized build passed; the hosting build will validate the final manifest and candidate.
- The supplied lesson/catch-up source documents remain local and untracked. Candidate code, authored design/chapter and implementation evidence are committed for review. No payment, postal dispatch, external email, customer data migration or scheduled worker is part of release verification.

## Promotion and verification

Commit the tested candidate and push only `HEAD:staging` without force. Observe the automatic rollout before considering an explicit one, to avoid duplicate builds. Record the exact candidate SHA, successful build/rollout, traffic and revision, index readiness, effective public staging configuration, signing bindings and public smoke results after completion.

Provider proofs, real postal delivery, interactive account sign-in, iOS acceptance, operator recovery cadence and measured commercial uplift remain the separate gates described in [RESULT.md](../RESULT.md). A staging rollout does not satisfy production release acceptance.

Rollback, if needed, must target the known ready staging build above and preserve durable payment facts, snapshots and accepted provider IDs. Never blindly retry an uncertain mailing.
