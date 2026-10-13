# Quick repository security review — October 13, 2026

Reviewed working tree at `c01908f`. This is a source review with isolated local checks, not a production penetration test or evidence of compromise. No application code was changed, production endpoints called, fulfillment scripts run, or orders dispatched. Existing unrelated changes were preserved.

## Secret exposure assessment

- Scanned tracked files and additions across 114 reachable commits for recognizable Stripe secret/restricted keys, webhook secrets, Google API keys, private-key material, GitHub tokens, and AWS access IDs. No real Stripe/webhook/private-key credentials were found by those patterns. The private-key marker in `.env.example` is a placeholder.
- Compared five nonempty local server secret values against tracked files, historical additions, and 123 files under `public` and the available `.next/static` tree: no matches. Local build assets do not establish what production serves.
- `.env.local` is ignored and untracked. Only `.env.example` is tracked among environment files. Runtime provider secrets in `apphosting.yaml` use Secret Manager references.
- A historical Firebase browser API key appears in `lib/firebase-client.ts` at commit `ce34d8c1f079`. Firebase configuration is intentionally public; confirm this key is restricted to the necessary Firebase APIs and cannot authorize Gemini or other billable services. See [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).
- There **is** a hardcoded admin fallback credential; see finding 2. No actual secret values are reproduced here.

Pattern and exact-value checks do not prove that every unknown credential format, deleted ref, remote branch, deployment artifact, log, or private staging file is clean.

## Findings, ordered by urgency

### 1. High: unauthenticated account and reminder access

`app/api/account/route.ts:7` accepts caller-supplied `uid` or `email`, retrieves complete matching orders, and returns them without verifying a Firebase ID token. Knowing a customer's email is enough to request their notes, addresses, order identifiers, and view tokens. POST similarly trusts the supplied identity to update account data. GET can also create/update account records while importing addresses, allowing cross-account data contamination.

`app/api/reminders/route.ts:5` exposes reminders by supplied email/user ID; POST can overwrite a supplied reminder ID and DELETE deletes a supplied ID without checking ownership. Reminder records can include addresses and notes. The browser account page's signed-in state does not authenticate these server requests. Firebase Admin accesses the database with server privileges, so client Firestore rules do not repair these route-level checks.

**Fix:** verify Firebase ID tokens server-side; derive identity from the verified token and authorize each record. Use verified email ownership when linking guest orders. Preserve guest checkout with scoped capabilities rather than arbitrary email lookup. Remove writes from GET.

### 2. High, conditional on configuration: admin access fails open

`lib/admin-auth.ts:4` falls back to a known hardcoded passphrase when neither supported environment secret is present. That passphrase also works directly through `x-admin-key`, bypassing the login attempt limiter. `apphosting.yaml` contains no explicit admin secret binding; additional deployed configuration may exist and was not inspected.

An isolated check with an empty environment confirmed fallback-header authentication succeeds. It also confirmed a 30-day-old signed session is accepted: verification checks only the HMAC, not the timestamp. The eight-hour cookie lifetime is browser behavior, not server expiry. A malformed signature throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` instead of returning false; affected routes can return 500s.

**Fix:** reject admin access if the secret is absent, explicitly bind it for deployment, enforce payload format and server expiry, and check signature lengths before constant-time comparison. Rotate the admin secret if fallback access may have been used. Avoid using the same secret for both the login credential and session signing where practical.

### 3. High: free-order replay and discount races can create billable mail

`app/api/checkout/complete-free-order/route.ts:24` checks amount and discount validity but never rejects an already dispatched order or takes the paid-order transaction lock. Each eligible replay resets status, increments usage, and directly calls fulfillment. Concurrent calls can bypass a usage cap because validation and increment are separate; `lib/firebase-admin.ts:519` updates usage with a read/modify/write outside a transaction. The free path also does not pass the deterministic order ID to fulfillment.

**Fix:** use one atomic dispatch state machine for paid and promo orders; atomically reserve discount usage, bind the promo to the persisted order, require an order capability, and reconcile ambiguous supplier responses before retrying. Supplier idempotency guarantees remain unverified. Disable free completion until this is addressed if active free codes exist. No replay was executed.

### 4. High: cover input permits local path traversal and arbitrary server fetches

Checkout persists caller-supplied `frontImageUrl`. `lib/handwrytten.ts:147` joins it to `public` without checking containment. An isolated path calculation confirmed traversal can escape that directory. Fulfillment then reads the selected file and uploads its bytes to the supplier; there is no image validation before that upload. This can disclose server-readable files to a third party, though retrieval of those bytes by an attacker was not established.

`lib/handwrytten.ts:166` fetches arbitrary URLs with no host/IP allowlist, redirect validation, response-size limit, or timeout. This creates an SSRF and resource-exhaustion surface once fulfillment runs. Production metadata access was not tested. `next.config.ts` also allows image optimization from every HTTPS hostname.

**Fix:** accept approved preset IDs and server-generated artwork references. Enforce resolved-path containment; allowlist remote origins, block private/link-local destinations on every redirect, and bound image size, format, dimensions, and fetch duration. Narrow Next.js remote image patterns.

### 5. High dependency advisory: vulnerable image decoder

The lockfile pins `sharp` to `0.35.4`. The [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) fixes a librsvg memory vulnerability in `0.35.5`; possible remote code execution depends on Linux runtime conditions. Actual production exploitability was not tested. This merits prompt patching because image processing is a core feature and remote image origins are unrestricted.

**Fix:** update to a patched release and validate image processing. Until patched, block SVG decoding as described by the maintainer. Do not assume converting output to JPEG makes decoding arbitrary input safe.

### 6. Medium: order unlocking uses guessable information without throttling

`app/api/orders/[id]/route.ts:95` returns the complete order and permanent view token on either an email or ZIP match, without attempt limits. Public GET reveals the first three ZIP digits, reducing a five-digit ZIP search to at most 100 candidates for an attacker who knows the order ID. Cryptographically random order IDs reduce discovery but do not protect leaked/shared identifiers. Public redaction spreads the full order object and selectively masks fields, leaving other fields such as the greeting and sender name visible.

**Fix:** use possession of a strong capability or verified email challenge, throttle attempts, and define explicit minimal public response fields. Consider token expiry/rotation and private/no-store responses for sensitive records.

### 7. Medium: unauthenticated supplier webhook and admin test endpoint

`app/api/webhooks/handwrytten/route.ts:26` trusts posted supplier IDs, statuses, and tracking URLs without authenticating the sender. Anyone knowing an ID can falsify status or tracking data. The handler logs the entire payload, potentially including personal data. Authenticate according to verified supplier capabilities or fetch authoritative status server-side before accepting updates; validate tracking URLs and event transitions.

`app/api/admin/test-meta-capi/route.ts:9` lacks the admin guard used by other admin routes. It sends Purchase events using the server token. Without an enforced test-event code, these can contaminate live ad measurement. Add admin authorization and require explicit test mode. This does not directly return the access token.

### 8. Medium: abuse controls and secret/error logging need strengthening

AI generation and telemetry limits use per-process memory despite up to ten hosting instances. IP identity takes the first forwarded value without a documented trusted-proxy contract; spoofability depends on the hosting edge. Checkout, feedback, discount validation, and reminder writes lack comparable controls and several lack explicit length/body limits.

Use shared limits, verified edge IPs, bounded schemas and budgets. `logIncident` redacts only some patterns in `technicalDetails`; raw errors are logged before redaction, and summary/metadata are not scrubbed. Several routes return raw exception messages. Centralize redaction before every log/persistence sink and return generic public errors. Actual log exposure was not inspected.

## Dependencies and existing protections

Read-only npm audit completed: **23 flagged package entries: 12 high, 11 moderate, zero critical**. These include transitive propagation, not 23 independently exploitable flaws. Build-only packages and runtime-specific conditions require reachability assessment. Do not blindly run force-fix: suggested changes include major upgrades and a Firebase downgrade.

Locked/installed Next.js is `15.5.26`, despite the older minimum in `package.json`. Audit reports two moderate cache-poisoning advisories fixed in `15.5.27`: [first maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676), [second maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p). Hosting/cache applicability needs verification. Other flagged chains include Firebase/gRPC, Firebase Admin/Google Cloud libraries, and build tooling.

Good existing controls: Stripe webhook signature verification fails closed; paid confirmation checks Stripe status, amount, currency and production live mode; paid dispatch uses a Firestore transaction lock; test paid orders skip live fulfillment; new order IDs/view tokens use cryptographic randomness; admin cookies are HttpOnly, Secure in production and SameSite Strict; telemetry rejects browser purchase-authority events and sanitizes metadata/URLs.

The existing transaction-security test calls fulfillment without test context, so it was deliberately not run. No deployment, Firestore/Storage rules, IAM, API key restrictions, production secret bindings, access logs, supplier webhook capabilities, or physical marketing photos were verified. Those remain separate checks, not passed controls.

## Suggested remediation order

1. Close account/reminder authorization; ensure admin secret is configured and remove fallback access.
2. Prevent promo replay/usage races; patch sharp; restrict cover sources and local paths.
3. Authenticate supplier callbacks and Meta testing; replace ZIP/email unlocking with stronger verification.
4. Patch remaining reachable dependencies, add shared abuse limits and centralized logging hygiene, then verify production bindings and database/storage permissions.
