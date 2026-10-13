# CR-VAL-002 release-readiness review

**October 12, 2026. Inspected cr/integration at 34dea0b.**

**Decision: preview/device testing may proceed; fix the items below before a
controlled live payment and customer front-end allocation.** This is a code review,
not deployment, real-device certification, or authorization for a transaction.

## Improvements confirmed in source

ExpressCheckoutElement and a confirm handler exist. Selected occasion, explicit
starter use, blank names, saved greeting/sign-off, removal of duplicate mobile
bars, static Meta custom-art labels, A2 optimizer targets, and homepage/new
candidate routing have implementation changes. Those changes are material progress.

## Unresolved items

1. **Guest receipt access still has a contract mismatch.** Step5Confirmation links
   to `/order/:id?viewToken=...` (line 332), but the receipt page reads `token` or
   `sessionStorage[order_token_<id>]` (lines 153–155). The new client sets the token
   only in React state. Neither the normal receipt click nor a payment redirect
   establishes the expected stored token. Fix the contract and keep bearer tokens
   out of analytics/referrers. Test guest receipt access after wallet/card redirect.

2. **Refresh recovery preserves flags, not checkout identity.** The client restores
   `draft.completed` and `currentStep`, but orderId/viewToken/clientSecret remain
   empty component state. A completed refresh can show confirmation with no order
   identity, and pay-step refresh cannot resume an initialized intent. Recover the
   actual protected order server-side; never treat a client completed bit as proof
   of payment. Also verify Clear draft and Send another card reset all related
   checkout/contact/message state. Require rendered refresh tests, not just tests
   asserting the reducer's completed flag.

3. **Post-payment reconciliation is still incomplete.** Both wallet and card paths
   log non-OK confirm-order results and then call onPaymentSuccess. Preserve the
   fact that Stripe charged the customer, but show a reconciling/pending state and
   retrieve server order status before showing fulfillment status or emitting
   final purchase marketing events. Do not present a new Pay action for an already
   succeeded PaymentIntent. Verify the paid-but-supplier-delayed and API-outage
   paths against real route behavior with mocked supplier dispatch.

4. **Wallet implementation needs actual environment testing and event wiring.**
   Availability uses `(window as any).trackEvent?.(...)`; the app imports trackEvent
   as a module and no global binding was found. Call the real telemetry function.
   The onConfirm handler calls confirmPayment directly; check and implement the
   submission/validation and error reporting required by the installed Stripe
   integration, then verify wallet cancellation, authentication, unavailable
   wallets, card fallback, and amount consistency. Primary reference:
   https://docs.stripe.com/elements/express-checkout-element/accept-a-payment?payment-ui=elements
   HTTPS and payment-method domain registration are required for this test setup.

5. **Purchase attribution/ledger does not yet satisfy the intended measurement.**
   Checkout does not persist the actual telemetry session/experience, so the order
   processor falls back to a synthetic `sess_<order>` identity for purchases.
   This separates purchases from the real visitor journey. The rollup's paid block
   requires both a new order and a new session before counting an order, so repeat
   purchases within one session are suppressed. Its summary is updated by a
   read/modify/write rather than an atomic per-order ledger transaction, allowing
   concurrent updates to lose counts. Use actual checkout session/experience
   context, separate order totals from converted-session totals, and durable atomic
   order deduplication. Test two orders in one session and concurrent confirmation.

6. **Route coverage is partial.** Homepage and `/new` mount the new candidate; both
   occasion `/send` route families still mount VendingMachineBuilder directly.
   Verify the actual ad destination and either route it through the shared candidate
   with occasion/attribution intact or explicitly retain it as baseline. Switching
   the homepage flag alone does not upgrade those visitor journeys.

## Verification limitations in CR-VAL-002

The remediation tests verify that SDK exports exist for wallet integration and
construct a sample `?viewToken=` string for receipts. They do not execute the real
wallet flow or demonstrate that the receipt reader accepts that parameter. Draft
recovery tests exercise memory storage/reducers rather than the assembled React
flow. This explains why passing tests coexist with the source-level gaps above.
This review did not independently rerun the report's production build or 13 suites.

## Test and release sequence

- Begin no-charge viewport, real-phone keyboard, navigation, and preview checks now.
- Correct and add behavioral regression coverage for the six items above.
- Use an HTTPS preview configured explicitly for Stripe test payments and isolated
  supplier fulfillment. A NODE_ENV=production build currently rejects test keys;
  document a safe preview-mode configuration rather than weakening production
  guards ad hoc or silently using live keys.
- Test wallet availability and cancellation, card declines/authentication,
  pre/post-payment refresh, changed amounts, guest receipt, and fulfillment delay.
  Record exact device/browser/app and observed result.
- Once those checks pass, the operator may perform an explicitly authorized
  controlled live order, marked as a test and reconciled in Stripe, the app, and
  Handwrytten. A real wallet test can incur a charge and physical mail; none was
  performed in this review.
- Then release the candidate behind the flag with a known rollback deployment and
  an intentionally limited, recorded allocation. Preserve pending-order processing
  when rolling back the front end. Expand only after observing correct paid and
  fulfilled orders and trustworthy journey data.

CR-VAL-002 supports progress toward a release candidate; it does not yet justify
its claim that all nine findings are fully verified or an immediate blanket cutover.
