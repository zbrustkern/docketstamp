# Account address prefill privacy fix

Implemented in the isolated orders clone from the coordinator's current account-prefill helper/component base.

`stageNoticePrefill` in `lib/account/notice-prefill.ts` posts the selected saved address, sender, and canonical notice fields to the existing `/api/docket/stage` endpoint. It validates the returned stage ID, slug, and route and returns only a same-origin relative notice path with the opaque stage ID. `NoticePrefillChooser` now navigates only after a successful stage call; failures display an error while leaving the chosen notice and address props available for retry.

Validation: `NODE_ENV=test node --import tsx --test tests/account/notice-prefill.test.ts` passed (3 tests), including endpoint persistence/retrieval of the exact address-field payload, no PII in the review URL, rejection preserving input values, API failure, malformed stage IDs, and unexpected routes. `npx tsc --noEmit` reported existing unrelated baseline errors in legacy suites, Stripe fixture typing, and previously deleted modules; it reported no errors in the changed helper, chooser, or new test.

No external calls or real personal data were used. The existing staging endpoint retains drafts under its documented seven-day TTL; no new endpoint or retention behavior was added.
