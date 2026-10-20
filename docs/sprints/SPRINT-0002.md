# Sprint 0002 — Admin Outgoing Email Composer

**Status:** Implementation complete; staging release blocked on staging secret-access approval and verification  
**Run:** `2026-10-19-admin-outgoing-email`  
**Authority:** `AGENTS.md`, `DOCKETSTAMP_MASTER_BUILD_SPEC.md`, `DOCKETSTAMP_AGENTIC_EXPANSION.md`, admin console auth/audit contracts

## Objective

Add a small owner-only plain-text email composer to the existing DocketStamp admin panel. Admin correspondence must use the server-side Resend API with fixed sender and reply-to addresses, durable environment-scoped history, request idempotency, validation, and honest provider outcome reporting. Automatic application email behavior remains unchanged.

## Acceptance criteria

1. Only an authenticated human admin with the `outreach.send` capability and owner role can read history or send. Mutations reuse the admin origin check and audit trail.
2. The form accepts one To address, a subject, and plain-text message within bounded lengths. From is fixed to `Zeke at DocketStamp <zeke@docketstamp.com>` and Reply-To to `zeke@docketstamp.com`.
3. `RESEND_API_KEY` is runtime-only and bound only in `apphosting.staging.yaml`. No key reaches client code or responses. Missing configuration fails closed.
4. Each request reserves a durable, environment-scoped idempotency record before provider submission. Retries with the same request ID and content do not call Resend again; changed content conflicts. Resend receives a stable `Idempotency-Key`. Transport ambiguity is retained and surfaced as uncertain.
5. Sending is rate limited to five requests per actor per environment per hourly window. History is scoped by environment and records recipient, subject, request time, status, and Resend ID, but not message text. The UI distinguishes provider acceptance from delivery confirmation.
6. The admin page warns that sending creates real outbound email, directs routine tests to Resend's designated test recipient, and notes that reply forwarding is unverified. No DNS changes or actual outbound messages are part of this sprint.
7. Tests cover permissions, origin, role, input validation, request idempotency/conflicts, rate limiting, missing key, provider timeout/uncertain outcome, and content-free scoped history. Build and available type checks are recorded below.
8. Stage code and verify the protected route/UI on the staging deployment without sending outreach. Do not change production infrastructure or deploy to production.

## Implementation and evidence

| Check | Result | Notes |
| --- | --- | --- |
| `node scripts/test-admin-console-offline.cjs tests/admin-console/outbound-email.test.ts` | Pass | Offline mock Firestore; provider transport denied. Permission, origin, role, validation, idempotency, changed-content conflict, rate limit, missing key, timeout, and history checks pass. |
| `npm run build` | Pass | Next.js production build, generated types, and route compilation succeeded; `/api/admin/outbound-email` is dynamic. |
| `npx tsc --noEmit` | Existing repository failures | No errors reported in changed application files. The repository-wide invocation reports existing missing modules and type errors across unrelated test files (for example missing `lib/seo-scenarios`, `lib/nano-banana`, and old order/test contracts). |
| Local UI inspection | Partial | `/admin` loaded and showed the account-bound sign-in gate. Authenticated composer inspection was unavailable without an authorized login; no session was fabricated. The browser also reported a pre-existing `/favicon.ico` public-file/page conflict, unrelated to this sprint. |
| `firebase apphosting:backends:list --project docketstamp-staging --json` | Pass | Confirms project `docketstamp-staging`, backend `docketstamp`, environment `staging`, region `us-central1`, and runtime service account `firebase-app-hosting-compute@docketstamp-staging.iam.gserviceaccount.com`. |
| `firebase apphosting:secrets:grantaccess resend-key --project docketstamp-staging --backend docketstamp --location us-central1` | Pass | Firebase CLI reported IAM bindings set on `resend-key` for the staging backend. Backend service account: `firebase-app-hosting-compute@docketstamp-staging.iam.gserviceaccount.com`. |
| `firebase apphosting:secrets:describe resend-key --project docketstamp-staging --json` | Pass | Secret metadata reports version `1` in `ENABLED` state. Secret payload was not read. |
| Push to `origin/staging` | Blocked | Automatic approval review rejected staging-branch push as sensitive code egress without trusted authorization for that exact push. No workaround was attempted. |
| Staging rollout and deployed route/UI check | Not run | Push was blocked, so no new source revision was deployed. No email was sent. |

## Release gate

The local staging manifest binds `RESEND_API_KEY` to Secret Manager secret `resend-key` with runtime-only availability. The staging backend's IAM grant succeeded and version 1 is enabled. The branch remains local because automatic approval review rejected the push; obtain approval for the exact push to `origin/staging`, then verify the staging rollout, effective revision, `ENVIRONMENT=staging`, and protected route/UI. Do not make a live send as a deployment check.

Reply forwarding to `zeke@docketstamp.com` remains a pre-existing unverified prerequisite. This sprint does not inspect or change DNS.
