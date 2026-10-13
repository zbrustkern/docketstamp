# SendMyNotes mobile conversion design review

**October 12, 2026. Design review of the live `/new` flow and three supplied PDFs.**

Reviewed card selection, note composition and addressing live in Chrome at
390 × 844; checked addressing at 320 × 740. Inspected rendered PDFs and extracted
copy. The PDFs are browser print exports, so their page breaks and floating-header
positions are not proof of mobile scrolling behavior. Live viewport inspection
supports the hierarchy findings below. No addresses were submitted, no payment
was attempted, and no customer-facing files were changed. Stripe key repair is
already being handled separately. Payment and confirmation design were not observed
end to end and are not certified by this review.

## Overall judgment

The entry screen is a substantial improvement: actual artwork, a short promise,
$9 including mailing, no-account reassurance, and a reachable next action all
appear on the first mobile viewport. Preserve that structure. The next opportunity
is to make note and address steps equally direct. They currently frame a personal
act as a stationery-production workflow.

The recommendations are conversion hypotheses, not observed uplift. Prioritize
understandability, task visibility, and legibility before decorative redesign.

## 1. Replace production language throughout (highest priority)

“Physical A2 Card Leaf Fit” is unsuitable for a sender. A customer does not need
to learn a stationery term to know how much they can write. The problem extends
to page titles, labels, helper text, style descriptions, and address copy.

| Current wording | Recommended wording / treatment |
| --- | --- |
| Interior Note Composition & Handwriting | Write your note |
| Pen your personal message. Handwrytten robotic plotters will ink every line with authentic ballpoint pens. | Your words, written in real pen ink. |
| Physical A2 Card Leaf Fit | Remove the standalone panel. Put the character count under the message field. |
| Fits beautifully on physical A2 card | Omit while comfortably within the limit. Use “Getting close to the message limit” near the limit. |
| A2 Card (4.25″ × 5.5″) in the writing step | Move dimensions to product details if needed. |
| 103 / 450 chars | 103 / 450 characters |
| SALUTATION / RECIPIENT | Greeting (optional) |
| LETTER BODY (INKED INTERIOR MESSAGE) | Your message |
| CLOSING & SIGN-OFF | Sign-off / Your name |
| Auto-syncs recipient name onto your envelope. | We'll carry this name into the address step. Use only if accurate for the entered greeting. |
| Auto-syncs your name onto the return address in top-left envelope corner. | We'll use your name on the envelope. Use only if accurate. |
| ROBOTIC PENMANSHIP STYLE | Handwriting |
| Each stroke is physically drawn by high-precision mechanical plotters. | Choose how your note looks. |
| Browse curated sentiments written by stationery essayists. | Need a little inspiration? |
| Physical Envelope Addressing & Return Address | Where should we mail it? |
| Personal Sender Return Address | Your return address |
| Standard Apple Keychain & Chrome Autofill supported. | Let your phone fill in your address. Only if that behavior is verified; otherwise omit. |
| Reset draft | Move “Start over” into secondary navigation, with confirmation after edits. |
| Next: Address | Add mailing address |
| Next: Review & Pay | Review & pay |

Keep an honest “How it works” explanation available: automated equipment writes
with real pens. Avoid making machinery the main reassurance at every step. Do not
replace it with false claims that a person handwrites the card. Remove unverified
“stationery essayists” authorship and absolute envelope/no-barcode claims unless
supported for the fulfilled product. The user's real gesture and words lead.

The 450-character limit is an application constraint. Do not claim it guarantees
physical fit without supplier/layout verification. A count is helpful; a confident
manufacturing fit certification is a different claim.

## 2. Make note writing easier to see and read (highest priority)

At 390 × 844, the new note screen begins with a long heading, supplier/machinery
copy, a Change Card control, and a large fit panel before reaching the greeting.
The actual message box sits near the lower part of the viewport. This is still a
lot of interface before the task.

Recommend: compact “Write your note” heading, message editor, optional greeting
and sign-off, modest count, suggested starter, secondary handwriting control,
next action. If preserving the existing three-field structure for this increment,
at least delete the fit panel and shorten the heading/helper copy so the message
field becomes visible earlier. A one-box composer is a later usability comparison,
not a required change to ship this cleanup.

Use a normal readable font in editable inputs. The current light, small handwriting
font is attractive as a preview but makes composing and proofreading harder. Keep
actual handwriting in a preview sheet or explicit Preview toggle. Input font size
should remain at least 16 CSS pixels; styling must not reduce visible glyph size
so much that it becomes hard to read even at that nominal size.

Keep the explicit starter button. Show a concise, occasion-safe example; the
current birthday suggestion assumes shared milestones and pride in achievements.
That can suit some relationships but not all. A default birthday suggestion such as
“Wishing you a wonderful birthday and a happy year ahead!” is broader. Offer richer
choices through More ideas, not a mandatory expanded gallery. Maintain Undo when
replacing already edited words.

Collapse four handwriting choices behind “Handwriting: [sample] · Change”. Use
the same example sentence across styles so customers compare appearance rather
than four different occasions. Vendor font names can remain secondary labels;
short descriptive labels should communicate the choice. Preserve verified font
mapping, preview accuracy, and the selected style.

**Acceptance:** the main message field is visible on the first note viewport; text
is easy to proofread; starter is opt-in and reversible; style choices don't crowd
out the message; no fit guarantee is implied.

## 3. Put address entry before the envelope illustration (highest priority)

The first 390 × 844 address viewport contains the title, a large envelope preview,
and a long explanation. No input is visible. At 320 × 740, the next action remains
at the bottom while the actual address task is still below the screen.

The envelope is useful reassurance, but its current position repeats the original
problem of putting demonstrations before action. Lead with recipient fields,
then personal return-address fields. Place the envelope after those sections or
behind “Preview envelope”. It becomes more useful once addresses are filled.

Retain the personal return address. Explain it in one sentence: “Your name and
return address appear on the envelope.” The current paragraph about corporate
labels, barcodes, personal credibility, and returns is longer than the decision
requires and introduces doubts a sender may not have had.

Simplify section headings to “Send to” and “From you”. Remove duplicated A/B and
1/2 numbering. Keep full-name inputs, optional apartment expansion and scoped
autofill. On narrow phones put city on its own line, state and ZIP below, avoiding
cramped labels and inputs. Sender addresses need an apartment/unit option too
where applicable; confirm that data survives into fulfillment.

**Acceptance:** the first recipient input appears without scrolling at 390 × 844;
the envelope never blocks the task; recipient and sender remain unmistakable;
optional unit and autofill data survive review and dispatch.

## 4. Fix narrow-screen navigation and disabled-action explanations

At 390 pixels the progress bar abbreviates Address. At 320 it abbreviates several
step labels, while the bottom dock compresses total/postage text and brings the
secondary action close to the price. This makes the UI feel more complicated
exactly where it should provide orientation.

Prefer a compact “Step 3 of 4 · Address” at narrow widths, or four labels that
actually fit. Price should stay on one line. Remove the secondary back/edit
control from the dock if it crowds out the main action; provide one Back link near
the heading. Reserve sufficient content space above the dock and verify actual
keyboard behavior on phones, since desktop emulation does not reproduce it.

If Continue is disabled, show a helpful nearby reason such as “Add your message to
continue” or “Complete both addresses to continue”. Another valid approach is to
let Continue identify the first missing field and focus it. Do not leave the
customer hunting for what is required.

The PDF print exports show some grey buttons despite filled content; print
appearance alone is not evidence they failed validation. Test this behavior live
with complete synthetic data in a safe environment before labeling it a defect.

## 5. Preserve the improved entrance; clarify selection

The homepage-style entry is the strongest screen. Keep the concise headline, card
images, visible custom option, and $9 including mailing. Avoid a fresh large hero
or an additional instruction ribbon.

Shorten the custom-design module to “Make it personal” / “Create a custom design”
with a short helper. Its extra Custom Art badge and clipped sentence don't add
much. Keep custom creation available near the choices; no generation on arrival.

At 390 pixels, long artistic titles truncate. Give the occasion/customer purpose
priority, with the collection title secondary. Verify selected state is unmistakable
and the CTA makes the selected card clear. The live fresh screen exposes a next
action before a deliberate choice; if it proceeds with a default, display that
recommended selection visibly rather than silently choosing.

Keep Preview subordinate to choosing a card. Separate selection and zoom affordances
so a visitor doesn't accidentally open a modal when trying to proceed. Occasions
may scroll horizontally, but their affordance and active state should be obvious.

## 6. Product proof and payment follow-through

A small sanitized real-card/ink photo can reinforce the ad promise, especially
near review/payment or in a collapsible “What arrives” section. Don't insert it
above initial card choices and recreate the entrance friction. Originals in the
supplied PDFs contain personal information; no source image or address should be
republished. No such photos were copied into public output for this review.

Payment was not reached or tested in this review; the key issue is already known.
After repair, review one compact card/note/address summary, accurate arrival
estimate, confirmed total, authentic available wallet controls, card fallback,
and actionable errors. Avoid leaving internal key names or configuration messages
in the customer flow. A temporary payment outage should preserve the draft and
show plain language and a working retry path.

## Suggested implementation order

1. Plain-language copy across note/address and contextual helpers.
2. Move fit feedback under the message; address forms before envelope.
3. Readable editing fonts; collapse handwriting choices.
4. Narrow-screen progress/action-bar cleanup and validation guidance.
5. Selection clarity, general-purpose starter copy, and small real-product proof.

Keep the same four-step architecture. This is a focused simplification pass, not
a request to restart the redesign or add another flow.

## Validation and scope

Run screenshot checks at 320/375/390/430 widths. Ask several personal senders to
choose a card, write a note and enter addresses without coaching. Observe whether
they find the editor immediately, understand return addresses, know what to do
when the action is disabled, and can proofread their actual message. Measure task
time and completion separately from customer paid conversion.

Sources reviewed: live https://sendmynotes.com/new; founder PDFs “SMN new page 1”,
“SMN new page two”, and “SMN new page three”; canonical project brief and product
specifications. The recommendation does not certify wallet payment, physical fit,
keyboard handling, or conversion uplift.

## Follow-up: restore the actual card-shaped preview

The founder clarified that “preview” means the real-card-looking representation
of the selected cover and their actual handwritten message, not font samples.
This is an important distinction and should be a requirement of this cleanup.

Verified desktop note screen live: the new flow has no CardPreview panel or
full-card preview control. Source inspection confirms the shared physical-looking
CardPreview component is not mounted by the new flow. The card-selection Preview
sheet enlarges the cover artwork only. Review/payment has a thumbnail and note
excerpt; those are not a full assembled-card preview. This is absent from desktop
as well as mobile, not a mobile-only visibility rule.

The earlier recommendation was to reduce preview space and make it optional on
mobile, not remove the assembled-card preview. The goal is to keep the task
accessible while retaining the confidence that what is sent looks right.

Recommended behavior:

- **Mobile note:** a visible “Preview your card” action beside the note controls or
  immediately beneath the message; opens a sheet showing the actual selected
  cover and an inside-card representation with the entire composed greeting,
  message and sign-off in the selected handwriting style.
- **Desktop note:** form on the left, live card preview on the right where width
  permits; collapse to the same preview control at narrower widths.
- **Review/payment:** a compact thumbnail with “Preview your card” so the sender
  can inspect before paying without losing or retyping anything.
- **Preview navigation:** Front / Inside. An Open card view can show the assembled
  spread. Card back can remain under secondary details; do not make four preview
  modes mandatory choices. Selected custom artwork must preview just like presets.
- **Envelope:** optional Preview envelope after address entry; it need not occupy
  the first address viewport. The card and the envelope answer different questions.
- **Accuracy:** use verified A2 geometry, actual composed text and selected style,
  consistent crop/safe areas, and no invented paper finish. Until supplier proof
  validates physical wrapping, call it a preview, not “exact physical print”.
- **Editing:** use a legible normal font in inputs; the card preview provides the
  handwriting experience. Closing preview returns to the edited field/scroll
  position. Never reset selection, note or payment preparation.

Acceptance: a sender can preview their actual assembled card from note and review
on both mobile and desktop; it includes all text and custom/preset cover, reflects
edits without losing content, and is never mistaken for a generic font specimen.

## P0 checkout incident addendum — stabilize before design rollout

**Added October 12, 2026 after the Stripe production-key RCA.** Treat the ability
to accept customer payment as the immediate P0, regardless of the RCA's P1 label.
Error masking improves the customer experience but does not restore checkout.
The design cleanup above follows incident stabilization.

### RCA assessment

The earlier payment-mode validator accepted only `sk_live_` in production. Stripe
also supports live restricted keys beginning `rk_live_`, so that guard can reject a
legitimate deployed configuration. This is a compatibility regression in the
safety work if the active deployment used such a key. The exact injected key type
and active revision have not been independently verified here; quoted credentials
or an incorrect credential type remain alternative causes.

The observed error proves a non-empty selected configuration failed the guard,
not that the right Secret Manager value was injected or that Stripe rejected it.
Check environment-variable precedence as well: both the resolver and SDK prefer
`stripe-secret-key` over `STRIPE_SECRET_KEY`, so a stale alias can override the
configured value. Record configuration source name, secret version and revision
without recording or exposing the secret itself.

Official key reference: https://docs.stripe.com/keys

### Additional engineering acceptance criteria

1. **One consistent credential path.** Normalize the selected credential once and
   use that same value in validation and Stripe client creation. Trimming or
   removing quotes only in the validator can pass validation while sending a
   different credential to Stripe. Remove only a matching outer quote pair; reject
   malformed values rather than trying to repair arbitrary strings.

2. **Restricted-key permissions, not just prefix acceptance.** Recognizing
   `rk_live_` establishes the local type, not a valid, active, authorized key.
   Verify permissions for both PaymentIntent creation and retrieval used by
   create-intent, confirm-order, and admin reconciliation. Verify the live
   publishable key belongs to the same account/mode and the deployed webhook
   signing secret matches the relevant endpoint. Do not rotate or replace a valid
   key solely because the old guard rejected its type.

3. **Mode boundary remains intact.** Customer production must not accept test
   credentials, local mock success, or test-to-live supplier submission. The
   in-progress resolver includes explicit test-in-production overrides; constrain
   those to isolated preview configuration and confirm they are disabled on the
   customer deployment. Test both `rk_test_` and `sk_test_`, including quoted forms.
   Do not fix this incident by weakening webhook signatures or enabling mock mode.

4. **Safe diagnostics.** Log an enumerated type such as restricted-live,
   standard-live, test, publishable, missing, or unknown; configuration-source
   name, incident ID, and length if useful. Avoid logging `slice(0, 8)` of an
   arbitrary invalid value: its contents are not known to be safe. Never log key
   material, complete headers, or credentials in incidents/browser responses.

5. **Customer errors use codes, not keyword replacement.** API routes should
   expose a stable error code, safe message, and opaque support reference. The
   client should map known codes to copy and use a generic fallback for unknown
   technical errors. Searching for the words “Stripe” or “key” is insufficient
   and can misclassify legitimate payment errors. Preserve actionable card-decline
   feedback where appropriate. All flows share the API, so check legacy and
   candidate callers, not only `/new`.

6. **Regression tests exercise the boundary.** Add restricted/standard live-key
   recognition, quoted/whitespace variants, test-key rejection, publishable-key
   rejection, malformed quote handling, environment-alias precedence, and no raw
   diagnostics in HTTP responses. Mock the Stripe SDK boundary and assert it
   receives the identical normalized credential accepted by the resolver. Test
   authentication/permission failures and unavailable incident logging without
   exposing credentials or losing the customer's draft.

7. **Recovery must be genuinely recoverable.** Repeated Retry cannot create
   duplicate charge/fulfillment or overwrite a paid order. Keep all card, message,
   address and discount data intact. Reconcile existing PaymentIntent status after
   a payment-network interruption before offering another payment attempt.

### Customer-facing outage copy

For a confirmed initialization/configuration failure before any authorization:

> Payment is temporarily unavailable. Your card and message are saved.
> Please try again shortly.

Action: **Try again**. An optional support link can include an opaque incident
reference, never an address, note, key, or payment credential. Use “saved” only when
storage succeeded; if the draft is only in memory, use “Your card and message are
still here.” Do not promise that the team was notified unless that alert path
actually succeeds. A server configuration issue usually will not recover until
an operator fixes it, so avoid promising recovery “in a moment”.

For uncertainty after authorization, use a different state: “We're checking your
payment. Please don't submit it again.” Poll/reconcile server state and offer
order support. Never imply “You haven't been charged” without verifying it.

### Incident exit and rollout

- Record the deployed revision and configuration that caused the failure and the
  revision containing the repair; do not infer the deployed cause from local code.
- Test initialization and payment reconciliation on the repaired deployment,
  including the actual configured restricted-key permissions, no raw diagnostic
  strings, and successful protected guest receipt access.
- Use an explicitly authorized controlled live order for final production proof;
  label it as an operator test, exclude it from customer conversion, and reconcile
  Stripe, app state and supplier handling. None is authorized or performed by this
  design-review addendum.
- Confirm the actual ad landing route, payment methods, webhook operation and
  rollback configuration before expanding candidate allocation. Observe error
  counts and independent paid orders after recovery.
- Only then apply the note/address language, layout and real-card-preview cleanup.
  Do not confuse removal of the error banner with restored purchase capability.

## Artwork-only source and consistent card presentation

**Founder direction, October 12:** printable artwork must contain only the design.
Paper/card presentation belongs in the website preview, never in the printed image.

Implemented locally: strengthened the shared generation prompt and negative rules
against paper grain, physical sheets, folds, deckled edges, mockups, substrate
texture, bevels and cast shadows. Removed the sanitizer's fallback that restored
mockup-only requests. Preserved illustration brushwork, deliberate plain
backgrounds and subjects such as a mug on a desk. Prompt composition now refers
to the verified A2 crop instead of claiming the printed product is 5:7. Removed
“on textured paper” from the birthday preset's source prompt.

A shared CardFrontPreview now presents catalog, enlarged preset preview and the
existing CardPreview front consistently with a neutral card edge and subtle
shadow. The component uses the original artwork URL; this CSS framing is not
encoded into any print asset. Removed the older preview's decorative deboss-like
front border and exaggerated spine effect. This does not certify an exact paper
finish or create a new physical manufacturing feature.

**Existing assets still require cleanup.** Prompt changes do not alter existing
JPEGs or cached generated art. Several current covers visibly contain paper/edge
rendering already in their pixels. Adding a frame does not fix those source files.
Audit all presets and cached artwork; replace affected images with artwork-only
variants, retain old originals privately, and invalidate matching cache entries
when replacing them. Review generation/install scripts so they use the same
contract. Do not crop away important artwork indiscriminately or merely hide baked
paper beneath another simulated card.

Prompt rules reduce errors; they cannot guarantee visual compliance. Before
approving replacement presets, inspect output for any depicted card, surrounding
surface, paper edge, grain, shadow or fold. Add a bounded generated-output QA gate
before claiming an automatic “never” guarantee. Low-confidence/rejected results
should offer retry or an approved ready-made card, preserving the draft. No live
image-provider calls, asset regeneration, cache mutations, or deployments were
performed in this change.

Conversion recommendation: make the gallery look like a consistent set of things
one can send, with crisp readable artwork and quiet framing. Use the same selected
artwork in the front/inside assembled-card preview requested earlier. Avoid large
lifestyle scenes and fake paper craftsmanship as substitutes for actual product
proof. Neutral display framing plus honest real product photography communicates
physicality without baking a photograph of paper into the card that gets printed.
