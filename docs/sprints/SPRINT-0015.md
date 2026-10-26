# SPRINT-0015 — High-Converting Document Templates, Terminology Modernization, and Forceful Demand Language

**Status:** Completed  
**Run:** `2026-10-26-high-converting-templates`  
**Owner:** Antigravity Coordinator; Flash Execution Subagents  
**Chapter:** None  

## Pyramid Index

- **L0:** Modernize terminology (replace "cartridge" with "document template", eliminate consumer-facing "deterministic" jargon), restore authoritative first-person demand prose across all 9 templates (fixing the self-defeating Cartridge 08 opt-out disclaimer and Cartridge 02 deposit submission), re-activate 51-jurisdiction statutory deposit lookup, and elevate pricing tier copy for maximum consumer conversion.
- **L1:** Clean division of responsibilities; Flash execution subagents for template updates, routing/pricing/copy updates, and test alignment; zero regression on six system invariants; all letters verified for single-page 8.5" x 11" geometry and USPS clear zones.
- **L2:** See Work Breakdown, Technical Contracts, Subagent Dispatch Plan, and Verification below.

---

## 1. Objectives & Context

DocketStamp's consumer value proposition relies on providing accessible, legally grounded, assertive administrative instruments that command attention when delivered via physical USPS Certified Mail. During Sprint 0011, excessive risk aversion led to defensive hyper-sterilization:
1. **Critical Defect in Cartridge 08 (Arbitration Opt-Out):** The generated letter disclaims its own purpose (*"This is an information request only. It does not itself exercise an opt-out..."*). Senders paying $19.95 to meet a 30-day arbitration opt-out window are disenfranchised.
2. **Disabled Moat in Cartridge 02 (Security Deposit):** The 51-jurisdiction state statutory database (`STATE_STATUTES`) was disconnected (`usesStateStatuteLookup: false`), stripping statutory deadlines and citations from the demand letter, while inserting submissive language (*"Send any amount you agree is due"*).
3. **Neutered Pre-Arbitration Dispute (Cartridge 07):** Demoted to a generic "product complaint," removing all references to Terms of Service, informal dispute resolution requirements, and escalation to formal arbitration or small claims.
4. **Obscure Terminology:** "Cartridge" is internal gaming/engineering jargon confusing to users. "Deterministic" is compiler jargon out of place in consumer-facing marketing and compliance disclaimers.
5. **Defensive Tier Copy:** Pricing tiers in `index.ts` and `app/page.tsx` heavily hedge with phrases like "tracking information may be limited" and "if provided by USPS," hurting conversion.

---

## 2. Scope & Technical Contracts

### A. Terminology & Copy Modernization
- **"Cartridge" -> "Document Template" / "Notice Template":**
  - Update exports, comments, UI text, API schemas, and helper functions in `src/lib/docket/types.ts`, `src/lib/docket/notices/index.ts`, `src/lib/docket/chooser-routing.ts`, `InteractiveHomeWorkbench.tsx`, and `app/api/mcp/route.ts`.
  - Preserve backward-compatibility aliases (e.g., `ALL_NOTICE_CARTRIDGES` as alias for `ALL_DOCUMENT_TEMPLATES`) where external imports require them.
- **"Deterministic" -> Clear, Professional Language:**
  - Replace user-facing references to "deterministic" in `src/lib/docket/guardrails.ts`, `app/disclaimer/page.tsx`, and `app/llms.txt/route.ts` with "standardized administrative form instruments" or "pre-formatted legal templates."

### B. The 9 Upgraded Document Templates
1. **Template 01 (`tenant-notice-of-intent-to-vacate`):**
   - Title: `Tenant Notice of Intent to Vacate & Surrender Premises`
   - Document Header: `FORMAL NOTICE OF INTENT TO VACATE AND SURRENDER PREMISES`
   - Explicit request for joint walkthrough inspection and forwarding of security deposit accounting.
2. **Template 02 (`security-deposit-return-demand-letter`):**
   - Canonical slug: `security-deposit-return-demand-letter` (with `security-deposit-accounting-request` as alias).
   - Re-enable `usesStateStatuteLookup: true`.
   - Title: `Security Deposit Return Demand Letter`
   - Document Header: `FORMAL DEMAND FOR RETURN OF RESIDENTIAL SECURITY DEPOSIT`
   - Restore state statutory citation (`{{statuteCitation}}`) and deadline (`{{statuteDeadline}}`). Replace meek "any amount you agree is due" with firm demand for the requested balance and itemized deduction substantiation.
3. **Template 03 (`tenant-repair-and-maintenance-notice`):**
   - Title: `Tenant Notice of Defective Condition & Demand for Repairs`
   - Document Header: `FORMAL NOTICE OF DEFECTIVE CONDITION AND DEMAND FOR REPAIRS`
   - Firm 5-day inspection/repair schedule demand invoking tenant habitability standards.
4. **Template 04 (`fcra-credit-bureau-written-dispute-letter`):**
   - Canonical slug: `fcra-credit-bureau-written-dispute-letter` (alias: `credit-report-dispute-request`).
   - Title: `Credit Report Dispute Letter`
   - Document Header: `FORMAL NOTICE OF CREDIT REPORT DISPUTE (15 U.S.C. § 1681i)`
   - Assertive reinvestigation demand under Section 611 of the FCRA.
5. **Template 05 (`fdcpa-30-day-debt-validation-letter`):**
   - Canonical slug: `fdcpa-30-day-debt-validation-letter` (alias: `debt-dispute-information-request`).
   - Title: `FDCPA Debt Validation & Dispute Demand`
   - Document Header: `FORMAL NOTICE OF DEBT DISPUTE AND DEMAND FOR VALIDATION (15 U.S.C. § 1692g)`
   - Clear invocation of statutory right requiring cessation of collection activities until verified.
6. **Template 06 (`written-contract-and-policy-cancellation-letter`):**
   - Canonical slug: `written-contract-and-policy-cancellation-letter` (alias: `service-cancellation-request`).
   - Title: `Contract & Subscription Cancellation Notice`
   - Document Header: `FORMAL NOTICE OF CONTRACT TERMINATION AND BILLING REVOCATION`
   - Explicit immediate revocation of automatic ACH / recurring credit card charges.
7. **Template 07 (`pre-arbitration-notice-of-dispute-and-refund-request`):**
   - Canonical slug: `pre-arbitration-notice-of-dispute-and-refund-request` (alias: `product-complaint-refund-request`).
   - Title: `Pre-Arbitration Notice of Dispute & Feature Refund Demand`
   - Document Header: `FORMAL PRE-ARBITRATION NOTICE OF DISPUTE AND REFUND DEMAND`
   - Cites informal dispute resolution requirements under Terms of Service, post-purchase feature degradation, and 30-day resolution period prior to formal arbitration or small claims escalation.
8. **Template 08 (`30-day-mandatory-arbitration-opt-out-notice`):**
   - Canonical slug: `30-day-mandatory-arbitration-opt-out-notice` (alias: `arbitration-opt-out-procedure-request`).
   - Title: `30-Day Mandatory Arbitration Opt-Out Notice`
   - Document Header: `FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS ACTION WAIVER`
   - **CRITICAL FIX:** Restores actual opt-out election (*"I hereby exercise my contractual right to formally opt out..."*), striking the self-defeating information-only disclaimer.
9. **Template 09 (`statutory-health-and-biometric-data-deletion-demand`):**
   - Canonical slug: `statutory-health-and-biometric-data-deletion-demand` (alias: `personal-data-deletion-request`).
   - Title: `Biometric & Personal Data Erasure Demand`
   - Document Header: `FORMAL STATUTORY NOTICE OF CONSENT REVOCATION AND DATA ERASURE DEMAND`
   - Firm revocation of consent for AI training, telemetry ingestion, and secondary profiling.

### C. Pricing Tier & Marketing Copy Optimization
- Replace apologetic hedges with authoritative, trust-building descriptions in `src/lib/docket/notices/index.ts` and `app/page.tsx`:
  - **First-Class ($12.95):** "Direct USPS First-Class dispatch with full DocketStamp certification record and PDF proof archive."
  - **Certified Mail® ($19.95):** "Official USPS Certified Mail® with tracking number, barcode chain-of-custody, and postmark verification."
  - **Certified Mail® + Return Receipt ($27.95):** "Maximum legal leverage: USPS Certified Mail® with Electronic Return Receipt (ERR) signature delivery verification."

---

## 3. Work Breakdown & Subagent Dispatch Plan

| Subagent Role | Target Model | Responsibilities | Assigned Files |
| :--- | :--- | :--- | :--- |
| **Templates Author** | `flash` | Rewrite all 9 notice templates with authoritative demand prose, re-enable state statute lookup on deposit demand, fix Template 08 opt-out election, standardize canonical slugs with aliases. | `src/lib/docket/notices/01-intent-to-vacate.ts` through `09-biometric-privacy-deletion.ts` |
| **Terminology & Marketing Copy Editor** | `flash` | Replace "cartridge" with "document template" in types, exports, chooser routing, API; replace user-facing "deterministic" with accessible language in guardrails, disclaimer, and pricing tiers. | `src/lib/docket/types.ts`, `src/lib/docket/notices/index.ts`, `src/lib/docket/chooser-routing.ts`, `src/lib/docket/guardrails.ts`, `app/page.tsx`, `app/disclaimer/page.tsx` |
| **Test & Parity QA Engineer** | `flash` | Update existing test suites (`sprint-0011-demand-copy.test.ts`, `docket-engine.test.ts`, etc.) to align with updated demand copy, opt-out election, and state statute lookups; ensure all 8.5" x 11" print fit tests pass. | `tests/sprint-0011-demand-copy.test.ts`, `tests/docket-engine.test.ts`, `tests/s2-chooser-and-routing.test.ts` |

---

## 4. Acceptance Criteria

1. **Terminology:** No user-facing UI or customer documentation refers to templates as "cartridges" or uses "deterministic" in consumer sales/compliance copy.
2. **Template 08 Opt-Out Integrity:** The letter explicitly states the consumer's election to opt out of mandatory arbitration and class action waivers; zero disclaimers stating "this is an information request only."
3. **Template 02 Deposit Moat:** `usesStateStatuteLookup` is `true`. The letter renders the state statutory citation and return deadline from `STATE_STATUTES`. The phrase "any amount you agree is due" is eliminated.
4. **Template 07 Pre-Arbitration Framework:** Cites Terms of Service informal dispute resolution provisions and small claims/arbitration reservation.
5. **Pricing Tiers:** Descriptions communicate high confidence and value without undermining disclaimers.
6. **System Invariants:** Single-page 8.5" x 11" geometry, clear zones, dual-render parity, NAICS 713940 fitness blocker, and immutable freeze-before-pay integrity are 100% preserved.
7. **Test Suite:** `npm run test:docket`, `npm test`, and `npx tsc --noEmit` pass with 0 errors.
