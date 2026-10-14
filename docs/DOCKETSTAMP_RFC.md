# DOCKETSTAMP ARCHITECTURAL RFC & BUILDER SPECIFICATION
**Target System:** `docketstamp.com` (Staging & Production Environments)
**Architecture Style:** Next.js App Router + DocuSign-Style Dual-Render Engine + Stripe + Lob Programmatic Mail

---

## 1. ARCHITECTURAL INVARIANTS (FOR VALIDATOR AGENT AUDIT)
Any code merged into `staging` or `main` MUST satisfy these six non-negotiable system invariants:

1. **Invariant 1 — Zero Fitness Conflict (NAICS 713940 Block):**
   - A hard utility function `assertNonFitnessEntity(text: string)` in `src/lib/docket/guardrails.ts` must inspect custom recipient names and template inputs on both client and server, rejecting any submission matching restricted fitness/gym/health-club terms (`equinox`, `planet fitness`, `la fitness`, `crunch`, `orangetheory`, `ymca`, `anytime fitness`, `gold's gym`, `24 hour fitness`, `lifetime fitness`, `f45`, `gym`, `fitness club`).
2. **Invariant 2 — Single-Page Physical Geometry & USPS Clear Zones:**
   - All generated letters are strictly **1 page (`8.5in x 11in`)**.
   - **Certified Mail Top Banner Clear Zone:** Lob reserves the top `1.75in` of Page 1 for the green/white USPS Certified Mail barcode banner when `extra_service` is `"certified"` or `"certified_return_receipt"`.
   - **Dual-Window Envelope Clear Zones:** Lob's standard `#10` envelope exposes the Return Address window at `left: 0.625in, top: 0.5in` and Recipient Address window at `left: 0.625in, top: 2.0in, width: 4.0in, height: 1.0in`.
   - Therefore, our custom **Clerk's Docket Stamp Box** is positioned strictly in the **Top-Right Quadrant (`right: 0.6in, top: 1.85in, width: 3.1in`)**, and body prose starts at `top: 3.35in` with a bottom margin guardrail so text never overflows onto a second page.
3. **Invariant 3 — WYSIWYG Dual-Render Parity:**
   - Both the interactive client-side DocuSign preview (`<DocumentCanvas />`) and the server-side Lob dispatch payload (`renderLobHtmlPayload()`) MUST consume the exact same interpolated paragraph tree (`interpolateNotice(notice, formValues, docketMeta)`).
4. **Invariant 4 — Lob Staging vs. Prod Verification Quirk Handling:**
   - **CRITICAL LOB QUIRK:** Lob's `test_...` API key does NOT verify real-world street addresses on `/v1/us_verifications` (it only returns `deliverable` for synthetic test strings like `"185 Berry St"`).
   - **Solution:** `src/lib/fulfillment/lob.ts` must support two separate environment variables:
     - `LOB_ADDRESS_VERIFICATION_KEY`: Can be set to the `live_...` key in both Staging and Prod (since US address verifications are free/read-only and do not mail anything) OR fall back to a deterministic Staging mock enhancer when `LOB_ENV=staging_mock_cass`.
     - `LOB_DISPATCH_API_KEY`: Strictly `test_...` in Staging (creates real rendered PDF proofs in Lob's dashboard with zero postage cost) and `live_...` in Production.
5. **Invariant 5 — Freeze-Before-Pay Snapshot Integrity:**
   - When the user clicks **"Adopt Signature & Proceed to Payment"**, the server creates an immutable `NoticeOrderDraft` record in the database containing:
     - `docket_id` (`DS-2026-[6-char-alphanumeric]`)
     - `frozen_html_payload` (the exact HTML string that will be sent to Lob)
     - `signed_at_utc` and `signer_ip_hash`
     - `stripe_payment_intent_id`
   - The Stripe webhook (`payment_intent.succeeded`) reads the `frozen_html_payload` directly from the DB and dispatches it to Lob idempotently—guaranteeing the user cannot mutate the letter between payment and printing.
6. **Invariant 6 — UPL Compliance Insulation:**
   - Every rendered letter page (at `bottom: 0.45in`) and every checkout screen renders the locked 7.5pt disclosure:
     `"DOCKET RECORD & DISPATCH CERTIFICATION: Prepared and dispatched via DocketStamp.com (Docket ID: {{docketId}}). DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or advice."`

---

## 2. SYSTEM DATA FLOW & STATE MACHINE