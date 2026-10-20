# Luna cross-lane review: authentication, reminders, and account

Review target: coordinator checkout `/Users/zeke/code/DocketStamp`, HEAD `22bf6c15e2b332c439d539b59455002eb7beada7`, current working-tree changes included. Scope was authentication, reminders, and account UX only; I am the author of the separately integrated order lane and did not review order changes here. This was a read-only review; no tests or live service calls were run.

## Findings

### P1 — Unverified email can receive an admin session

`app/api/admin/auth/route.ts:79-100` accepts any valid Firebase ID token whose email is on the administrator allowlist. It does not require `decoded.email_verified === true` before issuing the signed admin cookie. Email/password signup in `context/AuthContext.tsx:109-112` does not itself require verification. If an allowlisted address is not already claimed in Firebase, an attacker may register it, sign in before verifying ownership, and exchange that token for the admin session.

Repair: require a verified email claim before checking the allowlist / issuing the cookie, and add a test where an otherwise valid allowlisted token has `email_verified: false` and receives a rejection with no admin cookie.

### P1 — Unverified email can expose historical guest orders

`app/api/account/route.ts:70-80` queries all orders by `customerEmail === decoded.email` without requiring a verified email claim. Historical guest orders may have no matching `userId`, so an unverified Firebase account registered with an unclaimed buyer's email can retrieve that buyer's order records through `/api/account`.

Repair: allow UID-owned orders as today, but only run the email-based query when `decoded.email_verified === true`; add an API regression test proving an unverified token cannot retrieve email-only orders. Keep any POST account email ownership behavior consistent with that rule.

### P2 — Address prefill places full postal addresses in the URL

`lib/account/notice-prefill.ts:10-30` serializes recipient and sender names and street addresses into `field.*` query parameters. Account address-book links in `components/account/NoticePrefillChooser.tsx:25` use that URL. URLs commonly persist in browser history and request/access logs and can be sent in referrer metadata, so this exposes residential mailing data beyond the form state.

Repair: hydrate address fields through short-lived same-origin client state (for example, a session-scoped prefill keyed by a random nonce), then remove the nonce/query from the address bar before further navigation; retain the existing exact-field tests against the resolved draft rather than requiring PII in the URL.

## Review notes

The reminder API's ownership checks, explicit consent validation, HMAC unsubscribe confirmation flow (GET is non-mutating), transaction claim token, provider idempotency key, local-calendar scheduling, and operator delivery-enable gate are implemented coherently in the reviewed paths. The delivery gate intentionally means saved reminders do not send until an operator explicitly enables and schedules delivery. Account reminder dates are displayed as the exact `YYYY-MM-DD` supplied by the user with the selected timezone, avoiding browser-local date drift.
