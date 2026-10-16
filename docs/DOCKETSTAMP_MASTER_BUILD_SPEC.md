# DOCKETSTAMP: MASTER ARCHITECTURE, DATA & PRODUCT SPECIFICATION
**Domain:** `docketstamp.com`  
**Parent Architecture:** Cloned from `sendmynotes` Commerce Spine (Western Amalgamated)  
**Fulfillment Engine:** Lob Programmatic Mail API (`/v1/us_verifications` & `/v1/letters`)  
**Last Updated:** October 2026  

---

## 1. EXECUTIVE SUMMARY & SYSTEM INVARIANTS

**DocketStamp** (`docketstamp.com`) is an institutional utility mail platform engineered to solve urgent consumer statutory, financial, and contractual friction. Users complete deterministic, state-referenced administrative notices in a 60-second **DocuSign-esque** guided workspace and dispatch physical USPS First-Class or Certified Mail directly into the postal stream.

### Six Non-Negotiable System Invariants
Every PR, module, and agent task in this repository MUST enforce these six invariants:

1. **Invariant 1 — Zero Fitness Conflict (Hard NAICS 713940 Block):**
   - Under NO circumstances may DocketStamp include templates, landing pages, SEO keywords, autocomplete entries, or allow user submissions targeting gyms, health clubs, fitness studios, or fitness membership billing (`NAICS 713940`).
   - Both client validation and server API routes must run `assertNonFitnessEntity()` (`src/lib/docket/guardrails.ts`) and reject restricted terms (`equinox`, `planet fitness`, `la fitness`, `crunch`, `orangetheory`, `ymca`, `anytime fitness`, `gold's gym`, `24 hour fitness`, `lifetime fitness`, `f45`, `pure barre`, `soulcycle`, `gym`, `fitness club`, `health club`).
2. **Invariant 2 — UPL-Safe Administrative Form Letter Positioning:**
   - DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, **not a law firm**.
   - Zero open-ended AI generation or legal advice. Users fill out deterministic variables (`{{tokens}}`) in locked form templates.
   - Every generated PDF letter (at `bottom: 0.42in`) and checkout screen MUST display the locked compliance disclosure:
     > *"DOCKET RECORD & DISPATCH CERTIFICATION: Prepared and dispatched via DocketStamp.com (Docket ID: {{docketId}}). DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or advice."*
3. **Invariant 3 — Single-Page Physical Geometry & USPS Clear Zones:**
   - Every letter MUST fit strictly on **one `8.5in x 11in` page** (`maxLength` enforced on all inputs).
   - **Top Certified Banner Clear Zone:** `0in` to `1.80in` from the top edge is reserved for Lob's USPS Certified Mail barcode banner and left-aligned return/recipient address blocks.
   - **Top-Right Clerk's Docket Stamp Box:** Positioned at `top: 1.85in; right: 0.60in; width: 3.15in` so it never collides with the left-side window envelope zones (`left: 0.625in`).
   - **Body Prose Zone:** Starts strictly at `top: 3.35in; left: 0.75in; right: 0.75in`.
4. **Invariant 4 — WYSIWYG Dual-Render Parity:**
   - The client-side interactive preview (`<LivePaperSheet />`) and the server-side HTML generator (`renderLobHtmlPayload()`) MUST consume the exact same deterministic interpolation function (`interpolateNotice()`).
5. **Invariant 5 — Freeze-Before-Pay Snapshot Integrity:**
   - When the user adopts their `/s/ Full Name` signature and proceeds to checkout, `/api/docket/lock-and-intent` validates the payload, generates `docketId` (`DS-2026-XXXXXX`), renders the final HTML string, and saves an immutable `frozen_html_payload` in the database prior to returning the Stripe `clientSecret`.
   - The Stripe webhook (`payment_intent.succeeded`) dispatches `order.frozen_html_payload` directly to Lob idempotently.
6. **Invariant 6 — Lob Staging vs. Production API Key Separation:**
   - Lob's `test_...` key does NOT verify real-world street addresses on `/v1/us_verifications`.
   - Therefore, `src/lib/fulfillment/lob.ts` uses two separate environment keys:
     - `LOB_ADDRESS_VERIFICATION_KEY`: Uses `live_...` key in both Staging and Prod (read-only/free CASS verification) OR falls back to a deterministic Staging mock when `LOB_ENV=staging_mock_cass`.
     - `LOB_DISPATCH_API_KEY`: Uses `test_...` in Staging (generates real PDF proofs in Lob dashboard at $0 postage cost) and `live_...` in Production.

---

## 2. UNIT ECONOMICS & 3-TIER PRICING MODEL (2026 USPS/LOB RATES)

| Tier ID | Service Name | Retail Price (`cents`) | Lob `extra_service` Parameter | Est. Lob COGS | Est. Stripe Fee | Net Margin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `first_class` | **Standard First-Class Dispatch** | `$12.95` (`1295`) | `undefined` (Standard First-Class + IMb) | `$1.23` | `$0.68` | **`$11.04` (85.2%)** |
| `certified` | **USPS Certified Mail®** | `$19.95` (`1995`) | `"certified"` | `$8.18` | `$0.88` | **`$10.89` (54.6%)** |
| `certified_return_receipt` | **USPS Certified Mail® + Return Receipt** | `$27.95` (`2795`) | `"certified_return_receipt"` | `$11.09` | `$1.11` | **`$15.75` (56.4%)** |

---

## 3. "DOCUSIGN-ESQUE" DESIGN SYSTEM & UX SPECIFICATION

### 3.1 The Mental Model ("Executing an Instrument, Not Filling Out a Web Form")
The interface must feel like **DocuSign** crossed with an official federal court e-filing portal:
- Users see the actual `8.5" x 11"` statutory notice sitting on a dark slate workspace.
- Locked legal/administrative prose is crisp and authoritative; only the personal variables are highlighted as clickable Amber DocuSign-style action tags (`[ REQUIRED: DEPOSIT AMOUNT ]`).
- As the user steps through the guided input drawer, each Amber tag snaps into crisp formatted text on the live document sheet.

### 3.2 Color Tokens & Typography
- **Workspace Canvas Backdrop:** Midnight Slate (`#0F172A` / `#1E293B`)
- **Paper Sheet Surface:** Crisp White (`#FFFFFF`) with `1px solid #CBD5E1` border and subtle elevation shadow
- **Primary Institutional Ink:** Deep Navy (`#0F172A`)
- **Secondary Metadata Slate:** Formal Slate (`#334155`)
- **Official Seal Accent:** Registry Blue (`#0284C7`)
- **DocuSign Unfilled Tag Highlight:** Action Amber border (`#D97706`), Warm Cream fill (`#FEF3C7`), Dark Amber text (`#92400E`)
- **CASS Verified / Completed Badge:** Verification Green (`#15803D` / `#DCFCE7` fill)
- **Typography (`next/font/google`):**
  - `Merriweather` (weights 400, 700): Formal document titles, statutory citations, and locked letter prose.
  - `Inter` (weights 400, 500, 600, 700): Application chrome, sticky execution bar, guided drawer inputs, and compliance footer.
  - `JetBrains Mono` (weights 400, 600): Top-right Clerk's Docket Stamp box, `DS-2026-XXXXXX` IDs, inline `[ REQUIRED ]` pills, dates, currency amounts, and `/s/ Full Name` signature blocks.

### 3.3 The Signature "Clerk's Docket Stamp" Box (Top-Right Header of Page 1)
Every rendered document (both live preview and Lob PDF) displays a boxed rectangular filing stamp in the top-right quadrant (`top: 1.85in; right: 0.6in; width: 3.15in`):

```text
┌─────────────────────────────────────────────┐
│ DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY     │
├─────────────────────────────────────────────┤
│ DOCKET ID:  DS-2026-84920-IL                │
│ FILED UTC:  2026-10-14 18:45:12 UTC         │
│ DISPATCH:   USPS CERTIFIED + RETURN RECEIPT │
│ ROUTING:    USPS CASS™ VERIFIED (60045-1201)│
└─────────────────────────────────────────────┘
```

---

## 4. TARGET MODULE DIRECTORY STRUCTURE

```text
src/
├── lib/
│   ├── docket/
│   │   ├── types.ts                      # Master TypeScript interfaces
│   │   ├── guardrails.ts                 # NAICS 713940 blocker & UPL footer constants
│   │   ├── data/
│   │   │   ├── state-statutes.ts         # 50-State + DC statutory lookup dataset
│   │   │   └── verified-recipients.ts    # 30 Pre-verified institutional recipients
│   │   ├── notices/
│   │   │   ├── index.ts                  # Master registry & lookup helpers
│   │   │   ├── 01-intent-to-vacate.ts
│   │   │   ├── 02-security-deposit-return.ts
│   │   │   ├── 03-tenant-repair-request.ts
│   │   │   ├── 04-credit-bureau-dispute.ts
│   │   │   ├── 05-debt-validation-request.ts
│   │   │   └── 06-service-policy-cancellation.ts
│   │   └── renderer/
│   │       ├── interpolate.ts            # Pure AST/token interpolation engine
│   │       └── lob-html-shell.ts         # Exact 8.5x11 HTML/CSS generator for Lob
│   └── fulfillment/
│       └── lob.ts                        # CASS verification & Lob Letter dispatch adapter
```

---

## 5. CORE TYPESCRIPT CONTRACTS & GUARDRAILS

### 5.1 `src/lib/docket/types.ts`
```typescript
import { z } from 'zod';

export type MailTierId = 'first_class' | 'certified' | 'certified_return_receipt';

export type RecipientMode =
  | 'manual_landlord'
  | 'verified_credit_bureau'
  | 'verified_or_manual_debt'
  | 'verified_or_manual_corp';

export interface PostalAddress {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface StateStatuteEntry {
  stateCode: string;
  stateName: string;
  returnDeadlineLabel: string;
  statuteCitation: string;
  statutoryNuance: string;
}

export interface VerifiedRecipientEntry {
  id: string;
  category: 'credit_bureau' | 'debt_collector' | 'home_service' | 'telecom_insurance';
  brandName: string;
  formalRecipientLine: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  requiredIdentifiersHint: string;
  recommendedTier: MailTierId;
}

export interface NoticeFieldConfig {
  key: string;
  stepGroup: 'recipient' | 'sender' | 'instrument_details' | 'execution';
  label: string;
  docusignTagLabel: string;
  inputType: 'text' | 'currency' | 'date' | 'state_select' | 'select' | 'textarea_short';
  placeholder?: string;
  helperText?: string;
  options?: { label: string; value: string }[];
  maxLength?: number;
}

export interface NoticeTemplateDefinition {
  id: string;
  slug: string;
  category: 'tenant' | 'credit_debt' | 'cancellation';
  title: string;
  shortDescription: string;
  documentHeaderTitle: string;
  reLineTemplate: string;
  recommendedTier: MailTierId;
  recipientMode: RecipientMode;
  usesStateStatuteLookup: boolean;
  seoMeta: {
    title: string;
    description: string;
    targetKeywords: string[];
  };
  fields: NoticeFieldConfig[];
  zodSchema: z.ZodObject<any>;
  bodyParagraphs: string[];
}
```

### 5.2 `src/lib/docket/guardrails.ts`
```typescript
const FORBIDDEN_FITNESS_PATTERNS = [
  /\bequinox\b/i,
  /\bplanet\s*fitness\b/i,
  /\bla\s*fitness\b/i,
  /\bcrunch\s*fitness\b/i,
  /\borangetheory\b/i,
  /\bymca\b/i,
  /\banytime\s*fitness\b/i,
  /\bgold'?s\s*gym\b/i,
  /\b24\s*hour\s*fitness\b/i,
  /\blifetime\s*fitness\b/i,
  /\blife\s*time\s*athletic\b/i,
  /\bf45\s*training\b/i,
  /\bpure\s*barre\b/i,
  /\bsoulcycle\b/i,
  /\babc\s*fitness\b/i,
  /\babc\s*financial\b/i,
  /\bgym\s*membership\b/i,
  /\bfitness\s*club\b/i,
  /\bhealth\s*club\b/i,
];

export class ConflictOfInterestError extends Error {
  constructor(message = 'This recipient or contract category (Fitness / Health Clubs) is not supported on DocketStamp.') {
    super(message);
    this.name = 'ConflictOfInterestError';
  }
}

export function assertNonFitnessEntity(input: string | Record<string, unknown>): void {
  const serialized = typeof input === 'string' ? input : JSON.stringify(input);
  for (const pattern of FORBIDDEN_FITNESS_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new ConflictOfInterestError();
    }
  }
}

export const UPL_COMPLIANCE_FOOTER_TEXT = (docketId: string) =>
  `DOCKET RECORD & DISPATCH CERTIFICATION: Prepared and dispatched via DocketStamp.com (Docket ID: ${docketId}). DocketStamp is an automated self-help document preparation and USPS postal dispatch utility, not a law firm, and does not provide legal representation or legal advice.`;
```

---

## 6. COMPLETE DATASET 1: 50-STATE + DC SECURITY DEPOSIT STATUTES (`src/lib/docket/data/state-statutes.ts`)

Builder Agent must populate all 51 jurisdictions verbatim into `STATE_STATUTES`:

| State Code | State Name | `returnDeadlineLabel` | `statuteCitation` | `statutoryNuance` |
| :--- | :--- | :--- | :--- | :--- |
| `AL` | Alabama | `60 days` | `Ala. Code § 35-9A-201` | Must mail itemized list of deductions and remaining balance within 60 days of termination and delivery of possession. |
| `AK` | Alaska | `14 days (30 days if deductions)` | `Alaska Stat. § 34.03.070` | 14 days if no deductions and proper notice given; 30 days if landlord itemizes damages. |
| `AZ` | Arizona | `14 business days` | `Ariz. Rev. Stat. § 33-1321(D)` | 14 business days after termination, delivery of possession, and demand by tenant. |
| `AR` | Arkansas | `60 days` | `Ark. Code Ann. § 18-16-305` | Within 60 days of termination of tenancy, must return deposit or written itemized list of deductions. |
| `CA` | California | `21 calendar days` | `Cal. Civ. Code § 1950.5(g)` | Within 21 calendar days after tenant vacates, must furnish itemized statement and receipts for deductions over $125. |
| `CO` | Colorado | `30 days (up to 60 if specified in lease)` | `Colo. Rev. Stat. § 38-12-103` | 1 month default after lease termination or surrender of premises, unless lease specifies up to 60 days. |
| `CT` | Connecticut | `21 days (or 15 days after forwarding address)` | `Conn. Gen. Stat. § 47a-21(d)` | Within 21 days after termination of tenancy or 15 days after receiving written forwarding address, whichever is later. |
| `DE` | Delaware | `20 days` | `Del. Code Ann. tit. 25, § 5514` | Within 20 days of expiration or termination of rental agreement, must provide itemized list of damages and refund balance. |
| `DC` | District of Columbia | `45 days` | `D.C. Mun. Regs. tit. 14, § 309` | Within 45 days after termination of tenancy, must return deposit or notify tenant in writing of intent to withhold. |
| `FL` | Florida | `15 days (30 days if imposing claim)` | `Fla. Stat. § 83.49(3)` | 15 days to return full deposit if no deductions; 30 days to send written notice by certified mail of intent to impose a claim. |
| `GA` | Georgia | `30 days` | `Ga. Code Ann. § 44-7-34` | Within 30 days after vacating premises, must return deposit or provide comprehensive list of exact damage deductions. |
| `HI` | Hawaii | `14 days` | `Haw. Rev. Stat. § 521-44(c)` | Within 14 days after termination of rental agreement, must provide written itemization and return remaining balance. |
| `ID` | Idaho | `21 days (up to 30 if agreed in lease)` | `Idaho Code § 6-321` | 21 days default after surrender of premises; parties may agree in writing up to 30 days. |
| `IL` | Illinois | `30 days (itemization) / 45 days (refund)` | `765 ILCS 710/1` | Itemized statement with receipts due within 30 days of vacating; remaining balance due within 45 days. |
| `IN` | Indiana | `45 days` | `Ind. Code § 32-31-3-12` | Within 45 days after termination of occupancy and delivery of tenant's written forwarding address. |
| `IA` | Iowa | `30 days` | `Iowa Code § 562A.12(3)` | Within 30 days from date of termination of tenancy and receipt of tenant's mailing address. |
| `KS` | Kansas | `30 days` | `Kan. Stat. Ann. § 58-2550(b)` | Within 30 days after determination of deductions and no later than 30 days after termination and delivery of possession. |
| `KY` | Kentucky | `30 days` | `Ky. Rev. Stat. Ann. § 383.580` | Landlord must notify tenant of remaining refund and itemized deductions within 30 days of termination. |
| `LA` | Louisiana | `1 month` | `La. Rev. Stat. Ann. § 9:3251` | Within 1 month after lease terminates, provided tenant surrendered possession and furnished forwarding address. |
| `ME` | Maine | `30 days (written lease) / 21 days (at-will)` | `Me. Rev. Stat. tit. 14, § 6033` | Within 30 days for written rental agreement or within 21 days for tenancy at will. |
| `MD` | Maryland | `45 days` | `Md. Code Ann., Real Prop. § 8-203(e)` | Within 45 days after termination of tenancy, must return deposit plus statutory interest less itemized damages. |
| `MA` | Massachusetts | `30 days` | `Mass. Gen. Laws ch. 186, § 15B(4)` | Within 30 days after termination of occupancy, must return deposit or sworn itemized list of damages. |
| `MI` | Michigan | `30 days` | `Mich. Comp. Laws § 554.609` | Within 30 days after termination of occupancy, must mail itemized list of damages and check for difference. |
| `MN` | Minnesota | `21 days` | `Minn. Stat. § 504B.178(Subd. 3)` | Within 3 weeks after termination of tenancy and receipt of tenant's mailing address or delivery instructions. |
| `MS` | Mississippi | `45 days` | `Miss. Code Ann. § 89-8-21` | Within 45 days after termination of tenancy, delivery of possession, and demand by the tenant. |
| `MO` | Missouri | `30 days` | `Mo. Rev. Stat. § 535.300(3)` | Within 30 days after date of termination of tenancy, must return full amount or furnish written itemized list of damages. |
| `MT` | Montana | `10 days (no deductions) / 30 days (with deductions)` | `Mont. Code Ann. § 70-25-202` | 10 days if no deductions; 30 days after termination/surrender if returning balance with written list of deductions. |
| `NE` | Nebraska | `14 days` | `Neb. Rev. Stat. § 76-1416(2)` | Within 14 days after termination of tenancy, must deliver balance and written itemized statement. |
| `NV` | Nevada | `30 days` | `Nev. Rev. Stat. § 118A.242(4)` | Within 30 days after termination of tenancy by handing to tenant or mailing to forwarding address. |
| `NH` | New Hampshire | `30 days` | `N.H. Rev. Stat. Ann. § 540-A:7` | Within 30 days after termination of tenancy, must return entire deposit or written itemized list of damages with balance. |
| `NJ` | New Jersey | `30 days` | `N.J. Stat. Ann. § 46:8-21.1` | Within 30 days after termination of lease, must return deposit plus interest less itemized deductions. |
| `NM` | New Mexico | `30 days` | `N.M. Stat. Ann. § 47-8-18(C)` | Within 30 days of termination of rental agreement or departure from premises, whichever is later. |
| `NY` | New York | `14 days` | `N.Y. Gen. Oblig. Law § 7-108(1-a)(e)` | Within 14 days after tenant vacates premises, must provide itemized statement and return remaining balance. |
| `NC` | North Carolina | `30 days (up to 60 for final accounting)` | `N.C. Gen. Stat. § 42-52` | Within 30 days after termination of tenancy; interim accounting at 30 days and final within 60 days if claims pending. |
| `ND` | North Dakota | `30 days` | `N.D. Cent. Code § 47-16-07.1(3)` | Within 30 days after termination of lease and receipt of possession, must provide itemized statement and balance. |
| `OH` | Ohio | `30 days` | `Ohio Rev. Code Ann. § 5321.16(B)` | Within 30 days after termination of rental agreement and delivery of possession, with written forwarding address. |
| `OK` | Oklahoma | `45 days` | `Okla. Stat. tit. 41, § 115(B)` | Within 45 days after termination of tenancy, delivery of possession, and written demand by tenant. |
| `OR` | Oregon | `31 days` | `Or. Rev. Stat. § 90.300(12)` | Within 31 days after termination of tenancy and delivery of possession, must give written accounting and refund balance. |
| `PA` | Pennsylvania | `30 days` | `68 Pa. Cons. Stat. § 250.512(a)` | Within 30 days of termination of lease or upon surrender and acceptance of premises, whichever occurs first. |
| `RI` | Rhode Island | `20 days` | `R.I. Gen. Laws § 34-18-19(b)` | Within 20 days after the later of termination of tenancy, delivery of possession, or providing forwarding address. |
| `SC` | South Carolina | `30 days` | `S.C. Code Ann. § 27-40-410(a)` | Within 30 days after termination of tenancy, demand by tenant, and provision of forwarding address. |
| `SD` | South Dakota | `14 days (45 days for itemized explanation)` | `S.D. Codified Laws § 43-32-24` | Within 2 weeks after termination of tenancy and receipt of tenant's mailing address. |
| `TN` | Tennessee | `30 days` | `Tenn. Code Ann. § 66-28-301` | Within 30 days of tenant vacating or abandonment, landlord must provide inspection list of damages and refund notice. |
| `TX` | Texas | `30 days` | `Tex. Prop. Code Ann. § 92.103 / § 92.109` | On or before the 30th day after tenant surrenders premises, provided tenant furnishes written forwarding address. |
| `UT` | Utah | `30 days (or 15 days after forwarding address)` | `Utah Code Ann. § 57-17-3(2)` | Within 30 days after tenant vacates or within 15 days after tenant provides forwarding address, whichever is later. |
| `VT` | Vermont | `14 days` | `Vt. Stat. Ann. tit. 9, § 4461(c)` | Within 14 days from date landlord discovers tenant vacated or date tenant vacated with notice. |
| `VA` | Virginia | `45 days` | `Va. Code Ann. § 55.1-1226(A)` | Within 45 days after termination of tenancy and delivery of possession, must provide itemized disposition and refund. |
| `WA` | Washington | `30 days` | `Wash. Rev. Code § 59.18.280(1)` | Within 30 days after termination of rental agreement and vacation of premises, must provide full statement and refund. |
| `WV` | West Virginia | `60 days (or 45 days after subsequent occupancy)` | `W. Va. Code § 37-6A-1(7)` | Within 60 days of termination of tenancy or within 45 days of occupancy by subsequent tenant, whichever is shorter. |
| `WI` | Wisconsin | `21 days` | `Wis. Stat. § 704.28(4)` | Within 21 days after date on which tenant's rental agreement terminates. |
| `WY` | Wyoming | `30 days (or 15 days after forwarding address)` | `Wyo. Stat. Ann. § 1-21-1208(a)` | Within 30 days after termination of rental agreement or 15 days after receipt of forwarding address, whichever is later. |

---

## 7. COMPLETE DATASET 2: 30 PRE-VERIFIED INSTITUTIONAL RECIPIENTS (`src/lib/docket/data/verified-recipients.ts`)

Builder Agent must populate all 30 non-fitness recipients into `VERIFIED_RECIPIENTS`:

| `id` | `category` | `brandName` | `formalRecipientLine` | `addressLine1` | `city` | `state` | `zip` | `recommendedTier` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `cra_eqf` | `credit_bureau` | Equifax | Equifax Information Services LLC | P.O. Box 740256 | Atlanta | GA | 30374-0256 | `certified_return_receipt` |
| `cra_exp` | `credit_bureau` | Experian | Experian National Consumer Assistance Center | P.O. Box 4500 | Allen | TX | 75013 | `certified_return_receipt` |
| `cra_tru` | `credit_bureau` | TransUnion | TransUnion Consumer Solutions | P.O. Box 2000 | Chester | PA | 19016-2000 | `certified_return_receipt` |
| `col_pra` | `debt_collector` | Portfolio Recovery Associates | Portfolio Recovery Associates, LLC — Disputes Dept. | 120 Corporate Boulevard | Norfolk | VA | 23502 | `certified_return_receipt` |
| `col_mcm` | `debt_collector` | Midland Credit Management | Midland Credit Management, Inc. — Consumer Support | 350 Camino De La Reina, Suite 100 | San Diego | CA | 92108 | `certified_return_receipt` |
| `col_lvnv` | `debt_collector` | LVNV Funding / Resurgent | Resurgent Capital Services L.P. | P.O. Box 10497 | Greenville | SC | 29603-0497 | `certified_return_receipt` |
| `col_cav` | `debt_collector` | Cavalry Portfolio Services | Cavalry Portfolio Services, LLC | 1 American Lane, Suite 220 | Greenwich | CT | 06831 | `certified_return_receipt` |
| `col_ics` | `debt_collector` | IC System | I.C. System, Inc. — Consumer Correspondence | P.O. Box 64378 | St. Paul | MN | 55164-0378 | `certified_return_receipt` |
| `col_jcap` | `debt_collector` | Jefferson Capital Systems | Jefferson Capital Systems, LLC | 16 McLeland Road | St. Cloud | MN | 56303 | `certified_return_receipt` |
| `col_cnv` | `debt_collector` | Convergent Outsourcing | Convergent Outsourcing, Inc. | P.O. Box 9004 | Renton | WA | 98057-9004 | `certified_return_receipt` |
| `col_tsi` | `debt_collector` | Transworld Systems (TSI) | Transworld Systems Inc. — Compliance Dept. | P.O. Box 15618 | Wilmington | DE | 19850 | `certified_return_receipt` |
| `col_rad` | `debt_collector` | Radius Global Solutions | Radius Global Solutions LLC | P.O. Box 390846 | Minneapolis | MN | 55439 | `certified_return_receipt` |
| `col_hal` | `debt_collector` | Halsted Financial Services | Halsted Financial Services, LLC | P.O. Box 828 | Skokie | IL | 60076 | `certified_return_receipt` |
| `srv_adt` | `home_service` | ADT Security Services | ADT LLC — Account Cancellation Department | P.O. Box 310702 | Boca Raton | FL | 33431-0702 | `certified` |
| `srv_viv` | `home_service` | Vivint Smart Home | Vivint, Inc. — Customer Care & Notice of Cancellation | 4931 North 300 West | Provo | UT | 84604 | `certified` |
| `srv_bhs` | `home_service` | Brinks Home Security | Monitronics International, Inc. d/b/a Brinks Home | 1990 Wittington Place | Farmers Branch | TX | 75234 | `certified` |
| `srv_ss` | `home_service` | SimpliSafe | SimpliSafe, Inc. — Subscriptions & Account Admin | 100 Summer Street, Floor 3 | Boston | MA | 02110 | `first_class` |
| `srv_tmx` | `home_service` | Terminix | Terminix International Company L.P. — Customer Admin | 150 Peabody Place | Memphis | TN | 38103 | `certified` |
| `srv_ork` | `home_service` | Orkin Pest Control | Orkin LLC — Customer Care & Account Cancellations | 2170 Piedmont Road NE | Atlanta | GA | 30324 | `certified` |
| `srv_trg` | `home_service` | TruGreen | TruGreen Limited Partnership — Customer Correspondence | 1790 Kirby Parkway, Forum II, Suite 300 | Memphis | TN | 38138 | `certified` |
| `srv_ahs` | `home_service` | American Home Shield | American Home Shield — Policy Administration | P.O. Box 849 | Carroll | IA | 51401-9901 | `certified` |
| `srv_chw` | `home_service` | Choice Home Warranty | Home Warranty Administrator Corp. — Cancellations | 2147 Route 27 South, 4th Floor | Edison | NJ | 08817 | `certified` |
| `tel_cmcst` | `telecom_insurance` | Comcast / Xfinity | Comcast Cable Communications — Customer Account Notices | One Comcast Center, 1701 JFK Blvd | Philadelphia | PA | 19103 | `certified` |
| `tel_chtr` | `telecom_insurance` | Charter / Spectrum | Charter Communications — Customer Service Notice Dept. | 400 Washington Blvd | Stamford | CT | 06902 | `certified` |
| `tel_dtv` | `telecom_insurance` | DIRECTV | DIRECTV, LLC — Customer Account Correspondence | P.O. Box 5006 | Carol Stream | IL | 60197-5006 | `certified` |
| `tel_hgh` | `telecom_insurance` | HughesNet | Hughes Network Systems, LLC — Account Cancellation | 11717 Exploration Lane | Germantown | MD | 20876 | `certified` |
| `ins_geico` | `telecom_insurance` | GEICO | Government Employees Insurance Company — Policy Admin | One GEICO Plaza | Washington | DC | 20076-0001 | `first_class` |
| `ins_prog` | `telecom_insurance` | Progressive Insurance | Progressive Casualty Insurance Co. — Policy Services | P.O. Box 31260 | Tampa | FL | 33631-3260 | `first_class` |
| `ins_all` | `telecom_insurance` | Allstate Insurance | Allstate Insurance Company — Policy Cancellation Processing | P.O. Box 660598 | Dallas | TX | 75266-0598 | `first_class` |
| `ins_sf` | `telecom_insurance` | State Farm | State Farm Mutual Automobile Insurance Co. — Policy Admin | One State Farm Plaza | Bloomington | IL | 61710 | `first_class` |

---

## 8. THE 6 DETERMINISTIC NOTICE CARTRIDGES (`src/lib/docket/notices/`)

All 6 cartridges share universal Sender/Recipient base tokens (`{{senderFullName}}`, `{{senderFullAddress}}`, `{{recipientFormalName}}`, `{{recipientFullAddress}}`, `{{executionDate}}`, `{{docketId}}`) plus their cartridge-specific tokens below.

### Cartridge 01: `01-intent-to-vacate.ts`
- **Slug:** `tenant-notice-of-intent-to-vacate`
- **Title:** `Tenant Notice of Intent to Vacate & Lease Non-Renewal`
- **Document Header:** `FORMAL NOTICE OF INTENT TO VACATE AND NON-RENEWAL OF LEASE`
- **RE Line:** `RE: Notice of Lease Non-Renewal — {{leasedPremisesAddress}}`
- **Recommended Tier:** `certified` (`$19.95`)
- **Recipient Mode:** `manual_landlord`
- **Fields:**
  - `leasedPremisesAddress` (`text`, max 90, Tag: `LEASED UNIT ADDRESS`)
  - `leaseNoticePeriod` (`select`: `30-Day`, `60-Day`, `End-of-Term`, Tag: `NOTICE PERIOD`)
  - `moveOutDate` (`date`, Tag: `VACATE DATE`)
  - `forwardingAddress` (`text`, max 100, Tag: `FORWARDING ADDRESS`)
- **Paragraphs:**
  1. `PLEASE TAKE NOTICE that the undersigned tenant(s), {{senderFullName}}, hereby provide formal written {{leaseNoticePeriod}} notice of intent to vacate and terminate tenancy for the residential premises located at {{leasedPremisesAddress}}.`
  2. `In accordance with the written notice provisions of the governing lease agreement, tenancy will conclude and full possession of the premises will be surrendered on or before {{moveOutDate}}.`
  3. `Please provide schedule availability for a joint move-out walkthrough inspection prior to the surrender date. All keys, fobs, and access devices will be returned upon final surrender of the unit.`
  4. `Kindly forward the full accounting and refund of the residential security deposit to the following forwarding address: {{forwardingAddress}}.`

### Cartridge 02: `02-security-deposit-return.ts`
- **Slug:** `security-deposit-return-demand-letter`
- **Title:** `Statutory Security Deposit Return Request`
- **Document Header:** `FORMAL WRITTEN NOTICE: REQUEST FOR RETURN OF SECURITY DEPOSIT`
- **RE Line:** `RE: Security Deposit Return Accounting — {{vacatedPremisesAddress}} ({{statuteCitation}})`
- **Recommended Tier:** `certified_return_receipt` (`$27.95`)
- **Recipient Mode:** `manual_landlord`
- **Uses State Statute Lookup:** `true` (Selecting `propertyState` auto-populates `{{statuteCitation}}` and `{{statuteDeadline}}` from `STATE_STATUTES`).
- **Fields:**
  - `propertyState` (`state_select`, Tag: `PROPERTY STATE`)
  - `vacatedPremisesAddress` (`text`, max 90, Tag: `VACATED PROPERTY ADDRESS`)
  - `moveOutDate` (`date`, Tag: `MOVE-OUT DATE`)
  - `depositAmount` (`currency`, Tag: `DEPOSIT AMOUNT`)
  - `amountReceivedToDate` (`currency`, Tag: `AMOUNT RECEIVED`)
  - `balanceRequested` (`currency`, Tag: `BALANCE DUE`)
  - `responseDays` (`select`: `7 calendar days`, `10 business days`, `14 calendar days`, Tag: `RESPONSE DEADLINE`)
- **Paragraphs:**
  1. `This correspondence serves as formal written notice requesting the immediate return of the residential security deposit held in connection with the former tenancy of {{senderFullName}} at {{vacatedPremisesAddress}}.`
  2. `Full possession of the premises was surrendered on {{moveOutDate}}, and all keys and access devices were returned. At the commencement of the tenancy, a security deposit in the amount of {{depositAmount}} was paid. To date, {{amountReceivedToDate}} has been returned, leaving an unrefunded balance of {{balanceRequested}}.`
  3. `Please be advised that pursuant to {{propertyState}} statutory provisions ({{statuteCitation}}), the timeframe for delivering a written itemized statement of lawful deductions and refunding the remaining security deposit balance is {{statuteDeadline}} following termination of tenancy and delivery of possession.`
  4. `Accordingly, please remit the outstanding balance of {{balanceRequested}} made payable to {{senderFullName}} and mailed to {{senderFullAddress}} within {{responseDays}} of receipt of this notice, so that this matter may be resolved amicably without the need for further administrative or civil proceedings.`

### Cartridge 03: `03-tenant-repair-request.ts`
- **Slug:** `tenant-repair-and-maintenance-notice`
- **Title:** `Formal Tenant Request for Essential Repairs`
- **Document Header:** `FORMAL WRITTEN NOTICE OF REQUIRED MAINTENANCE AND REPAIRS`
- **RE Line:** `RE: Notice of Defective Condition ({{issueCategory}}) — {{leasedPremisesAddress}}`
- **Recommended Tier:** `certified` (`$19.95`)
- **Recipient Mode:** `manual_landlord`
- **Fields:**
  - `leasedPremisesAddress` (`text`, max 90, Tag: `UNIT ADDRESS`)
  - `issueCategory` (`select`: `Heating / HVAC Failure`, `Plumbing / Water Leak`, `Electrical Hazard`, `Water Intrusion / Mold Condition`, `Appliance / Structural Defect`, `Pest Infestation`, Tag: `DEFECT CATEGORY`)
  - `dateFirstObserved` (`date`, Tag: `DATE FIRST REPORTED`)
  - `defectDescription` (`textarea_short`, max 220, Tag: `DESCRIPTION OF CONDITION`)
  - `accessAuthorization` (`select`: `Tenant grants maintenance entry with 24-hour advance notice`, `Tenant requests scheduled appointment prior to entry`, Tag: `ENTRY AUTHORIZATION`)
- **Paragraphs:**
  1. `PLEASE TAKE NOTICE that the undersigned tenant(s), {{senderFullName}}, residing at {{leasedPremisesAddress}}, hereby submit formal written documentation of a condition requiring prompt repair and remediation under the governing lease agreement and applicable residential habitability standards.`
  2. `Specifically, the premises are currently experiencing the following issue categorized as {{issueCategory}}, first observed or reported on {{dateFirstObserved}}: {{defectDescription}}`
  3. `This condition materially affects the normal residential use and maintenance of the premises. Regarding contractor or maintenance access to inspect and remedy this condition: {{accessAuthorization}}.`
  4. `Please provide written confirmation within five (5) business days of the scheduled inspection and repair date so that an accurate maintenance record may be maintained by all parties.`

### Cartridge 04: `04-credit-bureau-dispute.ts`
- **Slug:** `fcra-credit-bureau-written-dispute-letter`
- **Title:** `FCRA § 611 Credit Bureau Written Dispute Notice`
- **Document Header:** `WRITTEN NOTICE OF CREDIT FILE INACCURACY AND REINVESTIGATION REQUEST`
- **RE Line:** `RE: FCRA § 611 Consumer File Dispute (15 U.S.C. § 1681i) — SSN Ending in XXX-XX-{{ssnLast4}} | DOB: {{senderDob}}`
- **Recommended Tier:** `certified_return_receipt` (`$27.95`)
- **Recipient Mode:** `verified_credit_bureau`
- **Fields:**
  - `bureauEntityId` (`select`: `cra_eqf`, `cra_exp`, `cra_tru`, Tag: `SELECT CREDIT BUREAU`)
  - `senderDob` (`date`, Tag: `DATE OF BIRTH`)
  - `ssnLast4` (`text`, max 4, regex `/^\d{4}$/`, Tag: `LAST 4 SSN`)
  - `furnisherName` (`text`, max 60, Tag: `CREDITOR / ACCOUNT NAME`)
  - `partialAccountNumber` (`text`, max 30, Tag: `ACCOUNT NUMBER`)
  - `disputeReason` (`select`: `Account does not belong to me / Identity discrepancy`, `Balance or past-due amount is inaccurately reported`, `Account status (late payment / charge-off) is inaccurate`, `Account was paid/settled in full but reflects open balance`, `Duplicate tradeline reporting on file`, `Account exceeds statutory 7-year reporting period`, Tag: `DISPUTE BASIS`)
  - `factualExplanation` (`textarea_short`, max 200, Tag: `FACTUAL STATEMENT`)
- **Paragraphs:**
  1. `Pursuant to Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i), I am submitting this formal written notice to dispute inaccurate information currently appearing on my consumer credit file maintained by {{recipientFormalName}}.`
  2. `DISPUTED TRADELINE IDENTIFICATION: Furnisher / Creditor Name: {{furnisherName}} | Account Reference: {{partialAccountNumber}}.`
  3. `BASIS OF INACCURACY: {{disputeReason}}. Specifically: {{factualExplanation}}`
  4. `In accordance with 15 U.S.C. § 1681i(a), please conduct a reasonable reinvestigation of this item within thirty (30) days of receipt of this notice, verify the completeness and accuracy of the record with the furnishing entity, or delete and modify the inaccurate entry and mail an updated copy of my consumer disclosure to {{senderFullAddress}}.`

### Cartridge 05: `05-debt-validation-request.ts`
- **Slug:** `fdcpa-30-day-debt-validation-letter`
- **Title:** `FDCPA 30-Day Debt Verification & Validation Notice`
- **Document Header:** `STATUTORY NOTICE OF DISPUTE AND REQUEST FOR DEBT VALIDATION`
- **RE Line:** `RE: Debt Validation Request Pursuant to 15 U.S.C. § 1692g — Reference No: {{collectorReferenceNumber}}`
- **Recommended Tier:** `certified_return_receipt` (`$27.95`)
- **Recipient Mode:** `verified_or_manual_debt`
- **Fields:**
  - `collectorReferenceNumber` (`text`, max 40, Tag: `COLLECTION REF #`)
  - `allegedOriginalCreditor` (`text`, max 60, Tag: `ORIGINAL CREDITOR`)
  - `allegedBalance` (`currency`, Tag: `ALLEGED AMOUNT`)
  - `initialContactDate` (`date`, Tag: `DATE OF INITIAL NOTICE`)
  - `communicationPreference` (`select`: `All future communications regarding this matter must be conducted strictly in writing by U.S. Mail`, `Please forward written verification documentation to the mailing address listed above`, Tag: `COMMUNICATION PREFERENCE`)
- **Paragraphs:**
  1. `This letter serves as formal written notice pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g, in response to your communication dated {{initialContactDate}} referencing Account/File No. {{collectorReferenceNumber}} (Alleged Original Creditor: {{allegedOriginalCreditor}}; Alleged Balance: {{allegedBalance}}).`
  2. `PLEASE TAKE NOTICE that I formally dispute the validity and amount of the alleged debt referenced above in its entirety and request full statutory verification.`
  3. `Please provide documentary verification of this obligation, including: (a) the name and address of the original creditor; (b) an itemized accounting of the principal balance and any interest or fees assessed; and (c) documentation establishing your organization's legal authority to collect this alleged obligation.`
  4. `Pursuant to 15 U.S.C. § 1692g(b), please cease collection activities on this disputed account until written verification is mailed to {{senderFullAddress}}. Furthermore: {{communicationPreference}}.`

### Cartridge 06: `06-service-policy-cancellation.ts`
- **Slug:** `written-contract-and-policy-cancellation-letter`
- **Title:** `Written Service Contract & Insurance Policy Cancellation`
- **Document Header:** `FORMAL WRITTEN NOTICE OF CONTRACT AND POLICY CANCELLATION`
- **RE Line:** `RE: Written Notice of Cancellation — {{serviceTypeLabel}} | Account/Policy No: {{accountOrPolicyNumber}}`
- **Recommended Tier:** `certified` (`$19.95`)
- **Recipient Mode:** `verified_or_manual_corp` (Enforces `assertNonFitnessEntity()`)
- **Fields:**
  - `accountOrPolicyNumber` (`text`, max 45, Tag: `POLICY / ACCOUNT #`)
  - `serviceTypeLabel` (`select`: `Home Security & Monitoring Agreement`, `Residential Pest / Lawn Service Agreement`, `Home Warranty Service Contract`, `Telecommunications / Satellite Service Account`, `Automobile / Property Insurance Policy`, `Commercial / Residential Service Subscription`, Tag: `AGREEMENT TYPE`)
  - `effectiveCancellationDate` (`date`, Tag: `EFFECTIVE CANCELLATION DATE`)
  - `servicePropertyAddress` (`text`, max 90, Tag: `SERVICE / COVERED ADDRESS`)
- **Paragraphs:**
  1. `PLEASE TAKE NOTICE that the undersigned account holder, {{senderFullName}}, hereby submits formal written directive to cancel and terminate the {{serviceTypeLabel}} identified by Account/Policy Number {{accountOrPolicyNumber}} associated with the property at {{servicePropertyAddress}}.`
  2. `Please process this termination effective as of {{effectiveCancellationDate}}, and permanently revoke all recurring automatic billing authorizations (ACH, debit, or credit card drafts) connected to this account following the effective cancellation date.`
  3. `Should any pro-rated unearned premium refund or final closing statement apply to Account/Policy Number {{accountOrPolicyNumber}}, please remit the balance and written confirmation of account closure to {{senderFullAddress}}.`

---

## 9. EXACT 1-PAGE LOB HTML/CSS GEOMETRY (`src/lib/docket/renderer/lob-html-shell.ts`)

When submitting to Lob's `/v1/letters` endpoint (`address_placement: "top_first_page"`), Lob prints the return address, recipient address, and (when Certified) the top USPS Certified Mail barcode banner in the top-left / top-band zone. Our HTML template MUST use this exact coordinate geometry:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body {
    width: 8.5in;
    height: 11in;
    margin: 0;
    padding: 0;
    position: relative;
    font-family: Georgia, 'Times New Roman', serif;
    color: #0F172A;
    background: #FFFFFF;
    overflow: hidden;
  }
  /* Top-Right Clerk's Docket Stamp Box (Clears left window & top certified banner) */
  .docket-stamp-box {
    position: absolute;
    top: 1.85in;
    right: 0.60in;
    width: 3.15in;
    border: 1.5px solid #0F172A;
    background-color: #F8FAFC;
    padding: 7px 9px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 7.5pt;
    line-height: 1.35;
  }
  .docket-stamp-header {
    font-weight: bold;
    border-bottom: 1px solid #0F172A;
    padding-bottom: 3px;
    margin-bottom: 4px;
    letter-spacing: 0.03em;
  }
  /* Formal Letter Content Zone */
  .letter-body-container {
    position: absolute;
    top: 3.35in;
    left: 0.75in;
    right: 0.75in;
    bottom: 0.80in;
  }
  .doc-header-title {
    font-size: 10.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 2px solid #0F172A;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  .re-docket-block {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    font-weight: bold;
    background-color: #F1F5F9;
    border-left: 3px solid #0284C7;
    padding: 6px 10px;
    margin-bottom: 14px;
  }
  .salutation {
    font-size: 9.5pt;
    font-weight: bold;
    margin-bottom: 10px;
  }
  .paragraph {
    font-size: 9.5pt;
    line-height: 1.50;
    text-align: justify;
    margin: 0 0 10px 0;
  }
  .signature-block {
    margin-top: 18px;
  }
  .signature-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt;
    font-weight: bold;
    border-bottom: 1px solid #334155;
    display: inline-block;
    min-width: 2.8in;
    padding-bottom: 2px;
    margin-top: 10px;
    margin-bottom: 4px;
  }
  .compliance-footer {
    position: absolute;
    bottom: 0.40in;
    left: 0.75in;
    right: 0.75in;
    border-top: 1px solid #CBD5E1;
    padding-top: 4px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6.8pt;
    color: #64748B;
    text-align: center;
    line-height: 1.3;
  }
</style>
</head>
<body>
  <!-- Rendered dynamically by renderLobHtmlPayload() -->
</body>
</html>