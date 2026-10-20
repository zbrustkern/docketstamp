# Firebase Auth repair and rollout

Verified 2026-10-20 with Firebase's registered web SDK configuration and public Auth project configuration.

| Environment | Firebase project | Project number | Web app ID | Authorized website |
| --- | --- | --- | --- | --- |
| Staging | docketstamp-staging | 267056924276 | 1:267056924276:web:e8c64af5d4be3d57477321 | staging.docketstamp.com |
| Production | docketstamp | 937129689950 | 1:937129689950:web:f916267a40b9133dfcc5cf | docketstamp.com |

The full public configurations are in `lib/firebase-config.ts`; both deployment manifests supply those same fields at BUILD and RUNTIME. These are public Firebase web identifiers, not server credentials. The resolver deliberately rejects overrides that differ from the selected registered app. For key rotation, a custom Auth domain or an Analytics stream change, verify and update the configuration, manifests and tests together.

## Local verification

- `npm run test:firebase` checks project selection, conflicting overrides, existing-app reuse, manifest consistency and authentication notices without network calls.
- `npm run verify:firebase-auth` makes read-only requests to Firebase Auth and checks that each API key resolves to its expected project number and website domain.
- Obtain fresh authoritative web SDK values with `firebase apps:sdkconfig WEB <app-id> --project <project-id> --json`. Do not infer ownership by editing only the `projectId` string.

## Staging rollout

1. In Firebase project `docketstamp-staging`, inspect App Hosting backend `docketstamp`. Its environment name must be `staging`; the backend association was verified on 2026-10-20. Check that the live branch is `staging` and the selected revision contains this repair.
2. Inspect console-level environment overrides and remove or replace conflicting `ENVIRONMENT`, `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_APP_URL` and every `NEXT_PUBLIC_FIREBASE_*` value. Console overrides can supersede checked-in YAML. Use the complete registered staging identity, not production or predecessor-project values. Do not modify unrelated secrets. The complete override list has not been verified in this session because gcloud has no active account.
3. Keep `staging.docketstamp.com` in Authentication → Settings → Authorized domains in this same project. It was already present; adding it to another project is not the repair. Keep `authDomain` at the registered `docketstamp-staging.firebaseapp.com` unless a separate custom Auth hosting setup is intentionally implemented.
4. Build and roll out the repaired revision. `NEXT_PUBLIC_*` values are compiled into browser assets; a runtime-only setting or page refresh cannot replace an old compiled key.
5. Reload `/admin` with a fresh browser session and sign in with an authorized Google account. Confirm `/api/admin/auth` succeeds, the Firebase user token audience is `docketstamp-staging`, and the account API uses staging records. Inspect claims locally; never paste full bearer tokens or cookies into logs/evidence. Confirm an unauthorized account still receives access denied and logout clears authentication.
6. Confirm the customer Google sign-in flow also works. If blocked, inspect the actual Firebase error and web key restrictions for `https://staging.docketstamp.com/*`. The admin notice now identifies the actual origin/project and explains the already-authorized-domain/key-mismatch case.
7. Record deployment revision, effective public configuration, login result and domain-verifier output. No payment or dispatch is required to verify this repair.

## Production and rollback

Validate the production override set independently against the production row above before a separate reviewed rollout. Do not transfer staging values into production. Standalone Google Ads/GA4/Meta ownership and destinations remain separate audit work; the Firebase measurement ID does not automatically replace an advertising destination.

If a rollout rejects inconsistent configuration, correct the conflicting public overrides and rebuild. Do not bypass the consistency guard or authorize the old app project. Roll back only to a revision/configuration known to use the verified DocketStamp identities. Existing sessions created with a different Firebase project may require re-login; do not silently copy user/order ownership across projects.

Status: source repair and automated verification completed locally. No staging or production rollout has been initiated, and interactive login remains unverified until rollout.

Validation on 2026-10-20: Firebase regression 6/6, admin/account 22/22, payment-mode safety 26/26, and both online project/domain checks pass. Full default tests stop on a pre-existing docket renderer assertion (also reproduced at original HEAD). Typechecking has 63 baseline diagnostics and no new diagnostics.
