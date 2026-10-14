# DocketStamp Product & Architectural Specification

**Document Version:** 1.0.0  
**Effective Date:** October 14, 2026  
**Parent Entity:** Western Amalgamated  
**Product:** DocketStamp (`docketstamp.com`)  
**Tagline:** *"Official Document & Certified Mail Dispatch Registry"*  
**Companion Documents:** [`docs/DESIGN_SYSTEM.md`](file:///Users/zeke/code/DocketStamp/docs/DESIGN_SYSTEM.md), [`ARCHITECTURE.md`](file:///Users/zeke/code/DocketStamp/ARCHITECTURE.md)

---

## 1. Brand Identity & Mission

**DocketStamp** (`docketstamp.com`) is an authoritative self-help legal notice preparation and postal dispatch utility operated by **Western Amalgamated**.

DocketStamp provides individuals, tenants, and consumers facing urgent statutory and contractual deadlines with a formal, state-referenced notice drafting engine and immediate physical dispatch via the United States Postal Service (USPS First-Class, USPS Certified Mail®, and USPS Certified Mail® with Electronic Return Receipt).

### Core Brand Attributes
- **Authoritative & Institutional**: Evoking the gravitas of a federal court docketing clerk and official registry.
- **Urgent & High-Assurance**: Engineered for senders with critical legal rights at stake (statutory response windows, lease termination notice requirements, security deposit accounting deadlines).
- **Court-Ready Audit Trail**: Every transaction generates a cryptographic registry docket ID (`DS-2026-XXXXX`), CASS address verification stamp, timestamped audit manifest, and postal tracking docket.

---

## 2. Core Value Proposition

Consumers and tenants facing time-sensitive legal or contractual situations need to assert formal rights without hiring expensive legal counsel or navigating slow physical post office lines.

Using DocketStamp, a user can:
1. Select a deterministic, state-specific notice template.
2. Complete all required factual variables in an intuitive, DocuSign-style guided interface in under 60 seconds.
3. Adopt a formal `/s/ [Full Name]` digital signature and apply an authoritative Docket Stamp.
4. Dispatch the formal physical instrument immediately via physical USPS First-Class or Certified Mail using the Lob programmatic postal API (`lib/fulfillment/lob.ts`), complete with full tracking and PDF proof of mailing.

---

## 3. Hard Guardrails & Compliance (Non-Negotiable)

### 3.1 Strict Conflict-of-Interest Exclusion (`NAICS 713940`)
> **CRITICAL OPERATIONAL DIRECTIVE:**  
> Under **NO** circumstances may DocketStamp include templates, landing pages, SEO keywords, marketing copy, sample forms, or pre-verified corporate addresses for:
> - Gyms, fitness centers, and health clubs
> - Fitness studios (yoga, pilates, cycling, martial arts, CrossFit)
> - Athletic clubs and sports training facilities
> - Any fitness membership billing entities categorized under **`NAICS 713940`** (*Fitness and Recreational Sports Centers*).
>
> All recipient directories, search indexing routines, and programmatic ingestion scripts MUST enforce runtime validation rejecting any entity or keyword associated with `NAICS 713940`.

### 3.2 Unauthorized Practice of Law (UPL) Safe Harbor & Self-Help Positioning
DocketStamp operates strictly as a self-help document preparation and automated USPS postal dispatch utility. DocketStamp is **NOT** a law firm, does not provide legal representation, does not assess legal merits, and does not provide legal advice.

1. **Deterministic Form Letters Only**: All notices are structured "Mad-Libs" style deterministic documents where the user inputs their own factual parameters (dates, amounts, addresses, lease terms).
2. **No Open-Ended AI Legal Advice**: Generative language models are strictly prohibited from generating legal counsel, answering legal questions, or offering personalized legal strategies.
3. **Mandatory 8pt Compliance Disclosure**:
   Every generated document, customer-facing screen, and checkout footer MUST conspicuously display the following statutory compliance notice:
   > *"DocketStamp is an automated document preparation and USPS postal dispatch platform, not a law firm, and does not provide legal advice, legal opinions, or legal representation. The documents, statutory citations, and forms provided are self-help resources prepared according to user-selected factual parameters. Use of DocketStamp does not create an attorney-client relationship. If you require legal advice or representation for a specific situation, consult a licensed attorney in your jurisdiction."*

---

## 4. 3-Tier Pricing Architecture & Unit Economics

DocketStamp employs a clear, upfront 3-tier pricing model reflecting the USPS service level and evidentiary weight:

| Tier | Service Level | Retail Price | USPS Mail Class | Fulfillment Capabilities & Proof | Target COGS (Lob + Print) | Gross Margin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Standard First-Class Dispatch** | **$12.95** | USPS First-Class Mail | Full color / black-and-white print, CASS address standardization, Intelligent Mail barcode (IMb) tracking docket, physical dispatch within 1 business day. | ~$1.80 - $2.20 | ~83% - 86% |
| **Tier 2** | **USPS Certified Mail®** | **$19.95** | USPS Certified Mail® | Official USPS Certified Mail green banner & barcode, official USPS tracking number, certificate of mailing proof, delivery confirmation docket. | ~$7.20 - $8.10 | ~59% - 64% |
| **Tier 3** | **USPS Certified Mail® + Return Receipt** | **$27.95** | USPS Certified Mail® + ERR | Full court-ready evidentiary package: USPS Certified Mail tracking + Electronic Return Receipt (ERR) with recipient signature PDF captured by USPS carrier upon physical delivery. | ~$10.50 - $11.80 | ~58% - 62% |

---

## 5. Initial 6-Notice Catalog

The initial catalog targets high-stakes, time-sensitive consumer situations where written notice is required by state statute or federal law:

### 1. Tenant Notice of Intent to Vacate / Lease Non-Renewal
- **Governing Standard**: Common Law / State Residential Landlord-Tenant Codes (e.g., Cal. Civ. Code § 1946.1, Tex. Prop. Code § 91.001, N.Y. Real Prop. Law § 232-a).
- **Core Variables**: Tenant Name(s), Landlord/Manager Name, Rental Property Address, Lease Expiration Date, Effective Vacate Date, Forwarding Address for Notices.
- **Purpose**: Creates an incontrovertible timestamped record satisfying contractual 30-day or 60-day lease non-renewal requirements.

### 2. Statutory Security Deposit Return Request
- **Governing Standard**: 50-State + DC Statutory Return Windows & Penalty Provisions (e.g., Cal. Civ. Code § 1950.5 [21 days], N.Y. Gen. Oblig. Law § 7-108 [14 days], Tex. Prop. Code § 92.104 [30 days], Fla. Stat. § 83.49 [15/30 days]).
- **Core Variables**: Tenant Name, Former Rental Address, Move-Out Date, Security Deposit Amount Paid, Itemized Deductions Disputed (if applicable), Statutory Demand Forwarding Address.
- **Purpose**: Formal demand citing state statute and statutory bad-faith penalties (e.g., treble damages, attorney fees) for unreturned security deposits.

### 3. Formal Tenant Request for Essential Repairs / Maintenance
- **Governing Standard**: Implied Warranty of Habitability / State Housing Maintenance Codes.
- **Core Variables**: Tenant Name, Dwelling Unit Address, Landlord/Property Manager Name, Specific Defect Description (Heat/Water/Plumbing/Pest/Electrical/Structural), Prior Notice Dates, Statutory Notice-to-Repair Deadline (typically 7, 14, or 30 days).
- **Purpose**: Prerequisite legal documentation before exercising statutory remedies (repair-and-deduct, lease termination, rent escrow).

### 4. Credit Bureau Written Dispute Notice (FCRA § 611)
- **Governing Standard**: Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i (Section 611 - Procedure in case of disputed accuracy).
- **Core Variables**: Consumer Full Name, SSN (last 4), DOB, Current Address, Target Credit Reporting Agency (Equifax, Experian, or TransUnion pre-verified dispute address), Disputed Account Name, Account Number (partial), Nature of Inaccuracy (Fraud, Paid, Not Mine, Outdated), Demand for 30-Day Reinvestigation.
- **Purpose**: Triggers mandatory statutory 30-day investigation window under federal law with Certified Mail proof.

### 5. 30-Day Debt Verification & Validation Request (FDCPA)
- **Governing Standard**: Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g (Validation of debts).
- **Core Variables**: Consumer Full Name, Current Mailing Address, Collection Agency Name & Address, Debt Reference/Account Number, Original Creditor Name (if known), Statement of Dispute, Demand for Cease-and-Desist pending written verification.
- **Purpose**: Formally halts collection activity under federal law until the collector verifies the debt with the original creditor.

### 6. Written Service & Insurance Policy Cancellation Notice
- **Governing Standard**: State Contract Laws / Statutory Written Notice Clauses (*Strictly Non-Fitness*).
- **Allowed Categories**:
  - Home Security Systems (ADT, Vivint, SimpliSafe, etc.)
  - Pest Control Services (Terminix, Orkin, etc.)
  - Telecommunications & Cable (Comcast/Xfinity, Spectrum, AT&T, etc.)
  - Home Warranty Providers (American Home Shield, Choice Home Warranty, etc.)
  - Auto & Homeowners Insurance Policies
- **Core Variables**: Policy/Account Holder Name, Service Provider Corporate Address, Account/Policy Number, Contract Start Date, Cancellation Effective Date, Reason for Cancellation, Confirmation Request.
- **Strict Prohibition**: Explicitly excludes gyms, fitness clubs, health studios, or any `NAICS 713940` entities.

---

## 6. Technical Integration: Lob API (`lib/fulfillment/lob.ts`)

Physical document dispatch is fulfilled programmatically via the **Lob REST API**:

1. **CASS Address Standardization (`POST /v1/us_verifications`)**:
   Every recipient address is parsed and verified against USPS Coding Accuracy Support System (CASS) data before dispatch, returning standardized 5-digit ZIP + 4 ZIP addon, delivery point barcode, and carrier route.
2. **Letter Dispatch (`POST /v1/letters`)**:
   - `use_type`: `operational`
   - `color`: `false` (black & white formal document printing on crisp 20# bright white paper) or `true` for official seal elements.
   - `mail_type`: `usps_first_class` (Tier 1)
   - `extra_service`: `certified` (Tier 2) or `certified_return_receipt` (Tier 3)
   - `idempotency_key`: `docketstamp_order_{orderId}`
   - `custom_envelope`: Standard double-window or Certified Mail USPS compliant envelope.
3. **Tracking & Proof Ingestion**:
   Lob webhooks (`letter.mailed`, `letter.in_transit`, `letter.delivered`, `letter.certified.delivered`) update order states and attach certified tracking numbers and Return Receipt signature PDFs directly to the customer's secure docket page.
