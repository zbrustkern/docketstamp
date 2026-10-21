# Firebase key hygiene

Firebase browser keys are public in shipped JavaScript, but literal values must not be checked into this repository or deployment evidence. Production and staging each use their own `firebase-web-api-key` Secret Manager secret, granted only to their App Hosting build/runtime service identities. Both manifests inject it for BUILD and RUNTIME.

`lib/firebase-config.ts` pins each key's SHA-256 fingerprint to its registered Firebase project. A wrong-project key fails before initialization. Browser initialization requires the key; server identity verification does not require a browser credential. For local development, retrieve the staging value into the ignored `.env.local`; never use the production key on localhost. After replacing a key, update its fingerprint and secret version together, rebuild, verify, and then revoke the old value if appropriate. Do not print keys in diagnostics.

## Project controls

On 2026-10-21 both DocketStamp browser keys were restricted to Identity Toolkit, Secure Token, Firebase Management, and Cloud Logging APIs. Only explicit deployment domains are allowed; localhost is staging-only. Referrer restrictions reduce misuse but are not authentication and can be spoofed by non-browser clients.

Both deployed Firestore rulesets deny all direct client reads and writes. The identical policy is tracked in `firestore.rules`. Server Admin requests use IAM and application authorization. Both projects have improved email privacy enabled and no listed Cloud Storage buckets. App Check is not integrated; do not enable enforcement without implementing and testing the client first. Broad pre-existing service-account roles need a separate least-privilege review before removal.

## Verification and prevention

Run `npm run audit:credentials`, `npm run test:firebase`, and the authentication trust tests. Inject the selected project's key and identity into the process and run `npm run verify:firebase-auth` for a live project/domain check. Never put credentials in shell arguments. Also verify a legitimate referrer succeeds, an unrelated referrer fails, invalid refresh tokens are rejected, and unauthenticated Firestore access fails.

The credential-hygiene workflow checks the current files and HEAD ancestry, logging locations only. It detects Google keys, private key blocks, live Stripe secrets, and GitHub tokens; it supplements GitHub secret scanning and push protection, rather than replacing a comprehensive secret scanner.

## Rewritten history

A history rewrite changes commit IDs. Old clones and worktrees must be rebased carefully or replaced with fresh clones; merging an old branch can restore the removed history. Never force-push an old clone or merge pre-cleanup histories. Preserve uncommitted work as a private patch, then apply it onto clean history and rescan. Existing GitHub commit links, cached views, and copies outside this repository may still contain old values. GitHub Support controls cache removal and may decline removal for public Firebase configuration. Historical deployment evidence has key fields redacted and is no longer byte-identical to its original capture.

The older SendMyNotes keys belong to other applications and were not revoked or modified as part of DocketStamp hardening.
