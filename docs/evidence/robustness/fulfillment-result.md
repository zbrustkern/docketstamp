# Fulfillment convergence result

## Changed paths

- `lib/admin-console/finance/authority.ts` now sends verified paid obligations through `dispatchAuthorizedObligation`. It retains payment facts and outbox entries when the attempt gate or postal dispatcher holds fulfillment, and marks the payment obligation consumed only after accepted dispatch.
- `lib/admin-console/postal/dispatch.ts` applies the checkout-attempt lifecycle gate while keeping historical orders without attempt metadata dispatch-compatible.
- `lib/admin-console/postal/attempt-store.ts` records accepted/uncertain/simulated order status with the attempt transition, exposes lock lookup for operators, and refuses reconciliation while a submission lease is still active.
- The accepted-attempt transaction now consumes its matching verified payment-obligation outbox and creates a deterministic `dispatch_accepted_effects` record. Recovery can repair a previously accepted lock against a still-processing payment outbox without another provider submission.
- `lib/admin-console/finance/authority.ts` claims deduplicated post-acceptance effects from that outbox. Completed payment obligations cannot be demoted by a later result write.
- `lib/admin-console/postal/free-authority.ts` advances the attempt to `free_authorized` atomically with its zero-value authorization fact.
- `app/api/admin/retry-fulfillment/route.ts` supports audited provider reconciliation and drains queued accepted effects on acceptance, reconciliation, or already-accepted replay; attention-required work returns an operator instruction without retrying it.
- `app/api/checkout/complete-free-order/route.ts` drains accepted effects after free dispatch and on already-accepted re-entry, without another postal submit.
- `lib/order-processor.ts` preserves paid confirmation/purchase telemetry and discount accounting after the durable outbox claim, then records accepted-dispatch status/tracking, receipt email, CAPI, fulfillment telemetry, Stripe metadata, incident resolution, and image-cache claim without performing another provider submission.
- `tests/fulfillment-convergence.test.ts` covers attempt dispatch gates, legacy compatibility, lease expiry and uncertainty.
- `tests/accepted-dispatch-recovery.test.ts` exercises paid crash recovery through `consumePaymentObligation`, plus free/operator-style accepted flows; it verifies follow-on deduplication and asserts no replay adds a Lob submission.

The Lob adapter already sends the stable `docketstamp_order_<orderId>` idempotency key. Uncertain responses and expired leases remain blocked until an operator records reconciliation; a captured checkout-race payment is kept as a financial fact and the `captured_exception` lifecycle state blocks postal dispatch.

## Checks

- Passed: `node --import tsx --test tests/fulfillment-convergence.test.ts`.
- Passed: focused `tests/admin-console/s2-finance.test.ts`, `tests/admin-console/postal-model.test.ts`, `tests/fulfillment-convergence.test.ts`, and `tests/accepted-dispatch-recovery.test.ts` through the offline harness.
- In the legacy replacement suite, the shared paid/free dispatch claims passed, including the one-provider-submission assertion. Two lock fixtures currently receive HTTP 400 because the checkout workstream now requires revision-bound address evidence; the checkout agent is coordinating those fixture updates. The disposable-cwd harness also lacks the suite's relative legacy JSON fixture, so that unrelated migration case cannot run through that harness.
- Passed: `npx tsc --noEmit --pretty false`.

## Remaining limitations

The accepted-effects outbox is durable and deduplicated. Paid, free, and audited operator accepted paths drain pending work; repeat paid/free/operator invocations can resume a still-pending entry without postal resubmission. No background worker was added. Receipt email, CAPI, metadata updates, telemetry, incident resolution, and cache claims remain best effort; if processing is interrupted or its lease expires, the entry becomes `attention_required` rather than replaying uncertain effects. The admin retry response directs operators to verify receipt delivery before manually resolving that state. Reconciliation of an accepted lock with no effects record also creates an attention-required entry because prior code may already have sent a receipt. The local-mock `confirm-order` path remains on the legacy processor because it has no verified capture fact; live/test Stripe captures use the shared dispatcher. No live Stripe/Lob calls, mail, email, deployment, or commits were performed.
