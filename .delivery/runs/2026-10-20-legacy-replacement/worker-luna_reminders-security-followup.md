# Order view authorization hardening

## Changes

- Replaced anonymous order serialization with an explicit status-only DTO containing only order ID, status, creation time, and a redacted flag.
- Full order views now require the secure view token, `verifyAdminAuth`, or a verified Firebase identity. A bound `userId` must match the verified UID; verified email association is allowed only for legacy orders with no bound UID.
- Reworked the legacy POST unlock endpoint to ignore email and ZIP as credentials and apply the same authorization rules as GET.
- Allow-listed authorized receipt fields and excluded view tokens, Stripe identifiers, frozen HTML, document-integrity signer data, printed messages, and internal account UID.
- Replaced the ZIP/email unlock form with secure receipt-link guidance and a verified-account access action. Pending-payment confirmation and purchase analytics now run only after a full authorized order response.
- Added endpoint tests for public redaction, secure-token access, verified owner and admin access, legacy guest email association, UID binding, and email/ZIP/unverified-token denial.

## Validation

- `node --import tsx --import ./tests/helpers/firebase-auth-test-verifier.ts --test tests/order-access-security.test.ts tests/wp4-verification.test.ts` — 14 tests passed.
- `git diff --check` — passed.
- A broader attempt including `tests/review-remediation.test.ts` could not load that suite because this sparse accounts clone does not contain `lib/card-presets`; the order security and WP-4 suites passed independently.
- A full TypeScript check in this clone remains noisy from pre-existing missing modules and stale type definitions; it reported no errors in the two changed application files. The temporary `lib/order-record.ts` copied from the orders lane for that check was removed and is not part of this change.

## Operational limits

- No email, scheduler, external service, or deployment was enabled or invoked.
- Secure receipt links continue to use the existing per-order `viewToken`; Firebase and admin verification use the existing configured server integrations.
