# CR-PLAN-002 review

**October 12, 2026. Verdict: proceed with remediation development after adding the corrections below. Production allocation remains conditional on verification.**

The plan addresses the nine findings and retains the agreed product direction.
The pasted “approved” label is not evidence that implementation or validation is
complete. This review does not initiate deployment, a transaction, or supplier mail.

## Required amendments

1. **Receipt contract and recovery.** The proposed `?viewToken=` URL does not match
   the existing receipt reader, which reads `token` or per-order session storage
   (`app/order/[id]/page.tsx:153`). React-only state also disappears on refresh and
   payment redirects. Use the existing separate per-order session token mechanism
   or an appropriate protected server session, outside the general draft. Avoid
   exposing receipt bearer tokens in landing-page URLs, analytics, or referrers.
   Test direct protected receipt access, authentication redirects, and refresh.
   Treat a local draft's completed bit as UI recovery state, not payment authority.

2. **Durable purchase ledger and session attribution.** Wire payment verification
   separately from supplier success. A paid customer whose fulfillment is delayed
   still made a purchase. Atomically deduplicate purchases by order/PaymentIntent,
   not a capped list of session IDs; two legitimate orders from one session must
   both count as orders while session conversion counts that session once. Save
   original session, experience and acquisition context on checkout. Recording
   analytics must not block payment acknowledgment or trigger a repeat dispatch.
   Test webhook/client-confirm races, retries, telemetry outages, two orders in
   one session, and exclusion across every dashboard/channel/cohort summary.
   Use server-controlled classification and an explicit configured founder-order
   exclusion set rather than scattered single-ID checks.

3. **Actual Express Checkout payment handling.** Mounting the element and observing
   readiness is not the complete integration. Implement provider confirmation,
   required submission/validation for the installed SDK, cancellation, failures,
   authentication/redirect return, and the same server-priced checkout snapshot
   used by card payments. Show the divider only when there are express methods;
   never leave users at an empty wallet block. Reconfirm SDK callback support and
   payment-method domain registration. Keep test-mode, provider-mock, real-device,
   and authorized live evidence distinct.

4. **Complete draft-schema migration and authoritative review.** Bump the draft
   schema version and update reducer, initial state, storage sanitizer/allowlists,
   migration, and UI bindings—not only the TypeScript NoteDraft interface. Persist
   selected occasion and every message part. Server-side validation must check
   the combined dispatched message and personal addresses. Replace or update
   checkout state when content/discounts change; old review state must not authorize
   a different order. A completed draft must recover the actual protected receipt
   and offer Send another card instead of merely disabling submission.

5. **A2 geometry on every output path.** 1275 × 1650 is correct for the trim size at
   300 DPI, not proof that the supplier upload includes the required bleed. Apply
   supplier template/safe-area requirements, control crop deliberately, and fix
   every compression fallback's ratio. The existing optimizer passes remote URLs
   through unchanged and local preset uploads may bypass it, so changing one resize
   leaves other fulfilled designs untouched. Test high-entropy fallbacks, presets,
   generated artwork, actual upload bytes, and the matching preview. Retain the
   Firestore size guard including base64 and other order fields.

6. **Real journey tests and truthful confirmation gates.** Add rendered/browser
   tests for the assembled flow, not source-string checks or pure helpers alone.
   Cover sympathy selection, explicit starter/Undo, complete refresh recovery,
   keyboard/one-action-bar behavior, wallet/card cancel and failure, changed order
   review, protected receipt, and paid-but-fulfillment-delayed. A confirmation error
   after a successful charge must reconcile that payment and must not invite another
   payment. Use actual server statuses; `FULFILLMENT_FAILED` in the plan is not
   currently the recoverable status used by the processor (`QUEUED_FOR_FULFILLMENT`).
   The initial G1/G2 gates do not replace payment/device/usability/release gates
   G3–G5. Customer acquisition allocation follows those checks, not build success.

## Documentation correction

The governing independent-review link currently points at the status report being
reviewed. Point it instead at
[the independent validator review](CONVERSION_REDESIGN_VALIDATOR_REVIEW_2026-10-12.md).

## Execution recommendation

No new broad planning cycle is necessary. Start privacy, occasion, draft and mobile
navigation fixes; begin wallet compatibility work concurrently with the other
remediation. Then finish payment authority, receipt recovery and output alignment.
Connect one shared candidate through homepage, `/new`, and relevant occasion/ad
routes with consistent feature-flag and attribution behavior. Preserve the preview
as a harness and leave production allocation unchanged until the gates pass.
