# Project Context & Agent Operating Directives

Read [the Master Build Specification](docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md) and
[the Agentic Expansion Specification](docs/DOCKETSTAMP_AGENTIC_EXPANSION.md) before
planning, designing, implementing, or writing customer-facing code or copy.

These documents record the canonical architecture, data structures, and operational decisions
for DocketStamp (`docketstamp.com`) and supersede all conflicting statements in older documents.

## System Invariants

Enforce all six system invariants at all times:

1. **Hard NAICS 713940 Fitness Blocker**
   `assertNonFitnessEntity` in `src/lib/docket/guardrails.ts` strictly blocks gyms, health clubs,
   fitness studios, and fitness membership billing (NAICS 713940) while permitting consumer electronics,
   connected hardware, and appliance OEMs (Withings, Garmin, Ecobee, LG, Samsung, Canon, Sonos, Roku, Tesla, etc.).

2. **UPL-Safe Administrative Form Letter Positioning**
   DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, NOT a law firm.
   All notices use deterministic `{{tokens}}` with no open-ended AI legal advice. The mandatory
   `UPL_COMPLIANCE_FOOTER_TEXT` and statutory disclosures must be preserved on all instruments and pages.

3. **Single-Page 8.5" x 11" Geometry & USPS Clear Zones**
   Letters must fit on a single page (8.5" x 11") with Lob address and clear zone boundaries strictly
   observed (`src/lib/docket/renderer/lob-html-shell.ts`).

4. **WYSIWYG Dual-Render Parity**
   `interpolateNotice()` is shared identically between the interactive client canvas (`<LivePaperSheet />`)
   and server-side Lob physical print generation (`renderLobHtmlPayload()`).

5. **Freeze-Before-Pay Snapshot Integrity**
   `/api/docket/lock-and-intent` persists an immutable `frozen_html_payload` / `documentHtml` snapshot
   before Stripe payment confirmation. Post-payment rendering never re-interpolates mutable inputs.

6. **Lob Staging vs. Production API Key Separation**
   `LOB_ADDRESS_VERIFICATION_KEY` vs `LOB_DISPATCH_API_KEY` are isolated. When `LOB_ENV=staging_mock_cass`,
   deterministic CASS address validation runs without incurring production postal fees.
