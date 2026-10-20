# SPRINT-0004 identity lane — Luna implementation result

**Status:** Implemented locally; coordinator review required  
**Checkout:** `/tmp/docketstamp-replacement-20261020/identity`  
**Starting revision:** `fe52dcf856e9b528187e5b246312e58fa6017ad7`

## Changes

- Firebase Admin now resolves the trusted project from the registered DocketStamp environment configuration before token verification. It rejects project identity conflicts and pre-existing Admin apps configured for another project. JWT audience is never read to choose a project.
- Firebase Admin ID-token verification requires signature/issuer/audience/expiry checks and revocation checking. Returned claims are checked against the selected project. Verification exceptions fail closed; there is no decoded-claim reconstruction path.
- Offline `mock_token_` acceptance requires an explicitly installed verifier, `NODE_ENV=test`, and `FIREBASE_AUTH_TEST_VERIFIER=true`. Each token request rechecks the opt-in and hosted/production markers. Firestore mocks and fallback mocks are also rejected in hosted and production runtimes.
- Admin sessions now use `docketstamp_admin_session`. Login and logout expire `smn_admin_session`; the legacy cookie alone cannot authorize a request. HMAC signing, eight-hour expiry, authorized email checks, and the weak-secret blocklist remain in force.
- Offline account/admin fixtures now opt into the explicit verifier and use registered DocketStamp project IDs. Added trust-boundary and cookie migration tests.

## Validation

Passed:

- `node --import tsx --test tests/firebase-auth-trust.test.ts` — 4 tests, including configured-project selection, wrong project/issuer, expiration, verifier exception/forgery, revocation, hosted/production mock rejection, and legacy-cookie invalidation/clearing.
- `node --import tsx --test tests/firebase-auth-trust.test.ts tests/firebase-config.test.ts` — 10 tests.
- `node --import tsx tests/admin-account-binding.test.ts` — 22 checks.
- `node --import tsx --test tests/s5-delivery-and-payment.test.ts` — 18 checks, including the production mock-Firestore guard.
- `node scripts/test-admin-console-offline.cjs tests/admin-console/s0-safeguards.test.ts tests/admin-console/config.test.ts tests/admin-console/outbound-email.test.ts` — all three isolated suites passed.
- `node --import tsx tests/transaction-security.test.ts` — 10 checks.
- `node --import tsx tests/payment-mode-safety.test.ts` — 26 checks.

Limits observed:

- `./node_modules/.bin/tsc --noEmit --pretty false` still fails on existing repository diagnostics in retired card/Handwrytten tests, missing legacy modules, and unrelated test contracts. No diagnostics remained in the changed Firebase Admin or new trust-test/helper files on the last run.
- `npm run build` cannot fetch Inter, JetBrains Mono, and Merriweather from `fonts.googleapis.com` in this restricted network, so a production build could not complete.
- `node --import tsx --test tests/s7-release-candidate.test.ts` reports 37/38 passing; its existing checkout accessibility assertion for `aria-invalid` fails outside this lane.
- The historical `tests/security-review-remediation.test.ts` cannot run in this checkout because it imports removed `lib/handwrytten`; it also has unrelated legacy type errors.

## Read-only identity provenance requirements

Before any migration, prepare a read-only inventory for the two DocketStamp Firebase projects only. Record project, collection, aggregate record count, distinct `userId` count, and per-UID order/address reference counts without exporting notice content, addresses, or unrelated customer records. Treat missing or conflicting owner references as unresolved. Any proposed UID mapping must be supported by an independently verified account-authentication event or an explicit user-approved relink; matching email alone is insufficient. Keep old/new UID mapping evidence access-controlled, checkpoint any later approved migration, and do not change customer/order data as part of this sprint.

No cloud access, customer-data reads, identity linking, deployment, payment, or postal action was performed.
