# DocketStamp Design System & UX Paradigm

**Document Version:** 1.0.0  
**Effective Date:** October 14, 2026  
**UX Philosophy:** *"Executing an Instrument, Not Filling Out a Web Form"*  
**Product:** DocketStamp (`docketstamp.com`)  
**Companion Documents:** [`docs/DOCKETSTAMP_SPEC.md`](file:///Users/zeke/code/DocketStamp/docs/DOCKETSTAMP_SPEC.md), [`ARCHITECTURE.md`](file:///Users/zeke/code/DocketStamp/ARCHITECTURE.md)

---

## 1. The Core UX Vibe: DocuSign Meets Federal Court Registry

DocketStamp rejects standard "form wizard" paradigms (e.g. multi-step generic input forms with Next/Back buttons). Instead, users experience **direct instrument execution**:

- **Pre-Drafted Statutory Authority**: The formal legal/contractual prose is already drafted, locked, and visually authoritative on an elevated 8.5" x 11" sheet.
- **Tabbing Through Highlighted Variables**: Senders simply tab or jump through highlighted, interactive variable slots directly on the live document (reminiscent of DocuSign tags).
- **Instant Optical Feedback**: As each factual parameter is entered (e.g., move-out date, security deposit amount, landlord name), the variable tag smoothly resolves into crisp, formal serif typography on the letter in real time.
- **High Institutional Confidence**: The environment feels sober, legally binding, and precise.

---

## 2. Visual Workspace & Color Palette

### 2.1 The Document Workspace Backdrop
The central viewport presents an elevated legal drafting workspace:
- **Workspace Backdrop**: Deep Slate (`#0F172A` / `#1E293B`) evoking an executive drafting desk.
- **The Instrument Sheet**: A crisp `8.5" x 11"` White Paper sheet (`#FFFFFF`) with:
  - 1px high-definition border: `border border-slate-300` (`#CBD5E1`)
  - Elevated double-layer drop shadow: `shadow-[0_20px_50px_rgba(0,0,0,0.35)]`
  - Formal letterhead margins: `p-8 md:p-12` (mimicking true 1-inch printable margins)

### 2.2 Institutional Color Palette

| Token Name | Hex Code | Tailwind / CSS Variable | Intended Application |
| :--- | :--- | :--- | :--- |
| **Midnight Navy** | `#0F172A` | `bg-slate-900` / `--color-midnight` | Primary workspace background, authoritative headers, formal seal ink |
| **Deep Slate** | `#1E293B` | `bg-slate-800` / `--color-slate-deep` | Workspace surrounding area, secondary surfaces, dark panels |
| **Formal Slate** | `#334155` | `text-slate-700` / `--color-slate-formal`| Subheadings, field labels, metadata captions, secondary icons |
| **Border Slate** | `#CBD5E1` | `border-slate-300` / `--color-slate-border`| Document sheet borders, structural dividers, tag outlines |
| **Official Seal Blue** | `#0284C7` | `bg-sky-600` / `--color-seal-blue` | Interactive primary actions, certified dispatch indicators, focus rings |
| **Seal Blue Hover** | `#0369A1` | `bg-sky-700` / `--color-seal-blue-hover` | Button hover and pressed states |
| **Verification Green** | `#15803D` | `text-emerald-700` / `--color-verified-green`| CASS verified badges, completed field checkmarks, active status |
| **Action Amber Fill** | `#FEF3C7` | `bg-amber-100` / `--color-amber-fill` | Unfilled variable tag background fill (DocuSign action callout) |
| **Action Amber Border** | `#D97706` | `border-amber-600` / `--color-amber-border`| Active tag highlight border, pulse cues, completion indicators |
| **Action Amber Text** | `#B45309` | `text-amber-700` / `--color-amber-text` | Monospace variable placeholder label |

---

## 3. Typography Hierarchy

DocketStamp utilizes three distinct typefaces to convey distinct roles:

### 3.1 Merriweather (Formal Serif)
- **Role**: Legal authority, statutory citations, and locked document prose.
- **Applications**:
  - Notice titles and formal headings (`font-serif font-bold text-slate-900`)
  - Formal statutory citations (e.g., *Cal. Civ. Code § 1950.5(b)*)
  - Locked letter paragraphs and demand declarations
  - Body prose rendered on the 8.5" x 11" printable sheet

### 3.2 Inter (Clean Sans)
- **Role**: Modern operational chrome, guided execution drawer, and checkout controls.
- **Applications**:
  - Sticky execution bar status and counters
  - Guided input drawer labels, helper text, and validation hints
  - Action buttons (`"Next Field ↓"`, `"Adopt Signature & Stamp"`)
  - 1-Tap payment controls (Apple Pay, Google Pay, Stripe Elements)
  - Legal compliance footers and statutory disclaimers

### 3.3 JetBrains Mono (Technical Monospace)
- **Role**: Cryptographic identifiers, postal tracking, and interactive variable slots.
- **Applications**:
  - Registry Docket IDs (`DS-2026-88491-B`)
  - USPS Tracking Barcode text (`9407 1118 9956 0000 1234 56`)
  - Active inline unfilled variable tags (`[ REQUIRED: FORWARDING ZIP ]`)
  - Currency figures and statutory deadlines (`$2,450.00`, `21 CALENDAR DAYS`)
  - Timestamps (`2026-10-14 14:50:18 UTC`)

---

## 4. Key Interactive Patterns

### 4.1 Sticky Top Execution Bar
A persistent floating bar fixed to the top of the viewport provides instant situational awareness:
- **Status Indicator**:
  - State A: `● STATUS: DRAFTING DOCKET` (Amber pulse)
  - State B: `✓ STATUS: READY FOR USPS DISPATCH` (Green solid)
- **Field Completion Counter**:
  - E.g., `4 of 7 Required Fields Completed` with a mini progress track.
- **Navigation Action**:
  - Primary button: `"Next Field ↓"` (DocuSign Amber `#D97706` when fields remain; transitions to Seal Blue `#0284C7` when all fields are complete).
  - Automatically scrolls the document sheet to center the next incomplete variable tag and focuses the drawer input.

### 4.2 Inline Highlighted Variable Tags (DocuSign-Style)
On the live 8.5" x 11" document preview:
- **Unfilled State**:
  Renders as a prominent yellow/amber pill inline within the serif text:
  ```
  [ REQUIRED: LANDLORD / PROPERTY MANAGER NAME ]
  ```
  - Background: `#FEF3C7` (Amber 100)
  - Left Accent Border: 3px solid `#D97706` (Amber 600)
  - Text: `font-mono text-xs uppercase tracking-wider text-amber-800`
  - Subtle interactive hover ring and cursor pointer.
- **Active / Focused State**:
  - Distinctive pulse animation and 2px blue ring (`ring-2 ring-sky-500`).
- **Completed State**:
  - Instantly resolves into formal serif text matching the rest of the letter, with a brief subtle green flash confirming capture.
  - Senders can click any resolved variable at any time to re-open the input drawer and edit the value.

### 4.3 The Top-Right "Clerk's Docket Stamp" Block
Every formal notice includes an institutional boxed stamp positioned in the upper right header of the document sheet:
```text
┌────────────────────────────────────────────────────────┐
│  DOCKETSTAMP™ OFFICIAL DISPATCH REGISTRY               │
│  DOCKET ID:    DS-2026-99214-X                         │
│  RECORDED:     2026-10-14 14:50:18 UTC                 │
│  SERVICE:      USPS CERTIFIED MAIL® + ERR              │
│  STATUS:       CASS ADDRESS STANDARDIZED & VERIFIED    │
│  JURISDICTION: CALIFORNIA (CIV. CODE § 1950.5)         │
└────────────────────────────────────────────────────────┘
```
- Typography: `JetBrains Mono`, `text-[10px] md:text-xs`, uppercase, tracked.
- Framing: Crisp 1.5px border in `#0F172A` with an official subtle seal icon watermark.

### 4.4 The "Adopt Signature & Stamp" Step
Before proceeding to payment:
1. Senders reach the final execution section at the bottom of the letter.
2. Clicking `"Sign & Stamp Notice for Postal Dispatch"` initiates the adoption ceremony.
3. Renders a formal execution line:
   ```text
   Respectfully submitted and executed under penalty of perjury,
   
   /s/ Jane Doe
   ___________________________________________
   Jane Doe, Sponsoring Tenant / Consumer
   Executed via DocketStamp™ Secure Registry
   Timestamp: 2026-10-14 14:50:18 UTC | IP: Verified
   ```
4. Locks the document into **Finalized Mode** and opens the 1-tap checkout drawer (Apple Pay, Google Pay, Credit Card) with the chosen USPS service tier ($12.95 / $19.95 / $27.95).

---

## 5. Mobile & Touch Responsive Adaptation

- **Document Viewport Scaling**: On mobile screens (< 768px), the 8.5" x 11" document sheet is rendered inside an auto-scaling container (`scale-[0.85]` or responsive width) with horizontal padding and a floating "Zoom & Inspect Letter" toggle.
- **Bottom Guided Input Sheet**: A native-feeling bottom drawer (`fixed bottom-0 inset-x-0`) slides up with the active field's input:
  - Minimum 16px font size to prevent iOS Safari auto-zoom.
  - Specific `inputMode` and `autoComplete` attributes.
  - Safe-area inset bottom padding (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
  - Next/Previous arrow controls to advance through fields seamlessly with touch.
