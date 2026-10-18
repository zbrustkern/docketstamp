# Homepage and purchase experience v2

**Date:** October 18, 2026

**Status:** User-approved design direction; implementation pending

**Companions:** [Sprint plan and ledger](DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md) · [Builder prompts](DOCKETSTAMP_HOME_BUILDER_PROMPT.md)

## 1. Authority, objective, and scope

This specification replaces [the previous homepage redesign](DOCKETSTAMP_HOME_REDESIGN_SPEC.md). In particular, it supersedes the requirements for a homepage form, category tabs plus dropdown, popular-chip bank, duplicate catalog, expanded company directory, and multiple delivery selectors. The [Master Build Specification](DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](DOCKETSTAMP_AGENTIC_EXPANSION.md) remain authoritative for architecture, documents, data contracts, and all six invariants.

The homepage must explain DocketStamp broadly, help visitors select an existing letter, and carry them into one continuous preparation and purchase journey. Campaign/company/agent links enter that same journey with their existing context. Conversion improvement is a hypothesis to measure, not a promised uplift.

Primary outcome: server-verified paid orders per eligible homepage session. Supporting outcomes: selection-to-workspace progression, completed details/review, payment arrival and success, and abandonment by device and entry source.

In scope: homepage, discovery, company directory, shared workspace presentation and continuity, checkout clarity, truthful status, and measurement. Out of scope: new letter products, statutory prose changes, new prices, legal eligibility advice, account-system redesign, new fulfillment/payment architecture, and production deployment.

### Six invariants

1. Preserve hard NAICS 713940 exclusion on client and server and permitted hardware OEM use cases. Do not showcase prohibited businesses in promotional examples.
2. Preserve exact `STATUTORY_COMPLIANCE_DISCLOSURE` and `UPL_COMPLIANCE_FOOTER_TEXT` in required locations, including checkout/documents. No AI legal advice or outcome guarantees.
3. Preserve single-page 8.5 × 11 inch geometry and Lob clear zones.
4. Use shared `interpolateNotice()` for previews and physical output; no independently authored marketing letter prose.
5. Persist the immutable snapshot before payment credentials are returned. Fulfillment consumes that snapshot without post-payment re-interpolation.
6. Preserve isolated Lob verification/dispatch keys and `staging_mock_cass`. Validation must not incur live postage.

## 2. Observed baseline

The October 18 live review found repeated notice discovery through search, popular chips, category filters, dropdown, full catalog, and company directory; duplicated pricing; homepage fields followed by another editor; a California/tenant default on a generic entry point; tracking controls clipped at 390 px; and no primary Continue in the initial mobile viewport.

An ordinary homepage continuation displayed `AI AGENT PRE-STAGED` and `Instrument parameters were staged deterministically by your agent.` Source inspection shows URL prefills classified as staged while the banner asserts AI origin. A blank preview displays `USPS VERIFIED`. The sample toggle replaces real input values.

Local and deployed code can differ. Builders must inspect current behavior. Concurrent account, authentication, admin, and checkout changes exist; preserve them, including optional `HeaderUserNav` and guest checkout. Older Send My Notes documents are not DocketStamp product authority.

## 3. Information architecture

```text
Home
  Header: brand | How it works | Pricing | Track a letter | account utility
  Hero: service explanation + one letter chooser | illustrative preview
  Three-step process strip
  One informational pricing comparison
  Short FAQ
  Footer: policy links and required disclosures

/companies
  Search companies → resolve purpose → existing letter workspace

/notices/[slug]
  Details → Review and sign → Delivery/payment preparation
    → existing payment experience → authoritative confirmation/tracking
```

Search filters the same chooser; it does not create a second catalog. Remove the full notice grid and company cards from home. Pricing can link back to the chooser; do not add a competing generic hero CTA beside it. Preserve useful old homepage hash links through anchor aliases where practical.

Retain all existing notice slugs and supported `recipientId`, `tier`, `field.*`, `focus`, `stage`, and hydration aliases. Campaign visitors must not detour through home. Preserve REST, MCP, and WebMCP contracts; migrate homepage navigation consumers to the simplified flow rather than leaving dead callbacks.

## 4. Homepage design and copy

### Header

Keep the existing brand and compact navigation. `Track a letter` opens a closed-by-default disclosure or accessible dialog containing the current ID lookup. Preserve optional sign-in/account navigation and authorized admin access from ongoing account work. No account gate before preparation or guest checkout. Keep developer/admin destinations out of public promotional navigation without removing authorized functionality.

At 320 px, brand and utilities fit without horizontal overflow. Consolidate utilities into a labeled menu if needed. Menus/dialogs support keyboard activation, Escape, focus return, and accessible labels.

### Hero baseline copy

> **Prepare your letter. We’ll print and mail it.**

> Choose a letter, add your details, and review it before paying. Printing and postage included. Certified Mail available.

- Chooser heading: **What do you need to send?**
- Search label: **Find a letter or company**
- Search placeholder: **Try “deposit return” or “Equifax”**
- Price cue: **Mailing from $12.95. Certified Mail from $19.95.** Derive amounts from the registry.
- Selected-state action: **Continue**
- Helper: **You’ll review your letter before paying.**

Desktop: balanced explanation/chooser and preview columns in a 1200–1280 px container. Preview supports selection without dominating it. Keep the selected summary and Continue near the chooser header; the choice list may have clearly indicated internal scrolling. At 1280 × 720, explanation, selection affordance, price cue, and selected-state Continue are visible without document scrolling.

Mobile: explanation, chooser, selected-state Continue, then an optional `Preview letter` disclosure. At 390 × 844, selection affordance and continuation area are reachable in the initial viewport; the full list can scroll. Do not place a full paper above selection or shrink text to meet the target.

### Visual language

Retain navy/slate, white paper, blue actions, and amber required fields. Serif for headline/documents; sans-serif for guidance/forms; monospace sparingly for IDs. Avoid gradients, decorative sparkle icons, pulsing CTAs, repeated badges, all-caps interface paragraphs, and implied court/government affiliation.

Target 16 px body/input text, approximately 14 px utility text, comfortable line height, WCAG AA contrast, visible focus, and approximately 44 px targets. Respect reduced motion. Sticky controls must not cover errors, fields, disclosures, or the mobile keyboard.

## 5. One chooser and shared routing

Show the nine letters once with plain display titles and one short explanation each. Group headings may aid scanning; do not add category tabs plus dropdown. Presentation metadata is separate from canonical document titles, schemas, and slugs.

| Display title | Existing slug |
| --- | --- |
| Request a security deposit return | `security-deposit-return-demand-letter` |
| Give move-out notice | `tenant-notice-of-intent-to-vacate` |
| Request repairs | `tenant-repair-and-maintenance-notice` |
| Dispute a credit-report error | `fcra-credit-bureau-written-dispute-letter` |
| Request debt verification | `fdcpa-30-day-debt-validation-letter` |
| Cancel a service or policy | `written-contract-and-policy-cancellation-letter` |
| Request a refund for changed product features | `pre-arbitration-notice-of-dispute-and-refund-request` |
| Send an arbitration opt-out notice | `30-day-mandatory-arbitration-opt-out-notice` |
| Request deletion of personal data | `statutory-health-and-biometric-data-deletion-demand` |

Initial state: no real letter, company, jurisdiction, or tier selected by the visitor. The example does not count as selection. Do not infer California/company details from it.

Search matches curated aliases, display titles, and registry company names deterministically. No chatbot. Empty query restores the list. Letter/company results appear within the same component. No results: `No matching letter or company found.` Offer the complete list and manual recipient where supported. Company-list absence is not itself a service exclusion.

Letter selection updates the summary, preview, and Continue. Company selection is optional; typing a search does not choose a recipient. If only one compatible purpose exists, it may select that letter. If multiple exist, ask `What would you like to send to [company]?` In particular, hardware selections must offer existing refund, arbitration opt-out, and deletion purposes where supported rather than silently routing everyone to refunds.

Use an explicit shared compatibility resolver for chooser/directory. Do not extend eligibility beyond existing recipient modes. Preserve a company only across compatible letter changes; visibly explain a cleared selection. Prohibited input receives concise unsupported-category feedback and cannot Continue, with existing server enforcement retained.

Continue goes straight to `/notices/[slug]` with supported selected context. Collect no names, addresses, account IDs, dates of birth, signatures, or substantive letter fields on home. Do not put those values in newly generated homepage URLs; retain external prefill compatibility.

Build `/companies` using existing registry data, accessible search, and the same purpose resolver. Link from the chooser as a secondary utility. Do not publish new address-verification claims. Postal deliverability does not establish a contract-specific notice destination. Record questionable registry entries for data review; do not silently invent replacement addresses.

## 6. Preview and truthful state

Initial preview label: **Example letter — preview only**. Selected preview: **Letter preview — add your details next**. Use shared interpolation with blank personal values. Any filled example is isolated and read-only; closing it restores the draft exactly. Example data must never hydrate, sign, lock, pay for, or dispatch a real order.

A selected preview token may continue to the relevant workspace field. It must not create another homepage form or turn an initial unselected example into a real selection. Mobile preview is expandable. Scale its container without changing physical print dimensions or hiding clipped output as a layout fix.

Do not show mailed, paid, signed, or verified status prematurely. Verification applies only to the current checked address; editing it invalidates the result. Distinguish unverified/checking/confirmed/failed/unavailable and staging simulation. Registry presence alone is not evidence of a current CASS check. Verification concerns postal addressing, not legal sufficiency.

Neutral prefill copy: `Your draft is ready to continue. Review the details before signing.` URL parameters do not establish AI provenance. If origin is uncertain, use neutral copy even for staged drafts. Preserve real stage loading, expiration, missing-field handling, and human signature/payment requirements. Loading: `Loading your draft…`. Failure preserves current inputs with retry or an explicit fresh-start action.

## 7. Continuous preparation and purchase

Evolve the existing workspace rather than building a parallel form engine:

1. **Details:** sender, recipient, and template fields, with conditional inputs and actual validation.
2. **Review and sign:** shared preview, edit links, existing affirmation and mandatory disclosures.
3. **Delivery and payment:** one interactive tier selector, notification email, total, disclosures, and existing payment entry.

Existing drawer/modal boundaries may remain. Payment redirects are acceptable when draft, price, and next action remain clear; do not rewrite the commerce spine to keep everything on one URL.

Completion includes required sender/recipient addresses, not just template fields. Nonempty invalid dates, addresses, selections, and bounded fields do not count as ready. Progress matches actual requirements. Focus the first invalid/missing field; signature-only state focuses signature controls, not sender name. Do not require re-entry of supplied compatible data.

Preserve values during stage navigation, preview, validation retry, and canceled payment preparation. Keep existing resume behavior; if absent, add session-scoped recovery for the current letter with explicit reset, no cross-account exposure, and no permanent sensitive-data storage. New explicit stage/prefill context takes precedence over unrelated recovered data. Repeated hydration must not overwrite subsequent user edits. Back from payment restores the intended draft or gives a clear recovery path.

Tie signature/verification to draft revision. Material content/address edits after signing require re-review and renewed confirmation; address edits also invalidate verification. Tier changes update price/preview before locking. Changed content/tier after initialization uses a safe fresh lock/payment attempt; never mutate a paid snapshot, reuse an obsolete amount, or create a duplicate dispatch path.

Interface labels: `Your details`, `Recipient`, `Letter details`, `Review your letter`, `Confirm signature`, `Continue to delivery`, `Continue to payment — $X`. Only the control that actually confirms payment may say `Pay $X and send letter`. Distinguish `Payment received`, `Submitted for mailing`, and later postal status. Keep formal document titles and compliance text intact.

## 8. Supporting sections and editorial rules

Process strip: `Choose your letter` / `Add details and review` / `Pay and we mail it`, with at most one explanatory sentence per step.

Homepage pricing is informational. Source prices from `DOCKET_PRICING_TIERS`: First-Class $12.95, Certified $19.95, Certified + Return Receipt $27.95. Describe verified print/envelope/postage inclusion and service differences. First-Class barcode observations are not Certified acceptance/delivery proof. Do not guarantee a signature, delivery, or immediate receipt artifact.

Remove `Most Popular` without purchase evidence. Existing template recommendations may be labeled `Recommended`, visibly optional and not a legal requirement. Keep every supported tier selectable and show the selected total clearly.

FAQ: price inclusion, review before payment, mail-service differences, tracking/status access, what happens after payment, and service limitations. Answers must match current code/provider evidence. Do not invent cutoffs, instant PDF availability, wallet support, attachments, cancellation rights, or delivery guarantees. Link policies and record unsupported facts as evidence gaps.

Remove inflated or implementation-specific marketing/UI text: `They can’t ignore`, `COURT PROOF`, `court-ready`, guaranteed 60-second completion, automatic refund/cancellation promises, unsupported press specifications, `physical postal transmission tier`, `hydrating`, `deterministically`, and Lob geometry guidance. Audit metadata, accessibility labels, loading/error states, and checkout too. No generic feature grid or invented testimonials. Mandatory disclosures are exempt from stylistic rewriting.

## 9. Architecture and measurement boundaries

Keep registries, interpolation, schemas, bounded fields, staged-draft transport, optional auth, payment ownership/tokens, server amount validation, and webhook idempotency authoritative. Prefer presentation metadata and shared routing helpers over duplicated business logic. Remove old homepage events/state only after consumers migrate.

Extend existing telemetry types, schema/allowlist, ingestion, and server purchase events. Do not add an analytics vendor. Measure home view, letter selection, workspace start, details/review completion, checkout initiation, payment view, and authoritative payment success. Existing equivalent events can be reused with explicit documented mappings.

Allowlist only safe metadata: experience version, entry source (`home`, `direct`, `company`, `agent_or_prefill`, `unknown`), canonical slug, tier, step, device, and opaque session/order correlation under existing access controls. Never collect letter content, personal values, company search text, raw errors/query strings, stage tokens, or payment secrets. Do not claim confirmed agent origin from prefills. Client code cannot emit financial/fulfillment authority events.

Paid orders/session uses server-verified orders deduped by order ID and correlated to the originating eligible session. Separate homepage-entry, direct GTM, and tracking-only cohorts; exclude tests/internal traffic. Document unknown attribution instead of treating clicks as revenue. Initial delivery requires a reporting recipe, not an A/B platform or invented baseline.

## 10. Completion gate

Complete the seven sprint gates with code, browser, and integration evidence. Cover all nine routes, compatible/ambiguous companies, manual recipients, excluded categories, ordinary/staged prefills, optional auth, errors/back/retry, signatures, verification, all tiers, and immutable snapshots. Validate geometry/parity for affected rendering paths. Use mock/staging payment and fulfillment only. No live purchase, postal dispatch, production deployment, or unmeasured conversion claim is included in this build.
