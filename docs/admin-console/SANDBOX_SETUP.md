# Stripe + Lob + Firebase sandbox setup

Prepared October 19, 2026. Setup preparation is authorized; this document does not authorize production changes or rollout of incomplete console code. No secret values were retrieved, printed, written to repository files or sent through chat.

## Why a Secret Manager entry may not reach Firebase

Three separate things must agree: a secret/version exists in the **correct project**, `apphosting.<environment>.yaml` binds the exact application variable to it, and the **chosen backend** can access that secret. A serving revision also needs the resolved configuration. Console environment variables take precedence over YAML; stale overrides can mask a correct binding. App Hosting resolves/pins secret versions at build/rollout time, so merely adding a new version does not update an existing serving revision. See [Firebase configuration](https://firebase.google.com/docs/app-hosting/configure#store-and-access-secret-parameters).

The inspected production manifest binds only STRIPE_SECRET_KEY; webhook and dedicated Lob bindings were comments. The original staging manifest also bound only that Stripe secret. The local staging manifest now includes the additional references below. No cloud setting or deployment has been changed. The user confirmed sandbox backend `docketstamp` at `https://docketstamp--docketstamp-staging.us-central1.hosted.app`; the project is `docketstamp-staging` per the hosted URL and repository configuration. Production backend is also named `docketstamp`, in project `docketstamp`, served publicly through Cloudflare at `https://docketstamp.com`. Backend settings and IAM have not yet been independently inspected.

The user also confirmed public staging at `https://staging.docketstamp.com`. The local staging `NEXT_PUBLIC_APP_URL` now uses that canonical public origin; the Firebase-hosted URL above remains the backend address. Use the public staging origin consistently for browser sessions and operator actions, whose origin checks intentionally reject a different host.

The backend's **Environment name must be `staging`** to select `apphosting.staging.yaml`; a filename alone does not select it. Review Settings → Environment and any console overrides. [Firebase environment selection and merge rules](https://firebase.google.com/docs/app-hosting/multiple-environments#step-1-set-environment-name).

## Values to prepare in the sandbox project

| Application variable | Secret Manager ID in local staging manifest | Sandbox value / purpose |
| --- | --- | --- |
| STRIPE_SECRET_KEY | stripe-secret-key | Stripe sandbox/test secret key (`sk_test_…` or suitable restricted test key); checkout and read-only reconciliation access. |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | stripe-publishable-key | Matching account/sandbox's `pk_test_…`. Public configuration; must be available at **BUILD and RUNTIME**. |
| STRIPE_WEBHOOK_SECRET | stripe-webhook-secret | `whsec_…` from the exact sandbox event destination. Not an API key or an unrelated CLI listener secret. |
| LOB_DISPATCH_API_KEY | lob-dispatch-api-key | Lob **test_…** key only. Never use live dispatch credentials in sandbox. |
| LOB_WEBHOOK_SECRET | lob-webhook-secret | Secret configured for the sandbox Lob webhook; provider authentication format remains an S3 verification gate before enabling webhook-derived postal truth. |
| ADMIN_SESSION_SIGNING_KEY | admin-session-signing-key | Independently generated high-entropy random value, at least 32 random bytes. Do not reuse Stripe/Lob credentials or old default passphrases. |
| STRIPE_ACCOUNT_ID | ordinary server environment value | DocketStamp Stripe account ID (`acct_…`), non-secret; helps pin evidence to account. Add through backend runtime environment after confirming the account. |

`LOB_ENV=staging_mock_cass` is already in the staging manifest. It uses deterministic CASS validation and prevents live dispatch. A dedicated test dispatch key selects Lob's test API; without it the local adapter may be explicitly mock. This stage does **not** verify real-world CASS or physical USPS delivery. `LOB_ADDRESS_VERIFICATION_KEY` is not required for the initial deterministic sandbox phase. Do not add a generic LOB_API_KEY as a substitute for the two dedicated key variables; future real CASS verification uses its own credential and explicit authorization.

Stripe test/live keys are separate, and server keys must stay private. [Stripe key management](https://docs.stripe.com/keys). Neither Stripe Product/Price IDs nor `stripe:bootstrap` are necessary for the current PaymentIntent path: it supplies the tier amount directly. Do not run the bootstrap script here; it changes Stripe products, endpoints and domains.

## Stripe webhook destination

In the DocketStamp **sandbox/test account**, inspect existing event destinations first to avoid duplicates. Use `https://staging.docketstamp.com/api/webhooks/stripe`. If a staging destination already uses the Firebase-hosted URL, inspect and update that destination intentionally rather than creating a second delivery path. Production remains `https://docketstamp.com/api/webhooks/stripe` for its separate later live setup. Select events from **Your account** and **Snapshot payloads**: this handler consumes `event.data.object`; it does not implement thin-event resource retrieval. Preserve the account's existing API version until object compatibility is checked; code currently initializes Stripe with `2025-01-27.acacia`.

Events used by the current local implementation:

- payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, payment_intent.processing
- charge.succeeded, charge.refunded
- refund.created, refund.updated, refund.failed
- charge.dispute.created, charge.dispute.updated, charge.dispute.closed

Save that destination's signing secret in `stripe-webhook-secret`. Do not trigger a test checkout or resend events yet: the new integration is still under local review. Fee/refund/dispute reconciliation also needs permission to read events and associated charge/balance evidence; a restricted key missing those permissions is a visible gap, not zero cost. [Stripe destination/signature setup](https://docs.stripe.com/webhooks).

## Grant access without sharing secret values

Using Firebase CLI for secret creation can offer access/binding setup. If secrets were created in Google Cloud Console, grant access to the correct backend explicitly. The locally installed CLI confirms this command shape:

```sh
firebase apphosting:secrets:grantaccess stripe-secret-key --project docketstamp-staging --backend docketstamp
```

Repeat for each bound secret, using the real project/backend IDs. These commands change secret access; the user performs or explicitly authorizes them. No broad project-wide Secret Accessor grant is needed in this checklist. Check that each referenced secret has an enabled version. Never use `secrets versions access`, paste values into chat, or print runtime environment to diagnose this.

After reviewed code/configuration is ready, a **separately authorized staging rollout** picks up the bindings and public build-time values. Do not roll out the current interrupted worktree just to refresh secrets. Production bindings, keys and release remain a distinct later task.

## Verification after a permitted staging rollout

The new protected `GET /api/admin/console/config` returns configuration presence, key **types**, modes, revision/project and public build/runtime consistency; it never returns secret values or calls a provider. An authorized owner can use it to check:

- project/environment/backend revision are the intended sandbox;
- Stripe payment mode is `stripe_test`, compiled public mode is `test`, and compiled/runtime public configuration agrees;
- webhook signing and admin signing are configured;
- Lob dispatch mode is `test_api`, CASS mode is deterministic mock;
- no configuration-only indicator is treated as a connectivity/payment/physical-delivery result.

Then run the explicitly approved test-mode end-to-end verification with provider stubs/test APIs and correlate IDs. Confirm receipt, capture facts, obligation, Lob test evidence and report generation. Never use a live card, live Lob dispatch or customer outreach as a configuration probe.
