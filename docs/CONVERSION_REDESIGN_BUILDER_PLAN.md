# Send My Notes: conversion redesign builder plan

**Prepared: October 11, 2026. Status: recommended design and implementation plan; not yet implemented or validated.**

Authority: [canonical project brief](CANONICAL_PROJECT_BRIEF.md), [canonical product specifications](CANONICAL_PRODUCT_SPECS.md), and [integration audit](HANDWRYTTEN_INTEGRATION_AUDIT.md). This plan supersedes older redesign proposals for proposed implementation scope, but does not change founder decisions or promote unresolved supplier facts to confirmed claims.

## 1. Executive changes and reasons

| Priority | Change | Why it matters |
| --- | --- | --- |
| P0 | Put actual card choices, $9 including mailing, and a clear next action in the first mobile screen. | Visitors should understand the product and act before reading a long explanation. The apparent largest leak is at the entrance, although existing counts are not a reliable unique-session funnel. |
| P0 | Use SendMyNotes branding throughout its purchase journey; preserve A&B on physical stationery and its recipient site. | One clear sender identity keeps the experience coherent while retaining the intended recipient experience. |
| P0 | Keep custom artwork available from the first screen, alongside an immediately usable card collection. | Personalization contributes to thoughtfulness; generation should be a choice rather than a prerequisite. |
| P0 | Put the note editor first, with one helpful starter and handwriting options behind secondary controls. | Writing a personal message should be the task, rather than browsing a large inspiration library. |
| P0 | Replace the fixed Preview Card bar with a persistent next-step action before payment. | The most reachable control should move the sender toward completion. Preview remains accessible. |
| P0 | Simplify recipient and return-address entry; remove account and reminder decisions before payment. | Preserve a personal envelope while reducing typing and unrelated decisions. |
| P0 | Verify wallet readiness and real Apple Pay completion; retain an easy card fallback. | Stripe card success is not evidence of Apple Pay working through the Meta journey. |
| P0 | Fail safely when payment setup fails; never show simulated production success. | A payment-loading problem must not appear to become a completed order. |
| P0 | Correct A2 dimensions, unsupported paper claims, and delivery promises. | Customer expectations must match the actual physical product. |
| P0 | Count unique eligible sessions and server-verified customer purchases. | Founder tests and repeated interactions must not masquerade as customer conversion. |
| P1 | Show privacy-reviewed real product photography. | Demonstrate what arrives in the mailbox without exposing personal information. |
| P1 | Save the draft through back navigation, refresh, and payment cancellation. | The sender should not lose the thought they have already put into the gesture. |
| P1 | Move reminders and saved contacts to confirmation. | Repeat sending can follow a successful first send rather than competing with it. |

P0 means required for the initial candidate release. P1 follows in the same release where practical, or the immediate next increment. Priorities are recommendations, not measured conversion effects.

## 2. Design paradigm: a guided personal gesture

The customer is making someone feel remembered. The interface should feel warm, direct, and capable: choose something meaningful, put your words inside, tell us where it goes, and send it.

Recommend four purchase steps: **Card → Note → Address → Pay**, followed by confirmation. Keep one primary task and one primary next action per step. The step count is not the optimization target; comprehensibility, successful completion, and preserved intent are.

Use the current `/new` components as material to evaluate and refactor, not as an approved finished product. Avoid introducing a third independent purchase flow. Converge the homepage and occasion landings on one shared implementation with explicit initial context.

### Visual and interaction system

- Warm off-white background, dark readable text, restrained accent, actual card artwork as the visual focus. Use color primarily for selection, action, and feedback.
- Compact SendMyNotes header. Price belongs near the action; sign-in belongs in secondary navigation, not as a prerequisite.
- Plain language: “Choose a card”, “Write your note”, “Where should we mail it?”, and “Review and pay”. Remove “stationery leaf”, “commission”, “inking coordinates”, and similar production jargon from primary tasks.
- One compact progress indicator with text labels; remove the duplicated three-step marketing ribbon and four-step navigator.
- Body copy and inputs at least 16 CSS pixels on mobile; minimum 44 × 44 CSS-pixel targets; visible focus and readable error states. Verify contrast rather than assuming brand colors pass.
- Maintain normal scrolling. Do not fix clipping by globally hiding horizontal overflow; correct overflowing elements.
- Desktop retains the same steps and defaults. An adjacent preview can use available space without introducing additional decisions.

## 3. Entry and card selection

### First screen at 390 × 844

Order: compact header → short value statement → $9 including mailing → occasion controls → first visible card choices → persistent next action.

Candidate copy:

> Your words. Real ink. Mailed for you.
>
> Choose a card, add your message, and we'll write and mail it for you.
>
> $9 including mailing. No account needed.

This is proposed copy. Avoid “mailed today”, “Apple Pay ready”, guaranteed arrival, unverified paper weight, and measured 60-second claims.

Use a two-column card grid on mobile, correctly proportioned at 17:22. Show the first row without scrolling at the target viewport. At 320 pixels wide, retain usable targets and text even if less artwork fits above the fold. Keep titles short; omit paragraph descriptions from catalog tiles.

### Selection behavior

1. Generic landing shows a small set of relevant personal occasions and cards. Default to all personal occasions rather than a professional scenario.
2. Occasion-specific arrivals show matching choices immediately. Carry ad context into the builder without adding a second large hero above it.
3. A contextual recommended card may be preselected with a visible checkmark. Explicitly continuing with it counts as acceptance; displaying it does not count as a selection event.
4. Tapping another card updates selection without unexpectedly advancing. Primary action: “Write your note”.
5. A small Preview control opens a sheet. Close returns to the same scroll position and selection.
6. Do not require browsing all 11 occasions. Filters remain available, with a clear active state and an understandable empty state.

### Custom artwork branch

Expose “Make a custom design” near the first choices, not only below the whole gallery. Use a compact button or tile; avoid two equally large funnels occupying the first screen.

The sheet asks “What would make this card feel like them?” and offers a few concrete starters. Describe generation as custom artwork, with accurate disclosure of AI assistance in explanatory copy. No invented artist or hand-painted-original claims.

- Explain the expected wait using measured timings when available; show a truthful pending state.
- Generation is explicit. No paid generation on page load or automatic regeneration on minor edits.
- Keep the last valid card while a new attempt runs. Failure offers Retry or Use a ready-made card.
- Permit canceling the branch without losing the note. Cancel must not automatically count as an order failure.
- Let the sender inspect and explicitly use the result. Regeneration retains the prior result until accepted.
- Check art composition against the actual A2 cover and supplier bleed template. Existing images may need controlled crop or regeneration; do not stretch them.

**Acceptance:** first visible choices and actionable CTA on 390 × 844; predefined and custom paths reach the same note step; no duplicate header; selected design survives preview/filter/back; pending/error states never remove the working selection.

## 4. Note composition

Put the personal note textarea at the top, directly below the step title. Recommend one editable note box as the initial candidate because the sender should be able to write naturally. Do not introduce mandatory salutation, body, and closing fields solely to support autofill.

Show a single proposed starter below the editor with “Use this starter”. Start blank for generic arrivals. Context-specific arrivals may offer a relevant starter but should not insert it invisibly. Never use actual-looking fictional recipient/sender names as live defaults.

- “More ideas” opens a sheet with a limited selection and tone controls.
- Never replace a user's edited words without an explicit replacement action; provide Undo.
- Keep handwriting at a safe default, with “Change handwriting” as a secondary control and readable samples.
- Preview is available through a compact toggle/sheet. Writing must not require scrolling past the rendered card.
- Use a modest fit indicator. Calculate the combined text sent to Handwrytten, including any added greeting, closing, and separators.
- A provisional 450-character combined limit may be used as an application restriction while fit is being validated; do not describe it as a supplier guarantee. Fit checks must account for line breaks, longest words, style, and margins.
- If the sender forgets a signature, offer an optional “Add your name” helper. Do not make parsing informal prose the sole source of address names.
- Explain that the words will be written in real pen ink. Keep technology details in “How it works”, not the central task.

Keyboard behavior: focus remains on the active field; errors do not scroll it behind the header; the persistent action hides or repositions without covering text when the keyboard opens. Closing the keyboard restores the action. Advance scrolls to the new heading and moves focus meaningfully. Back returns to the edited note.

Primary action: “Add mailing address”. Empty or oversized messages receive a specific nearby explanation. Do not rely on a disabled button with no reason.

**Acceptance:** editor appears before inspiration/style controls; no fabricated names; textarea remains visible while typing on a real phone; replacement is reversible; combined text is the same in preview and dispatch; edited note survives every back/preview/cancel operation.

## 5. Address entry

Keep recipient and sender as clearly labeled sections within one step. Complete the recipient section first, then present the return-address section. Avoid displaying twelve equally weighted fields at once on a small phone.

### Recipient

- Label “Who should receive it?” with one full-name input. Preserve multi-part names; splitting for the supplier is a transport concern and must not corrupt the displayed name.
- Street address; “Add apartment or unit” expands the optional second line.
- City, state, ZIP with suitable input modes and understandable labels. Fields should not become cramped three-column micro-inputs on narrow phones.
- Properly scoped autocomplete, including distinct recipient/sender sections. Browser autofill may contain the buyer's address, so make the recipient designation obvious and review it before payment.
- If address lookup is introduced, allow manual entry when lookup fails. Only claim an address has been verified when an actual verification service ran.

### Sender return address

Explain: “Your return address goes on the envelope so they know it's from you.” Keep the physical personal return address requirement.

- Prefill only from explicit sender data or a saved, authenticated address. Inferred names must remain editable.
- Do not substitute the buyer's billing address or a wallet shipping address without clear review and agreement.
- No warehouse fallback and no silent Aster & Blanche sender-name substitution.
- Existing saved contacts remain optional, subordinate, and non-blocking.
- Remove reminder, account creation, and address-book enrollment decisions from this step.

Send-soon is the default. Keep scheduling as an optional collapsed control only if its behavior is operationally supported. Distinguish a requested mailing date from an arrival date. Do not offer an unsupported date guarantee.

Validation occurs on blur or Continue with field-specific help. Preserve all valid inputs on error. Client-side checks improve usability; server-side validation remains authoritative.

Primary action: “Review and pay”. A simple envelope preview may help explain addresses, but must not push the form down or require a decorative interaction.

**Acceptance:** guest can complete without sign-in or reminders; both identities are visible at review; optional unit fields persist; autofill works with correct recipient/sender scope; invalid input focuses the first relevant error; no entered data is discarded.

## 6. Review, wallets, and payment

Review fits above payment controls: card thumbnail; short note excerpt with Read full note; recipient name/destination; return identity; truthful timing guidance; total including mailing. Provide Edit links that return to the relevant step and then back to review.

Use a single authoritative server-priced checkout snapshot. When card, message, addresses, scheduling, or discount changes, synchronize that snapshot before payment. Never authorize a new amount against an old review.

### Wallet behavior

Integrate Stripe's Express Checkout Element alongside the standard Payment Element using a supported integration for the existing PaymentIntent architecture. Check installed SDK compatibility during implementation; a new payment-architecture migration is not a prerequisite unless compatibility requires it.

Stripe documents environment-dependent wallet availability and domain registration. Use the supported availability callbacks for the installed version; render the provider's authentic wallet button only when appropriate. Browser/device regex may describe environment but cannot establish wallet readiness. Source: [Stripe Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element).

- Verify payment-method domains in test and live for every hostname actually collecting payment, including applicable subdomains.
- Preserve an easy card route when wallets do not appear. Do not leave an empty wallet placeholder or a nonfunctional branded button.
- Payment cancellation returns to an intact review. Failed authorization provides a specific safe message and retry without a duplicate paid order.
- Do not use wallet shipping collection as a substitute for the greeting-card recipient. Collect buyer contact/billing details only as needed; keep gift recipient and sender data distinct.
- Avoid duplicate email entry. Prefill known email with an editable value; request a receipt email once, and update server state before confirmation if it is collected late.
- If the in-app browser cannot complete the wallet flow, card payment remains available. An optional browser-switch instruction must accurately describe the available action; preserve drafts through a secure handoff if implemented. Do not promise an automatic Safari launch.

### Navigation and errors

On steps 1–3, the persistent bar contains total and next action. At payment, the real wallet control is the wallet action; do not add a fake sticky Apple Pay proxy. A sticky card submit control can serve the card form, without competing submit buttons.

Collapse promo entry behind “Have a code?” Honor valid pre-applied codes and update total visibly. Remove repeated line items that invent unsupported manufacturing costs.

Production initialization failure must remain an error with Retry. Remove `/new`'s path that advances to payment after initialization failure with mock defaults. Mock/test/free/live modes must be explicit and controlled server-side; no browser failure can enable simulated production success.

Confirmation must be based on server-verified payment/order state. Preserve the existing view-token access contract: `/new` currently does not visibly handle the returned `viewToken` the way the legacy flow does. Verify token storage/navigation and protected receipt loading rather than exposing order data or leaving guests unable to view their receipt.

**Acceptance:** real-device Apple Pay readiness/authorization and card fallback verified; cancellation loses no content; initialization failure cannot yield success; payment retries cannot duplicate fulfillment; discount and edited content match the paid snapshot; guest receipt access respects its token.

## 7. Confirmation and repeat sending

Headline: “Your card is ordered.” Separate payment confirmed, preparation, and mailed status. Display only stages known from server/supplier events. An estimated arrival is not proof of delivered mail.

Show recipient, total, message, and receipt email with a useful order reference. Explain preparation/transit as estimates governed by the canonical specification; do not imply guaranteed tracked delivery.

Then one contextual optional action: annual birthday reminder for a birthday, an appropriate later check-in for support, or save recipient for another occasion. Explicit consent, no prechecked enrollment. “Send another card” is secondary. Account creation is optional and post-purchase.

Keep the Aster & Blanche backplate and recipient-facing site separate from SendMyNotes navigation. Do not rebuild the recipient website as part of this conversion release.

**Acceptance:** confirmed payment remains distinct from fulfillment failure/pending; refresh never duplicates order or purchase event; reminder choice is voluntary; sensitive order data requires valid access; no unsupported delivered status.

## 8. Shared state, mobile performance, and assets

Create one versioned draft model with selected design, custom-generation state, note, style, addresses, schedule, discount, attribution, experience version, and checkout snapshot identity. Separate optional preferences from required order content.

- Back/forward, refresh, validation errors, and canceled payments preserve a draft. Use an expiring per-session store for non-payment content, with a clear-draft action; assess address/message privacy before adding longer-lived storage.
- Never persist card/payment credentials, client secrets in share URLs, or raw addresses/messages in analytics. Keep protected receipt tokens out of campaign query strings.
- Price and paid status are server-authoritative. Editing after intent creation invalidates or updates the checkout snapshot before authorization.
- Reuse the attribution tracker across all routes, preserving ad source and experience assignment without appending personal data to URLs.
- Small optimized catalog thumbnails first; large preview/artwork only when needed. Lazy-load custom generation, inspiration, contact import, and secondary previews.
- Render useful server-provided entry content promptly; avoid a full-screen atelier loading gate for basic browsing.
- Set image dimensions to prevent layout shifts. Preserve the lossless/private original artwork pipeline separately from lightweight storefront thumbnails.
- Test 320, 375, 390, and 430-pixel widths, landscape, Android, desktop, keyboard, slower network, and reduced-motion preferences. These are intended checks, not claims of current certification.

Use authorized physical photos only after privacy review. Prefer a note close-up and card-in-hand image to establish real ink and scale. A small “What arrives” panel can show card and envelope; it is secondary to initial action. Remove personal details and metadata from exported derivatives, verify at full resolution, and never publish raw source photos. Avoid invented testimonials, fake recipient reviews, or a digitally enhanced product presented as an unedited sample.

Initial performance targets to measure: mobile p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 where enough real-user data exists; otherwise report lab conditions separately. These are proposed engineering budgets, not measured current results or promised conversion lifts.

## 9. Product truth and fulfillment alignment

Centralize confirmed dimensions, price, neutral material wording, and timing policy in shared configuration. UI, metadata, structured data, Stripe product description, previews, emails, and supplier payloads must agree.

The front is 17:22 and open spread 17:11. Audit artwork crop and preview margins against supplier templates. Do not merely relabel a 5:7 canvas as A2. Verify combined-message layout using representative short, long, multiline, and all-supported-style samples. Prefer the existing physical sample and supplier proofs; any new billable order needs separate explicit authorization.

Remove specific paper-weight/cotton/archival/letterpress/debossing claims while unconfirmed. Request supplier confirmation for our API-created dimension-4 SKU and actual full charges. Do not hold basic browsing improvements hostage to an optional paper-weight claim.

Until confirmed, display broad supplier-supported preparation/transit guidance and avoid exact local-time cutoff promises. If date estimates are added, implement production and postal calendars separately, supplier timezone, holidays, scheduling constraints, and explicit uncertainty. Unit-test boundaries. The current calculation that skips only Sunday is inadequate for a production-business-day model.

## 10. Measurement design

Rebuild the funnel around unique eligible sessions and explicit completion, not accumulated interactions. Maintain separate event and unique-completion counts.

| Event | When emitted | Counting rule |
| --- | --- | --- |
| landing_viewed | Entry content renders | Once per eligible session/experience; retain entry route and source. |
| builder_started | First meaningful choice or explicit start | Distinguish viewing a default from accepting it. |
| card_completed | Sender proceeds with selected card | Once per session for funnel; track later changes separately. |
| custom_generation_requested/completed/failed | Actual generation lifecycle | Track latency/result, not prompt or personal content. |
| note_completed | Sender advances with valid combined text | Not every keystroke and not merely visiting note step. |
| address_completed | Both required addresses validate and sender advances | Not arrival at address screen. |
| payment_viewed | Review/payment renders | Separate from successfully initialized checkout. |
| wallet_availability_observed | Provider reports available methods | Device/browser category and availability only. |
| payment_attempted/canceled/failed | Actual provider interaction | Attempt ID and safe error category; no card data. |
| purchase_verified | Backend verifies payment | Deduplicate by order/transaction; exclude test/comp from customer totals. |
| fulfillment_submitted/failed | Supplier result | Separate operational success from payment success. |
| reminder_opt_in | Explicit post-purchase consent | Separate retention metric. |

Common non-personal context: session ID, draft revision, experience version, occasion, preset/custom, acquisition source, device/browser category, and elapsed time. Do not send names, note bodies, prompts containing personal details, addresses, raw payment errors containing personal data, or sensitive asset URLs.

Primary measure: independent paid orders / eligible landing sessions. Also report builder completion, per-step completion, median and upper-percentile time, wallet availability and completion, payment errors, fulfilled orders, refunds, and actual contribution after variable costs and ad spend. Report denominators and date windows.

Segmentation: Meta vs other traffic, mobile vs desktop, in-app vs external browser when identifiable, occasion, preset vs custom, and candidate vs baseline. Unknown remains unknown. Exclude explicitly labeled founder tests, authorized comps, and known automation; don't infer bot traffic solely from missing analytics IDs.

Validate purchase reporting with test-mode orders labeled as tests and reconciliation against Stripe/order records. Browser events cannot be the sole authority. Do not fire AddPaymentInfo on merely loading the payment step; align ad-platform event semantics with actual action.

## 11. Implementation work packages

| Package | Files / areas | Deliverable | Exit gate |
| --- | --- | --- | --- |
| 0. Evidence and baseline | `lib/metrics-rollup.ts`, `lib/telemetry.ts`, `lib/types.ts`, admin metrics/dashboard, attribution | Correct unique-session funnel, test-order exclusion, source/date windows, confirmed ad URL; supplier questions logged. | Seeded journeys reconcile; repeated events do not inflate completion; founder order excluded from customer conversion. |
| 1. Product truth and checkout safety | `lib/handwrytten.ts`, `lib/stripe.ts`, `lib/delivery-estimate.ts`, image/preview configuration, checkout routes | Shared verified specs, truthful timing, explicit production error states, personal sender validation. | No false 5×7/weight/cutoff claims in scoped customer surfaces; no mock success after production error; fit/crop audit recorded. |
| 2. Entry and card flow | `ExperienceRouter`, `TargetPurchaseExperience`, `Step1CardSelection`, `CustomAiCommissionDrawer`, homepage and `/send` routes | One shared personal-sender entry, small gallery, visible custom path, persistent next action. | Mobile first-screen checks and both preset/custom journeys pass. |
| 3. Note and address | `Step2NoteComposition`, `Step3EnvelopeAddressing`, draft state, relevant legacy adapters | Editor-first composition, controlled suggestions, scoped autofill, optional controls, draft recovery. | Keyboard, back/refresh, validation and multiline content checks pass. |
| 4. Payment and receipt | `Step4ReviewAndPayment`, checkout/create-intent, confirmation, `app/order/[id]`, wallet helpers | Real Express Checkout, card fallback, synchronized review, view-token continuity, no duplicate fulfillment. | Provider test-mode scenarios pass; real-device wallet flow checked; any live transaction separately authorized. |
| 5. Proof and retention | Sanitized assets, compact product-proof panel, confirmation/reminder components, metadata | Real product proof, SendMyNotes-only sender UI, optional post-purchase reminders. | Privacy review and product-copy audit pass; A&B physical/site role preserved. |
| 6. Candidate rollout | Feature flags, route consistency, analytics dimensions, operator monitoring | Tested candidate and reversible allocation. | Launch checklist completed and rollback path rehearsed. |

Work sequentially by dependencies; integrate instrumentation before evaluating the UI. Prototype Package 2–3 while supplier details are pending, using neutral copy. Do not create a multi-product factory, native app, new supplier, or new account requirement as part of this redesign.

Indicative effort for one engineer/designer: approximately 12–20 working days plus supplier response, real-device access, and observation time. This is a planning estimate, not a commitment. Package 0–1 typically needs 2–4 days; entry 2–3; note/address 3–4; payment 3–5; final QA/rollout 2–4. Reuse can reduce this; discovery of payment/order defects can increase it.

## 12. Validation and launch protocol

### Prototype/usability gate

Build a clickable or local candidate before production rollout. Ask 5–8 representative personal senders to perform an ordinary birthday or thinking-of-you send, plus a smaller set of custom-design tasks. Avoid coaching them through the controls. Capture task success, confusion, missing information, time, and verbatim observations with consent. This finds usability problems; it is not statistical conversion evidence.

Proposed usability gate: at least 80% complete the ordinary task without assistance, every observed blocking issue resolved/retested, no participant misunderstands recipient versus return address or price. Treat this as a release heuristic, not a commercial win. Investigate outliers instead of optimizing only the median.

### Required regression matrix

- Default/contextual selection, changing occasion, custom generation success/timeout/failure, preview dismissal, back and refresh.
- Note edit, starter replacement/Undo, maximum combined text, multiple lines and styles, long names, empty required values.
- Manual address entry, browser autofill, apartment, wrong ZIP/state, corrected error, recipient different from buyer.
- Wallet ready/unavailable, canceled authorization, card fallback, declined payment, authentication challenge, initialization/network failure, discount changes and zero-cost branch.
- Repeated submit, webhook retry, client-confirmation race, paid-but-fulfillment-pending, protected receipt refresh and missing/invalid token.
- Narrow viewport, keyboard, orientation change, slow connection, large text, keyboard-only/screen-reader navigation, focus/error announcements.
- Test-order exclusion, repeated-event deduplication, accurate source/variant assignment, server-only purchase authority, no personal data in telemetry/public images.

Use existing security, attribution, Meta conversion, feature flag, telemetry, and target-experience tests where applicable; add meaningful tests for changed contracts and failure states. Run type check and production build. Confirm lint tooling is configured correctly rather than assuming the existing `next lint` script works. Mocked checks do not verify physical output or wallets on a real device.

### Real-device payment gate

Test the ad journey in iPhone Safari, Instagram/Facebook in-app browsers, Android Chrome, and available Android in-app browsers. Record actual device, OS, browser/app, date, method availability, authorization result, receipt access, and preservation on cancellation. Do not certify a context that was not tested. A controlled live transaction can verify production only with the founder's explicit transaction authorization; record it as a test, not a conversion.

### Rollout

1. Make the candidate available on a preview route with explicit version attribution. Do not change an ad destination or launch paid tests until the real destination and tracking are verified.
2. Fix confirmed correctness defects for all traffic; false product claims and simulated success are not legitimate control variants.
3. After correctness and device gates, allocate a small stable candidate cohort using a recorded sticky assignment. Define the actual allocation based on incoming eligible traffic; avoid splitting a tiny sample into many variants.
4. Examine the first candidate journeys for technical failures and content loss. Advance allocation only after explicit review of recorded checks and failures; elapsed time alone is not a pass.
5. Keep the prior stable application deployment/config available for rollback. Protect order processing independently so paid orders continue to reconcile even when UI allocation changes.
6. Roll back immediately for wrong recipient/content, unexpected amount, duplicate charge/fulfillment, exposed personal data, or simulated production success. Pause the candidate on reproducible inability to pay or persistent initialization failures; investigate before resuming.
7. Observe commercial performance over complete reporting windows. At this traffic level, use usability evidence and absolute customer/order counts before declaring statistically reliable uplift.

Once a credible baseline exists, test one meaningful decision at a time: custom-path prominence, starter presentation, or landing proof placement. Predefine outcome, minimum detectable effect, sample requirement, maximum spend, and stop conditions from real traffic and actual margin. Do not recycle older sample sizes or treat the first order as proof of product-market fit.

## 13. Definition of done

The first release is ready when a personal sender can understand the offer, choose or create a card, write their words, supply correct personal addresses, and pay through a verified available method without losing work or requiring an account. Product claims match evidence; production errors cannot simulate success; payment/order/fulfillment reconcile; public photos are sanitized; measured journeys exclude founder testing; all scoped mobile and failure-state checks pass.

The release is commercially validated only after independent customer behavior and paid/fulfilled orders support it. A completed implementation, a visually polished flow, and a successful founder test are separate milestones.

## 14. Evidence and remaining decisions

Evidence used: canonical founder decisions, October 11 supplied ad/site/funnel materials, source inspection, live mobile storefront review, authenticated supplier catalog evidence already recorded, and current Stripe documentation. No new conversion measurement was performed for this plan.

Still open: exact ad destination and optimization setup; clean baseline window; supplier stock/envelope/charges; validated text/crop behavior; actual wallet outcomes; selected custom-branch presentation after prototype testing. These do not prevent creating the candidate with conservative truthful copy and explicit test labels.

Useful references:

- [Canonical founder brief](CANONICAL_PROJECT_BRIEF.md)
- [Canonical product facts](CANONICAL_PRODUCT_SPECS.md)
- [Integration audit](HANDWRYTTEN_INTEGRATION_AUDIT.md)
- [Stripe Express Checkout and availability](https://docs.stripe.com/elements/express-checkout-element)
- [Stripe payment-method domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration)
- [Handwrytten API](https://www.handwrytten.com/api-redoc/)

Maintenance: update this plan when implementation or tests produce evidence. Record proposed versus implemented versus verified status; do not rewrite historical baseline data as though the redesign had already succeeded.
