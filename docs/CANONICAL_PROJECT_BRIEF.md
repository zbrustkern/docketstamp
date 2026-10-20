> Historical predecessor document. This is preserved migration evidence, not current DocketStamp authority. Use [the Master Build Specification](DOCKETSTAMP_MASTER_BUILD_SPEC.md), [Agentic Expansion Specification](DOCKETSTAMP_AGENTIC_EXPANSION.md) and [current architecture](../ARCHITECTURE.md).

# Send My Notes: canonical project brief

**Established by the founder: October 11, 2026.**
**Read first.** This is the current source of truth for audience, positioning,
brand roles, commercial baseline, payment evidence, and use of photography.
Product claims are governed by [canonical product specifications](CANONICAL_PRODUCT_SPECS.md).
Older proposals, experiments, and factory plans are historical context where they
conflict with these documents. A document's claim to be canonical or verified is
not itself evidence.

## Founder decisions and answers

| Topic | Canonical answer | Implication |
| --- | --- | --- |
| Audience | Personal senders, 100%. | Design for individual gestures to friends, family, and loved ones. Professional client outreach is not the target audience. |
| Primary value | A thoughtful gesture made seamless. | The emotional impact of a physical personal note leads; phone convenience removes the work of sending it. |
| Customization | The custom aspect is part of thoughtfulness. | Preserve personal words and meaningful design choice. The placement of custom artwork generation remains a design hypothesis; the founder has not approved hiding or removing it. |
| Stationery quality | Secondary to the thoughtful gesture. | Quality supports the emotional promise. Paper specifications and atelier language must not dominate the sending flow. |
| Commercial baseline | Zero independent customer conversions. The one paid order was the founder's test. | Exclude founder tests and comps from customer conversion and acquisition reporting. The previously displayed 0.6% is not a customer conversion baseline. |
| Payments | The founder successfully paid through Stripe. Apple Pay has not been personally tested. | A successful Stripe payment does not verify Apple Pay availability or payment in Safari or Meta's in-app browsers. |
| SendMyNotes brand | Sender-facing convenience service. The founder's intended direction is to purge Aster & Blanche from SendMyNotes. | Use SendMyNotes throughout its customer journey. This documentation decision is not a claim that the live UI has already been changed. |
| Aster & Blanche brand | Recipient-facing landing page reinforcing the quality and thoughtfulness of the card if a recipient looks it up. A small optional sending funnel already exists there. | Preserve the physical stationery identity and a restrained recipient experience. Do not turn it into an advertisement for the sender's convenience shortcut. The small existing funnel need not be removed. |
| Photography | Existing physical-product photos are authorized for marketing, provided the founder's personal information is excluded or edited out. | Only publish visually reviewed, sanitized derivatives. Never expose names, addresses, emails, order identifiers, or identifying codes from originals. |

## Current ad evidence

Three founder-supplied previews were reviewed on October 11: Facebook feed,
Instagram Stories, and Audience Network mobile native. Visible copy includes:

- “Your words. Real pen and ink.”
- “Your words. Real ink. Mailed for you.”
- “A thoughtful card, without the stationery drawer or mailbox trip.”
- “Choose your design, type your message, and we will write it in” (the remaining
  text is behind “See more” in the supplied feed preview).
- “$9 including mailing”, the displayed domain `sendmynotes.com`, and “Shop now”.

The creative shows a close-up of actual handwriting. It sells a personal note
made convenient rather than AI novelty or a stationery specification. The site
should continue that promise. In the Stories preview, placement controls overlap
the headline and price region; this is a visible layout issue, not evidence of its
effect on clicks or sales.

The displayed domain does not establish the actual configured destination URL,
UTMs, campaign optimization event, outbound clicks, landing-page views, or
placement spend. These remain unknown. Do not infer an ad destination from an
unrelated professional thank-you route in the old dashboard.

## Measurement rules

The supplied dashboard snapshot reports 160 visits, 5 cover selections, 6 notes
written, 5 address entries, 1 checkout initiation, and 1 paid order. These are
historical dashboard outputs, not a validated sequence of unique customer
completions. The existing metrics rollup increments event counters and counts
some step navigation as completion. Repeated activity, default card selection,
and entering a step can distort the implied funnel.

Report independent paid customer orders separately from founder testing, free
orders, refunds, and fulfillment failures. Establish unique eligible sessions,
step views, actual step completions, wallet readiness, and payment failures before
claiming precise abandonment percentages. The reporting window and amount of
founder/bot traffic in the 160 visits remain unconfirmed.

Older 2.1% or 3.5% conversion baselines, 145-second completion times, forecast
uplifts, repeat-order assumptions, and experiment sample sizes are not measured
results. Recalculate experiment plans from verified traffic and baseline data.

## Boundaries for the redesign

Guest sending, clear total price, preservation of the sender's words, and mobile
ease support the agreed value proposition. Custom cover generation, handwriting
controls, previews, scheduling, reminders, and address-book placement need to earn
their place through usability and conversion evidence.

The prior personal return-address requirement remains the working physical
product constraint; the founder has not authorized replacing it with a studio
address. Simplify entry while preserving the sender's identity on the envelope.

No final design paradigm or UI rollout has been selected by this brief. The
existing `/new` implementation is a candidate, not a proven conversion winner.
Changes in manufacturing specifications must come from supplier evidence, not
copy experiments. All brand copy must be accurate: do not claim human handwriting,
letterpress manufacture, embossing, archival certification, or a sender-local
postmark without evidence.

## Photography handling

Use the original photos as private source material. Crop out personal data when
possible; otherwise remove it in a derivative, then inspect the exported image at
full resolution. Check the card, envelope, handwriting, background, barcodes, and
metadata. Do not present a sanitized image as proof that the original physical
card lacked those details. Avoid altering the depicted handwriting or product
quality in a way that misrepresents fulfillment. Authorization to use photography
does not mean existing raw files are ready to publish.

## Outstanding evidence

See [the integration audit](HANDWRYTTEN_INTEGRATION_AUDIT.md) for verified dimensions
and open supplier details. Remaining inputs are exact stock/envelope specifications,
actual custom-card fulfillment charges, a real Apple Pay test through the ad
journey, ad destination and click/landing metrics, and the dashboard time window.
