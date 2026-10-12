# Independent review of CR-VAL-001

**October 12, 2026 — inspected commit 3a03508 on cr/integration.**

## Verdict

The product direction is consistent with the canonical founder decisions and the
integration is real progress. Continue implementation. The branch is not ready for
production allocation; several “implemented and verified” claims in CR-VAL-001
exceed the evidence in the code. No deployment or live transaction was performed
as part of this review.

## Independently checked

- Four implementation branches are merged into cr/integration.
- `/preview/entry` now connects card, note, address, payment, and confirmation
  components rather than stopping at the old note placeholder.
- Custom artwork launcher connects to the existing generation drawer.
- Payment-mode safety, browser authority-event rejection, shared product facts,
  and draft-storage modules are present.
- Reran all 12 test programs listed in the report, using an isolated committed
  snapshot with service credentials removed and test mode enabled: all passed.
- TypeScript no-emit check with incremental writes disabled: passed.
- Did not independently rerun the production build, real-device matrix, browser
  screenshots, or physical fulfillment. The existing tests do not render and
  exercise the newly assembled EntryPrototypeClient end to end.

## Findings requiring correction before release

### 1. Purchase measurement is not fully connected (P1)

`recordServerTelemetry` is defined in `lib/metrics-rollup.ts:396` and invoked only
by its test, not by payment/order processing. The preview success handler still
emits browser `payment_succeeded` (`app/preview/entry/client.tsx:549`), which the new
public telemetry route rejects. Thus rejecting spoofed events does not by itself
establish a working verified-purchase funnel.

The rollup still counts `inside_note_edited` as note completion
(`lib/metrics-rollup.ts:151`). Order-derived revenue and paid counts at
`lib/metrics-rollup.ts:586` do not exclude tests/comps/founder orders. Deduplication
uses capped session lists and paid sessions rather than a durable per-order
purchase ledger. Wire server outcomes, define proper completion semantics and
eligible customer cohorts, and validate real callers/replays. AddPaymentInfo also
still fires on payment-step initialization (`app/preview/entry/client.tsx:483`).

### 2. The selected occasion can produce the wrong message (P1)

`currentCard.occasion` uses the URL occasion or first preset's occasion rather
than the selected preset (`app/preview/entry/client.tsx:180`). Continuing to note
inserts the initial/first preset's default message (`:358`) rather than a starter
for the currently selected card. A visitor selecting a sympathy or thank-you card
on the generic page can therefore receive birthday context and wording. Resolve
occasion from the actual selection, preserve custom-art occasion, and make starter
insertion an explicit choice.

### 3. Full draft recovery is not implemented (P1)

Greeting, sign-off, and step are separate React state. Greeting/sign-off initialize
to “Dear Eleanor,” and “Warmly, Thomas” (`app/preview/entry/client.tsx:74`), while
recipient/sender have fictional default names (`:79`, `:88`). These strings are
included in dispatch text (`:402`). Refresh can restore the body and addresses but
reset the greeting/sign-off, changing what the sender intended. Remove fabricated
live values and persist/recover every user-authored message part. Define safe
recovery after payment to prevent an accidental second checkout after refresh.
The 66 storage assertions do not establish this whole-flow behavior.

### 4. Wallet integration remains incomplete (P1)

`Step4ReviewAndPayment` imports and mounts PaymentElement, not ExpressCheckoutElement
(`components/v3/Step4ReviewAndPayment.tsx:7`). No dedicated wallet availability
callback/event is implemented. PaymentElement may expose eligible methods, but
that does not fulfill the planned wallet-first flow or prove actual Apple Pay
completion. Implement and test provider-controlled wallet rendering plus the card
fallback. Keep Apple Pay marked unverified until actual context-specific tests pass.

### 5. Receipt and fulfillment confirmation need server state (P1)

The create-intent response returns `viewToken`, but the new preview client does not
store/pass it. Protected guest receipt continuity is therefore not established.
The paid submission calls confirm-order without inspecting its HTTP result before
calling onPaymentSuccess (`Step4ReviewAndPayment.tsx:259`). Step5Confirmation shows
“In Production” statically (`components/v3/Step5Confirmation.tsx:217`) without
loading actual fulfillment state. Distinguish payment received from queued/failed
fulfillment, preserve protected receipt access, and recover correctly after refresh.

### 6. Grid proportions do not complete A2 output alignment (P1)

The grid is 17:22, but `lib/image-optimizer.ts:27` still produces 1500 × 2100 artwork,
and `components/CardPreview.tsx:169` and related surfaces still use 5:7. R3 remains
partial. Apply supplier-approved crop/bleed and preview geometry to the actual
uploaded output; validate text wrapping rather than treating the app character
limit as physical proof.

### 7. The assembled mobile shell has duplicate fixed action bars (P2)

The preview renders the shared ActionBar and mounts reused note/address components
that already have their own mobile fixed bottom bars (`Step2NoteComposition.tsx:528`,
`Step3EnvelopeAddressing.tsx:487`). Both use bottom-0/z-40. Remove the duplicated
bars, then verify visibility, keyboard behavior, focus, and one clear next action
on actual devices. Component existence/build success does not establish this UX.

### 8. Custom prompt text is sent to Meta (P1)

`app/preview/entry/client.tsx:232` uses the first 30 characters of the customer's
custom-art prompt as Meta event contentName. A prompt can contain names or other
personal content. Local telemetry sanitization does not protect a separate Meta
Pixel call. Use a fixed non-personal content label and a non-personal category;
never transmit the custom prompt as marketing telemetry.

### 9. Route and claims rollout remain unfinished (P1)

The homepage/router and `/new` still select the old TargetPurchaseExperience or
legacy builder rather than EntryPrototypeClient. Route wiring is correctly listed
as unfinished in the report, but its S1-02 completed label is premature.
`VendingMachineBuilder.tsx:648` still advertises 120 lb stock and mailing today;
`CheckoutStep.tsx:428` still says 5×7. A&B remains in the legacy sender UI. Preserve
A&B physically, but finish the promised sender-route cleanup and truth corrections
before calling them complete. Verify occasion landing routes too.

## Recommended next increment

First correct selected-occasion/message behavior, fabricated values and draft
recovery, duplicate mobile actions, and prompt leakage. Then complete real purchase
measurement, wallet behavior, receipt/fulfillment state and A2 output alignment.
Integrate routes behind the candidate flag once the assembled journey passes
specific end-to-end checks.

Required tests should cover: select a non-birthday card on the generic landing;
refresh after editing greeting/sign-off and addresses; pay/cancel/retry; missing
wallet; paid-but-fulfillment-failed; protected receipt refresh; duplicate payment
callbacks; candidate route attribution; no prompt content in Meta events.

Finally review 320/375/390/430-pixel screenshots and real-phone keyboard/wallet
results, perform representative sender usability tasks, and release a reversible
candidate. Do not substitute unit-test totals for completion of G3–G5.

## Commercial assessment

Clearer entry, reachable next actions, personalization, truthful pricing, and
recoverable drafts are credible conversion improvements to test. They do not yet
prove demand, ad intent, trust, or willingness to pay. Success remains independent
paid and fulfilled orders, correctly measured by eligible traffic cohort, with
actual acquisition cost and margin. Keep spend decisions separate from build
completion and do not promise a conversion uplift before observing customer data.
