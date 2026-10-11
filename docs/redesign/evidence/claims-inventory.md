# Claims Inventory and Classification

**Audited:** October 11, 2026  
**Governing Documents:** [CANONICAL_PRODUCT_SPECS.md](../../CANONICAL_PRODUCT_SPECS.md), [CANONICAL_PROJECT_BRIEF.md](../../CANONICAL_PROJECT_BRIEF.md), [CONVERSION_REDESIGN_WORK_PLAN.md](../../CONVERSION_REDESIGN_WORK_PLAN.md) (§0, §4.4)  
**Task:** S0-05 (incorporating former S0-01 claims inventory)  
**Auditor / Implementer:** Lane C (`smn-implementer`)

---

## 1. Summary of Forbidden Claims & Canonical Truths

Per `CANONICAL_PRODUCT_SPECS.md` and `CONVERSION_REDESIGN_WORK_PLAN.md` §4.4:
- **Dimensions / Format:** Canonical is **Folded A2** (4.25 × 5.5 inches folded, 8.5 × 5.5 inches open, front aspect ratio 17:22). Never claim "5×7", "5x7", "5 x 7" as the product dimension.
- **Paper & Stock:** Canonical is neutral **"cardstock"**. Never claim paper weights ("100 lb", "120 lb", "70 lb"), "cotton", "archival", "letterpress", or "blind-deboss / deboss / emboss".
- **Writing Instrument / Process:** Message written by **automated equipment holding real pens** (precision robotic pen plotting). Never claim "human handwriting".
- **Postage & Mailing:** **USPS First-Class** with an authentic physical postage stamp. Never promise a specific stamp design, never imply a sender-local postmark (cards mail via supplier's Phoenix, AZ facility).
- **Fulfillment & Transit Timing:** Preparation typically **1–2 business days**, domestic transit typically **2–7 business days**. Estimates only. Never claim "mailed today", "same-day dispatch", guaranteed arrival dates, or rigid "2 PM cutoff".
- **Pricing:** **$9.00 USD** (900 cents) flat rate including mailing.
- **Checkout & Device Claims:** Never claim "Apple Pay ready" (wallet readiness is unverified end-to-end), nor measured "60 seconds" completion times.
- **Branding in Sender Journey:** SendMyNotes is the primary sender brand. Aster & Blanche Press is preserved only on the physical card backplate/colophon, recipient-facing surfaces, and internal admin/legal pages (pending D5). Remove "Aster & Blanche Atelier", "commission", "stationery leaf", and "inking coordinates" from sender-facing flows.

---

## 2. Line-Level Inventory & Classification Table

### Classification Categories:
- **FIX (Lane C Owned)**: In scope for S0-05 implementation. Neutralized or updated using `lib/product-facts.ts`.
- **CONTRACT CHANGE (Lane A / S0-04)**: Checkout safety lane owns these files (`components/v3/Step4ReviewAndPayment.tsx`, `components/CheckoutStep.tsx`, `components/VendingMachineBuilder.tsx`, `lib/stripe.ts`). S0-05 requests exact replacement.
- **CONTRACT CHANGE (Lane D / S1-04, S1-05)**: Mobile entrance / card selection lane owns these files (`components/v3/Step1CardSelection.tsx`, `components/v3/CustomAiCommissionDrawer.tsx`). S0-05 requests exact replacement.
- **CONTRACT CHANGE (Other Lanes / Future Tasks)**: S0-08 / S2 / S3 owns `components/CardPreview.tsx`, `lib/nano-banana.ts`, `lib/handwrytten.ts`.
- **KEEP (Canonical / Legal / Admin / Recipient)**: A&B on backplate, legal pages pending D5, admin instrumentation, or colloquial figurative expressions (e.g. "favorite human", "today treats you kindly").

| File | Line(s) | Excerpt / Claim | Issue / Rule | Classification | Owner / Action |
| --- | --- | --- | --- | --- | --- |
| `app/layout.tsx` | 16 | `120 lb archival cardstock` | Unsupported paper weight & archival claim | FIX (Lane C) | Replace with neutral cardstock wording |
| `app/layout.tsx` | 18–19 | `authors: [{ name: "Aster & Blanche Press" }]`, `creator` | A&B brand in sender SEO metadata | FIX (Lane C) | Change creator/author to SendMyNotes |
| `app/layout.tsx` | 26 | `"custom 5x7 folded cards"` | 5x7 dimension claim in keywords | FIX (Lane C) | Replace with "folded greeting cards", "A2 folded cards" |
| `app/layout.tsx` | 35 | `120 lb archival cardstock` | Unsupported paper weight & archival claim | FIX (Lane C) | Replace with neutral cardstock wording |
| `app/layout.tsx` | 54 | `120 lb archival cardstock` | Unsupported paper weight & archival claim | FIX (Lane C) | Replace with neutral cardstock wording |
| `app/layout.tsx` | 92, 95 | `name: "Custom Handwritten 5x7 Greeting Card"`, `120 lb archival cardstock` | 5x7 and 120 lb archival claims in Schema.org LD-JSON | FIX (Lane C) | Replace with "Folded Handwritten Greeting Card", neutral cardstock |
| `app/layout.tsx` | 98 | `name: "Aster & Blanche Press"` | A&B brand in schema brand | FIX (Lane C) | Replace with "SendMyNotes" |
| `app/new/page.tsx` | 5 | `Send a Real Handwritten Card in 60 Seconds \| SendMyNotes` | Unmeasured "60 seconds" claim | FIX (Lane C) | Remove "in 60 Seconds" from title |
| `app/page.tsx` | 20 | `Opening Aster & Blanche Atelier...` | Atelier / A&B loading text in sender root | FIX (Lane C) | Replace with "Opening SendMyNotes..." |
| `app/send/[occasion]/page.tsx` | 294 | `and mail in 60 seconds.` | Unmeasured "60 seconds" claim | FIX (Lane C) | Replace with "and send in minutes." |
| `app/send/[occasion]/page.tsx` | 339 | `Actual ballpoint pen ink physically pressed into heavyweight cardstock` | Heavyweight claim | FIX (Lane C) | Neutralize to "folded cardstock" |
| `app/send/[occasion]/page.tsx` | 359 | `Complete your card in 60 seconds from your phone.` | Unmeasured "60 seconds" claim | FIX (Lane C) | Replace with "Complete your card in minutes from your phone." |
| `app/send/[occasion]/page.tsx` | 380 | `Cards are produced and dispatched within 24 hours. USPS First Class mail generally delivers in 2 to 5 business days` | 24-hr guarantee & obsolete 2–5 days window | FIX (Lane C) | Update to 1–2 business days prep, 2–7 business days domestic transit estimates |
| `app/send/[occasion]/[slug]/page.tsx` | 264 | `Apple Pay & Google Pay` | Unverified Apple Pay readiness claim | FIX (Lane C) | Replace with "Secure Online Checkout" |
| `app/send/[occasion]/[slug]/page.tsx` | 279 | `Step 1 of 4 • Edit names and mail in 60 seconds` | Unmeasured "60 seconds" claim | FIX (Lane C) | Replace with "Step 1 of 4 • Edit names and personalize" |
| `app/order/[id]/page.tsx` | 346–347 | `5×7 folded card printed with rich front cover artwork.` | 5x7 dimension claim | FIX (Lane C) | Replace with "Folded card printed with front cover artwork." |
| `app/order/[id]/page.tsx` | 358 | `postmarked on ${order.scheduledSendDate}` | Postmark date promise | FIX (Lane C) | Replace with "queued to be penned and mailed around..." |
| `app/order/[id]/page.tsx` | 823 | `Physical 5×7 Folded Card` | 5x7 dimension claim | FIX (Lane C) | Replace with "Physical Folded Card" |
| `app/order/[id]/layout.tsx` | 5 | Metadata description | Clean, no unsupported claims | KEEP (Lane C) | Confirmed clean |
| `public/llms.txt` | 4 | `penned with real ballpoint ink by robotic plotters in Lake Forest, IL` | Implies Lake Forest mailing origin / postmark | FIX (Lane C) | Clarify automated pen plotting; mailing originates via Phoenix, AZ facility |
| `public/llms.txt` | 13 | `5×7 portrait greeting card front covers.` | 5x7 dimension claim | FIX (Lane C) | Replace with "Folded A2 (4.25 × 5.5 in) portrait greeting card" |
| `public/llms.txt` | 14 | `120 lb archival cardstock` | Unsupported paper weight & archival claim | FIX (Lane C) | Replace with "premium cardstock" |
| `lib/meta-ads.ts` | 316 | `content_name: params.itemName \|\| "Custom 5x7 Folded Handwritten Card"` | 5x7 dimension claim | FIX (Lane C) | Replace with "Custom Folded Handwritten Card" |
| `lib/google-ads.ts` | 156 | `item_name: params.itemName \|\| "Custom 5x7 Folded Handwritten Card"` | 5x7 dimension claim | FIX (Lane C) | Replace with "Custom Folded Handwritten Card" |
| `lib/seo-scenarios.ts` | 74 | `written in real pen on heavy archival cardstock.` | Archival claim | FIX (Lane C) | Replace with "written in real pen on quality folded cardstock." |
| `lib/seo-scenarios.ts` | 632 | `5x7 folded cardstock` | 5x7 dimension claim | FIX (Lane C) | Replace with "folded cardstock" |
| `components/InsideNoteStep.tsx` | 106 | `Written with a real ballpoint pen on heavy 120 lb archival cardstock.` | 120 lb archival claim | FIX (Lane C) | Replace with "Written with a real ballpoint pen on folded cardstock." |
| `components/CoverStep.tsx` | 187 | `5×7 Front Cover Art` | 5x7 dimension claim | FIX (Lane C) | Replace with "Front Cover Art" |
| `components/CoverStep.tsx` | 291 | `Aster & Blanche Bespoke Atelier` | Atelier brand in sender UI | FIX (Lane C) | Replace with "SendMyNotes Custom Studio" |
| `components/CoverStep.tsx` | 321 | `title="Click to view full 5×7 card cover"` | 5x7 dimension claim | FIX (Lane C) | Replace with "Click to view full card cover" |
| `components/CoverStep.tsx` | 362 | `Tap artwork to view full 5×7 greeting card preview` | 5x7 dimension claim | FIX (Lane C) | Replace with "Tap artwork to view full greeting card preview" |
| `components/CoverStep.tsx` | 409 | `FULL-SCREEN 5×7 LIGHTBOX PREVIEW MODAL` | 5x7 comment | FIX (Lane C) | Update comment |
| `components/CoverStep.tsx` | 424 | `Aster & Blanche Studio Preview` | A&B brand in sender modal | FIX (Lane C) | Replace with "SendMyNotes Card Preview" |
| `components/CoverStep.tsx` | 453 | `Printed on 120 lb archival cardstock` | 120 lb archival claim | FIX (Lane C) | Replace with "Printed on quality folded cardstock" |
| `components/v3/Step2NoteComposition.tsx` | 465 | `Authentic Inking Guarantee:` | Hard guarantee terminology | FIX (Lane C) | Replace with "Real Pen Inking:" |
| `components/v3/Step3EnvelopeAddressing.tsx` | 139 | `Penned directly on a 70 lb matching stationery envelope.` | 70 lb envelope weight claim | FIX (Lane C) | Replace with "Penned directly on a matching stationery envelope." |
| `components/v3/Step3EnvelopeAddressing.tsx` | 215 | `Matching 70 lb Premium Cream Envelope` | 70 lb envelope weight claim | FIX (Lane C) | Replace with "Matching Premium Cream Envelope" |
| `components/v3/Step5Confirmation.tsx` | 221 | `loaded with genuine ballpoint ink on 120 lb archival cardstock.` | 120 lb archival claim | FIX (Lane C) | Replace with "loaded with genuine ballpoint ink on quality cardstock." |
| `components/v3/Step5Confirmation.tsx` | 236 | `Enclosed in 70 lb envelope with authentic USPS stamp. Scheduled for next business day carrier dispatch.` | 70 lb envelope weight claim & next day dispatch guarantee | FIX (Lane C) | Replace with "Enclosed in a matching envelope with an authentic USPS stamp. Typically prepared in 1–2 business days." |
| `components/v3/Step5Confirmation.tsx` | 251 | `Nationwide transit window (3–5 business days)` | Obsolete transit window | FIX (Lane C) | Replace with "Typically 2–7 business days domestic transit" per canonical specs |
| `lib/email-alerts.ts` | 173 | `Aster & Blanche Occasion Reminder` | A&B in customer reminder email header | FIX (Lane C) | Change to "SendMyNotes Occasion Reminder" |
| `lib/email-alerts.ts` | 177 | `1-2 days to ink and 3-4 days to deliver via USPS First Class` | Timing phrasing | FIX (Lane C) | Update to typical 1–2 business days prep and 2–7 business days transit estimates |
| `lib/email-alerts.ts` | 184 | `Aster & Blanche Press \| sendmynotes.com` | A&B sign-off in customer email | FIX (Lane C) | Replace with "SendMyNotes \| sendmynotes.com" |
| `lib/email-alerts.ts` | 213 | `Real ballpoint pen inking takes 1–2 business days, followed by 2–4 days USPS First Class transit.` | Update transit window | FIX (Lane C) | Update to typically 2–7 business days domestic transit estimates |
| `lib/email-alerts.ts` | 221 | `Aster & Blanche Press • Real pen handwritten cards` | A&B footer in customer email | FIX (Lane C) | Replace with "SendMyNotes • Real pen handwritten cards" |
| `lib/email-alerts.ts` | 244 | `Aster & Blanche Reminders <...>` | A&B from-name in customer email | FIX (Lane C) | Replace with "SendMyNotes Reminders <...>" |
| `lib/delivery-estimate.ts` | 1–65 | 2 PM cutoff logic, Sunday-only skipping, assumed single-day inking | Rigid SLA calculation without holidays or conservative range | FIX (Lane C) | Rewrite using `lib/product-facts.ts` timing constants with holiday/weekend skipping and clear estimated labeling |
| `components/VendingMachineBuilder.tsx` | 548 | `Atelier` tab label | Atelier in sender UI | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "Custom Studio" or "Design" |
| `components/VendingMachineBuilder.tsx` | 644 | `The thoughtful gesture you meant to make today—done in 60 seconds.` | 60 seconds claim | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "The thoughtful gesture you meant to make—sent in minutes." |
| `components/VendingMachineBuilder.tsx` | 648 | `120 lb archival cardstock, stamp it, and mail it via USPS today for a flat $9.00` | 120 lb archival, "mailed today" | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "cardstock, stamp it, and mail it via USPS for a flat $9.00" |
| `components/VendingMachineBuilder.tsx` | 775, 778 | `120 lb Cardstock`, `Archival Ink` | 120 lb and archival claims | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "Folded Cardstock", "Real Pen Ink" |
| `components/CheckoutStep.tsx` | 407 | `5×7 Heavy Cardstock & Real Pen Handwriting` | 5x7 claim | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "Folded Cardstock & Real Pen Handwriting" |
| `components/v3/TargetPurchaseExperience.tsx` | 472 | `Real Pen-Written Cards In 60 Seconds` | 60 seconds claim | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "Real Pen-Written Cards, Mailed For You" |
| `components/v3/TargetPurchaseExperience.tsx` | 597 | `Luxury 120 lb Archival Cardstock • Flat $9.00 Rate` | 120 lb archival claim | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "Folded A2 Cardstock • Flat $9.00 Rate (Mailing Included)" |
| `components/v3/Step4ReviewAndPayment.tsx` | 316 | `A2 Folded Stationery Leaf (4.25" × 5.5")` | "Stationery Leaf" jargon | CONTRACT CHANGE (Lane A / S0-04) | Recommend replacing with "A2 Folded Card (4.25" × 5.5")" |
| `components/v3/Step4ReviewAndPayment.tsx` | 561 | `100% Satisfaction Guarantee` | Guarantee claim | CONTRACT CHANGE (Lane A / S0-04) | Recommend reviewing with founder (or change to satisfaction promise) |
| `components/v3/Step1CardSelection.tsx` | 76 | `Luxury 120 lb archival cardstock • Real ballpoint inking` | 120 lb archival claim | CONTRACT CHANGE (Lane D / S1-04) | Recommend replacing with "Folded A2 cardstock • Real ballpoint inking" |
| `components/v3/Step1CardSelection.tsx` | 84, 87 | `Ready-Made Stationery Leaf Collection`, `authentic front leaf`, `commission custom artwork` | "Leaf" & "commission" jargon | CONTRACT CHANGE (Lane D / S1-04) | Recommend replacing with "Ready-Made Card Collection", "card design", "create custom artwork" |
| `components/v3/Step1CardSelection.tsx` | 239 | `+ Commission custom artwork with Studio AI (~15s)` | "Commission" jargon | CONTRACT CHANGE (Lane D / S1-04) | Recommend replacing with "+ Create custom artwork with Studio AI" |
| `components/v3/CustomAiCommissionDrawer.tsx` | 8, 73, 114, 152, 162 | `CustomAiCommissionDrawer`, `Studio AI Art Commission` | "Commission" jargon in drawer | CONTRACT CHANGE (Lane D / S1-05) | Scheduled for S1-05 rename / update |
| `components/CardPreview.tsx` | 45, 184, 211 | `Letterpress Border`, `Letterpress Effect` | Letterpress comments / CSS | CONTRACT CHANGE (S0-08) | S0-08 owns `CardPreview.tsx` |
| `components/CardPreview.tsx` | 191 | `5×7 View` | 5x7 comment | CONTRACT CHANGE (S0-08) | S0-08 owns `CardPreview.tsx` |
| `components/CardPreview.tsx` | 206 | `Pristine Unprinted Archival Cardstock` | Archival comment | CONTRACT CHANGE (S0-08) | S0-08 owns `CardPreview.tsx` |
| `components/CardPreview.tsx` | 251, 257 | `Aster & Blanche Press Card Back Colophon` | Backplate colophon on physical card back | KEEP (Canonical) | Canonical backplate per source §7 |
| `lib/stripe.ts` | 56 | `5x7 Physical Folded Greeting Card with Real Pen Inking` | 5x7 dimension claim in Stripe product | CONTRACT CHANGE (Lane A / S0-04) | Per §0.3 row 80, S0-04 replaces with neutral string, S0-05 exports constants in `lib/product-facts.ts` |
| `lib/device-wallet.ts` | 50 | `badgeText: "Apple Pay Ready • No Account"` | Unverified Apple Pay readiness claim | CONTRACT CHANGE (Lane A / S3-03) | Owned by S3-03 |
| `lib/handwrytten.ts` | 24, 56, 99, 200, 270 | Aster & Blanche backplate upload & fallback | Supplier backplate & sender fallback | CONTRACT CHANGE (S0-06) | S0-06 removes fallback; backplate itself is kept |
| `lib/handwrytten.ts` | 122 | `A2 Folded Portrait Custom Card (5x7 equivalent)` | Comment in Handwrytten integration | CONTRACT CHANGE (S0-08) | Comment in S0-08 file |
| `lib/nano-banana.ts` | 94, 313 | `Curated Aster & Blanche 5:7 boutique presets` | Internal prompt & fallback comments | CONTRACT CHANGE (S0-08) | S0-08 owns generation output stage |
| `lib/nano-banana.ts` | 127 | `Do NOT render any human hands` | Prompt instruction forbidding human hands in generated art | KEEP (Canonical) | Prompt constraint preventing hands from rendering in art |
| `lib/nano-banana.ts` | 145 | `const aspectRatio = "5:7";` | Aspect ratio in generation | CONTRACT CHANGE (S0-08) | S0-08 updates to 17:22 |
| `lib/thematic-sentiment.ts` | 43 | `lead greeting card writer for Aster & Blanche` | LLM prompt instruction for pun sentiment | CONTRACT CHANGE (S2-01) | S2-01 owns sentiment prompts |
| `lib/card-presets.ts` | 44 | `one of my favorite humans!` | Warm conversational phrase in preset note | KEEP (Figurative) | Warm birthday greeting copy; not claiming human handwriting equipment |
| `lib/seo-scenarios.ts` | 545 | `favorite human on Earth!` | Warm conversational phrase in scenario note | KEEP (Figurative) | Warm birthday greeting copy; not claiming human handwriting equipment |
| `lib/metrics-rollup.ts` | 705, 709 | `humanVisitors` | Bot vs non-bot telemetry metric | CONTRACT CHANGE (Lane B / S0-02) | Telemetry metric owned by Lane B |
| `lib/types.ts` | 420 | `humanVisitors: number;` | Telemetry type | CONTRACT CHANGE (Lane B / S0-02) | Telemetry type owned by Lane B |
| `app/terms/page.tsx` | 7, 73, 81, 142 | Legal terms mentioning A&B, cotton cardstock | Legal page pending founder decision D5 | KEEP (Pending D5) | Explicit non-goal per §0.4 and task prompt |
| `app/privacy/page.tsx` | 7, 166, 266 | Privacy policy mentioning A&B, 120 lb archival cardstock | Legal page pending founder decision D5 | KEEP (Pending D5) | Explicit non-goal per §0.4 and task prompt |
| `app/return-policy/page.tsx` | 18, 48, 66, 116 | Return policy mentioning A&B, cotton cardstock | Legal page pending founder decision D5 | KEEP (Pending D5) | Explicit non-goal per §0.4 and task prompt |
| `app/admin/page.tsx` | 2094 | Admin dashboard cardstock reference | Operator-facing admin console | KEEP (Admin) | Internal operator console, not customer-facing |
| `components/admin/*` | various | A&B brand and Postmark references in admin tools | Operator-facing admin tools | KEEP (Admin) | Internal operator tooling |
| `public/site.webmanifest` | 4 | `Custom 5x7 folded greeting cards...` | PWA manifest description | FIX (Lane C) | Update to neutral folded cards |
