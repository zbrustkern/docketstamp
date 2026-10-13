# P0 checkout initialization incident: expired Stripe credential

**Investigated:** October 13, 2026.
**Status:** Root cause verified; credential/deployment repair pending.
**Repository inspected:** `c01908f`.
**Production:** `sendmynotes-build-2026-10-13-009`, service `sendmynotes`,
project `sendmynotes-2a417`, region `us-central1`; 100% of service traffic.

## Executive finding

Paid checkout initialization is blocked by an expired Stripe restricted live API
key. The application chooses the expired managed secret over a different legacy
environment credential that still authenticates. This is a credentials and
deployment configuration incident, not a demonstrated artwork/preview failure.

Production logged the failure at **14:15:48 UTC / 9:15:48 AM Central**:

```text
POST /api/checkout/create-intent -> HTTP 500
[Checkout Intent Error] Expired API Key provided: [REDACTED]
```

This is the latest matching production error found. Without a customer request ID
or the founder's attempt time, it cannot conclusively be tied to their particular
browser session. Independent checks nevertheless prove that the currently
selected production credential is expired.

## Verified configuration and authentication evidence

| Item | Verified result |
| --- | --- |
| `STRIPE_SECRET_KEY` | Cloud Run references `projects/486379422282/secrets/stripe-secret-key`, version **1** |
| Managed secret version 1 | Restricted live key; read-only Stripe request returns **HTTP 401**, `code: api_key_expired` |
| Managed secret `latest` | Resolves to version **1**, the same expired credential |
| Legacy environment variable `stripe-secret-key` | Different literal restricted live key; read-only Stripe request returns **HTTP 200** |
| Selected credential | `normalizeStripeSecretKey()` prioritizes uppercase `STRIPE_SECRET_KEY`, so the working legacy value is ignored |

Authentication probes used `GET /v1/payment_intents?limit=1`. No transaction
payloads, personal information, key values, prefixes beyond key-type labels, or
key fragments are recorded here. A successful read proves authentication and
that endpoint's read access; it does **not** prove PaymentIntent write permission,
the intended account, matching frontend publishable key, or wallet readiness.

Stripe explicitly documents `api_key_expired` as requiring a current key and an
updated integration. See [Stripe error codes](https://docs.stripe.com/error-codes)
and [API key management](https://docs.stripe.com/keys).

## Why Review & pay fails

1. On the address step, the button calls `initializeCheckout()` in
   `app/preview/entry/client.tsx`.
2. That posts the selected artwork, note, and addresses to
   `app/api/checkout/create-intent/route.ts`.
3. The route calls `createCardPaymentIntent()` in `lib/stripe.ts`.
4. `resolvePaymentMode()` accepts the key's live restricted prefix. That validates
   its type, **not its current validity with Stripe**.
5. Stripe rejects the selected key. The route's generic error handler returns
   HTTP 500 and customer-safe payment-unavailable copy.
6. The client remains on the address step rather than mounting payment fields.

For the logged initialization attempt, failure occurs before order persistence
and before payment confirmation. No customer charge is initiated by this failed
PaymentIntent creation. The shared endpoint also serves ready-made purchases;
the blocker is not specific to AI-generated artwork. Free-code orders take a
different branch and are not proof that paid checkout works.

Server-side payment confirmation also uses `getStripeClient()` and retrieves a
PaymentIntent, so repairing only client UI configuration is insufficient.

## Immediate builder/operator recovery

1. **Validate the accepted live credential or create a replacement through Stripe.**
   The legacy literal credential is a candidate already known to authenticate.
   Confirm the intended Stripe account, live mode, and PaymentIntent create/read
   permissions before adopting it. Do not paste the value into source, chat,
   tickets, screenshots, or deployment command arguments.
2. **Update the authoritative managed secret.** Add a valid version of
   `stripe-secret-key` through the approved secret-management workflow. The
   currently deployed version and current `latest` are both expired; restarting
   the existing revision or merely selecting `latest` now will not repair it.
3. **Deploy the validated version via App Hosting.** Verify the resulting Cloud
   Run revision's actual `STRIPE_SECRET_KEY` reference and traffic allocation.
   Existing revision `009` is pinned to version 1; adding a secret version alone
   does not change that revision's configuration.
4. **Remove the conflicting legacy literal after the managed path is proven.**
   Keep one authoritative credential source. Do not permanently reverse precedence
   to conceal a stale managed secret.
5. **Verify the payment screen through the actual customer route.** With a
   synthetic controlled draft, require successful intent initialization, order
   persistence, and payment fields. Confirm both custom and ready-made designs.
   Do not submit a payment or trigger physical fulfillment as part of a basic
   configuration check. A later operator purchase test must explicitly account
   for payment and supplier dispatch.

Do not enable mock checkout, substitute a test key in the normal production
journey, bypass server payment verification, or replace failing initialization
with simulated success.

## Focused follow-up to prevent recurrence

- Add a deployment preflight against the **resolved deployment credential**, not
  just key-prefix checks or build success. A read-only authentication probe catches
  expiration; controlled test-environment intent creation separately verifies write
  permission. Retain sanitized results tied to the deployed revision.
- Classify Stripe `api_key_expired`/authentication failures separately from input
  validation, permissions, provider outages, and order-storage failures. Return a
  stable customer-safe error code; keep diagnostics private and redact all key
  fragments before logging or incident persistence.
- Preserve the customer's draft, show retry, and avoid claiming that repeated
  retries can resolve an invalid server credential.
- Add an integration regression with a mocked Stripe expired-key response. Assert
  no payment-step advance, no saved paid order, no fulfillment, and an accurate
  sanitized incident. Current key-format unit tests do not prove live credentials
  are accepted by Stripe.
- Record who rotated/expired the old key and when using Stripe's administrative
  evidence if available. This audit establishes current invalidity, not who caused
  it or the exact outage start time.

## Closure criteria

- New production revision selects a validated managed live credential.
- Read-only authentication passes; required write permission and account/frontend
  key compatibility are independently checked.
- Both custom-art and ready-made drafts reach an initialized payment screen.
- Error paths preserve the draft and never simulate a successful payment.
- Separate operator evidence verifies actual payment, confirmation, and fulfillment
  continuity; Apple Pay is not certified by an API authentication check.

This investigation made read-only production log/configuration/secret requests
and Stripe GET requests. It did not change credentials, deploy code, create
PaymentIntents/orders, submit payments, or call the supplier.
