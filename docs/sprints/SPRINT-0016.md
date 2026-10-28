# SPRINT-0016 — Mobile Conversion Polish, Contextual CASS Verification & Zero-Lag Form Ergonomics

**Status:** Complete  
**Run:** `2026-10-28-mobile-ux-polish`  
**Owner:** Antigravity Coordinator; Flash Execution Subagents  
**Chapter:** None  

## Pyramid Index

- **L0:** Eliminate mobile conversion friction across the homepage chooser, guided preparation drawer, signature adoption flow, and USPS CASS checkout verification so a mobile user can go from letter selection to final review and payment in one liquid-smooth flow.
- **L1:**
  - **Above-the-Fold Mobile Chooser CTA:** Compact mobile hero/listbox spacing, add an inline `"Continue →"` CTA on the selected letter card, support second-tap-to-continue, and auto-scroll the action bar into view on selection.
  - **Contextual Inline CASS Widgets (Remove Top-of-Page Dead Real Estate):** Remove the two disabled top-of-page CASS boxes from `DocumentWorkspace` and embed contextual address status/check controls directly inside the Sender and Recipient sections of `GuidedFieldDrawer`.
  - **Fix CheckoutModal Multi-Address CASS Bug:** Fix the `draftRevision` desync between `CheckoutModal` and `DocumentWorkspace` (`onApplyFieldValues`) and verify both sender and recipient addresses before invoking `executeLockAndIntent` so accepting both USPS updates proceeds directly to Final Review without error.
  - **iOS Date Picker Containment & Zero-Lag Currency Formatting/Validation:** Constrain `<input type="date">` width on iOS WebKit, add `inputMode="decimal"`, format currency on `onBlur` + in `interpolateNotice()` (`1500` → `$1,500.00`), and mirror server currency validation on blur.
  - **Single-CTA Signature Adoption & Auto-Advance:** Auto-advance from `"Adopt & Sign Letter"` to the Delivery & Payment modal when fields are valid, convert `"Signature Adopted ✓"` into a static verification badge, and remove duplicate green CTAs on mobile.
- **L2:** See Root-Cause Diagnosis, UX Decisions & Recommendations, Technical Architecture, Phased Implementation Plan, and Acceptance Criteria below.

---

## 1. Root-Cause Diagnosis & UX Recommendations

### Issue 1: Homepage Letter Chooser — "Continue" Below the Fold on Mobile
- **Symptom:** On a 390×844 mobile viewport (`app/page.tsx` + `InteractiveHomeWorkbench.tsx` + `HomeLetterChooser.tsx`), selecting a letter highlights the card, but the `Continue →` button sits below the fold.
- **Solution:**
  1. **Inline Selected-Card Action:** When a letter is selected and ready (`isComplete === true`), render a crisp inline `"Continue →"` pill button directly inside the selected letter card so the CTA is right under the user's thumb.
  2. **Smart Scroll-Into-View:** When a user selects a letter or purpose in `HomeLetterChooser`, smoothly scroll the primary action bar into view (`block: 'nearest'`).
  3. **Tighter Mobile Vertical Rhythm:** Slightly compact mobile padding in `InteractiveHomeWorkbench.tsx` and `HomeLetterChooser.tsx` (`max-h-[196px] sm:max-h-[240px]`) so the footer action bar is visible above the fold on standard mobile viewports.

### Issue 2: Page Two Top Nonfunctional CASS Widgets on Mobile
- **Symptom:** [`DocumentWorkspace.tsx`](file:///Users/zeke/code/DocketStamp/src/components/docket/DocumentWorkspace.tsx#L680-L698) renders `<section aria-label="Mailing address verification">` at the very top of the page above the drawer. When a mobile user enters Page 2, the prime top half of their screen shows two disabled `"Check address with USPS CASS"` boxes before they have even typed Step 1.
- **Solution:**
  1. Remove the standalone top-of-page `<section aria-label="Mailing address verification">` banner from `DocumentWorkspace.tsx`.
  2. Pass lightweight address verification props into `GuidedFieldDrawer.tsx` and render a compact, contextual verification bar at the foot of **Your details (Sender Address)** and **Recipient details (Destination Address)**—and only show/enable the interactive check button once that specific address has valid street, city, state, and ZIP fields.
  3. Keep automatic CASS verification during checkout (`CheckoutModal.tsx`) as the primary zero-effort path.

### Issue 3: Date Picker Overrunning its Container on iOS Safari
- **Symptom:** In [`GuidedFieldDrawer.tsx`](file:///Users/zeke/code/DocketStamp/src/components/docket/GuidedFieldDrawer.tsx#L856-L869), `<input type="date">` overflows the right border of its `FieldInputRow` container on iOS WebKit because iOS Safari applies an intrinsic inline-flex min-width to `-webkit-date-and-time-value`.
- **Solution:**
  1. Add `overflow-hidden min-w-0` to `FieldInputRow` in `GuidedFieldDrawer.tsx`.
  2. Add `block w-full min-w-0 max-w-full appearance-none box-border` to `<input type="date">`.
  3. Add WebKit date input normalization rules in `app/globals.css`:
     ```css
     input[type="date"] {
       -webkit-appearance: none;
       appearance: none;
       min-width: 0;
       max-width: 100%;
       box-sizing: border-box;
     }
     input[type="date"]::-webkit-date-and-time-value {
       text-align: left;
       min-width: 0;
     }
     ```

### Issue 4: Dollar Amount Validation & Auto-Formatting (Recommendation)
- **Recommendation — "Free Typing + Blur Canonicalization + Live Preview Normalization":**
  - **Why NOT live input masking on `onChange`:** Rewriting the input string on every keystroke causes cursor jumping and backspace bugs on mobile keyboards.
  - **What we SHOULD do instead:**
    1. **Mobile Decimal Keypad:** Set `inputMode="decimal"` on `inputType === 'currency'` in `GuidedFieldDrawer.tsx` so iOS/Android shows the clean numbers-and-decimal keyboard.
    2. **Auto-Format on `onBlur`:** Let the user type `1500` or `1500.5` freely with zero lag. On `onBlur`, if `parseCurrencyToCents(val)` succeeds, format the field value cleanly to `$1,500.00` (`formatCentsAsCurrency`).
    3. **Deterministic Renderer Formatting (`interpolateNotice`):** In [`interpolate.ts`](file:///Users/zeke/code/DocketStamp/src/lib/docket/renderer/interpolate.ts), normalize any valid `currency` field through `formatCurrencyValue()` so even before blur (or via URL/agent prefill like `1500`), the live paper sheet and Lob PDF always print formal `$1,500.00` instead of bare `1500`.
    4. **Client-Server Validation Parity (`validateNoticeDraft`):** In [`draft-recovery.ts`](file:///Users/zeke/code/DocketStamp/src/lib/docket/draft-recovery.ts), validate `currency` fields using `parseCurrencyToCents()` and enforce the deposit arithmetic checks (`amountReceivedToDate <= depositAmount` and `balanceRequested <= depositAmount - amountReceivedToDate`) so invalid amounts or math mismatches show a polite inline message on blur rather than failing late at `/api/docket/lock-and-intent`.

### Issue 5: Post-"Adopt & Sign" Three Green Buttons + Clickwrap Affirmation Gravity
- **Symptom:** Clicking `"Adopt & Sign Letter"` leaves the user on the same screen staring at three green buttons: top bar `CHOOSE DELIVERY AND PAY →`, card button `SIGNATURE ADOPTED ✓`, and bottom bar `CHOOSE DELIVERY AND PAY →`.
- **Recommendation & Solution:**
  1. **Auto-Advance on Initial Signature Adoption:** When the user clicks `"Adopt & Sign Letter"` and `validation.isValid` is true, immediately adopt the signature AND advance directly to the Delivery & Payment modal (`CheckoutModal`), which walks them through USPS Service Selection → Final Frozen Review → Payment. (If any field above is still incomplete/invalid when they click Adopt & Sign, adopt the signature and scroll directly to `firstInvalidFieldKey` with errors highlighted.)
  2. **De-buttonize "Signature Adopted ✓":** If the user closes the modal or returns to the drawer while signed, render the adopted state in the signature card as a non-button verification badge (`Signature Adopted ✓`) rather than an interactive green button.
  3. **Eliminate Duplicate Mobile Green CTAs:** In `StickyExecutionBar.tsx`, hide the duplicate `"Choose delivery and pay →"` button on mobile viewports (`hidden md:flex`) when `mobileView === 'drawer'`, since the drawer's sticky bottom bar already provides `"Review letter →"` and `"Choose delivery and pay →"`. On mobile `document` preview view (`mobileView === 'document'`), keep `"Choose delivery and pay →"` visible in the top bar so the user can proceed right after reviewing the paper sheet.
  4. **Zero-Friction Clickwrap & Institutional Attestation Gravity:** Keep the single affirmation checkbox (0 extra taps) and preserve the exact statutory affirmation sentence verbatim, while adding a `SELF-REPRESENTATION & IRREVERSIBLE DISPATCH AFFIRMATION` micro-header, subtle institutional amber/slate framing, and direct clickwrap links to `/terms`, `/privacy`, and `/return-policy`.

### Issue 6: CASS Verification Error After Accepting Both Address Updates
- **Root Cause (3 Compounding Bugs in `CheckoutModal.tsx` & `DocumentWorkspace.tsx`):**
  1. **Early Return Before Verifying Second Role:** In `CheckoutModal.tsx:766-813` (`handleProceedToPayment`), the loop checks `['sender', 'recipient']`. When `sender` has a USPS standardization suggestion (`isChanged === true`), it sets `addressReviewSuggestion` for `sender` and returns early without checking `recipient` or saving `updatedEvidence`.
  2. **Calling `executeLockAndIntent` Before `recipient` Is Verified:** When the user accepts the `sender` suggestion, `handleApplyAddressSuggestion` (`CheckoutModal.tsx:822-862`) re-verifies only `sender` and immediately calls `executeLockAndIntent` while `recipient` still has no client evidence.
  3. **Fatal `draftRevision` Desync (`1 !== 0`):** In `CheckoutModal.tsx:830-861`, `handleApplyAddressSuggestion` calls `onApplyFieldValues(suggestion.suggested)` and passes `nextRev = draftRevisionRef.current + 1` to `verifyAddressInline` and `executeLockAndIntent`. However, `onApplyFieldValues` in `DocumentWorkspace.tsx:797` updates `userValues` **without incrementing `draftRevision` in `DocumentWorkspace`!** As a result:
     - `sender` evidence is bound to `draftRevision + 1`, while `DocumentWorkspace.draftRevision` stays at `draftRevision`.
     - Even worse, at the end of `executeLockAndIntent` (`CheckoutModal.tsx:643`), `if (originatingRevision !== draftRevisionRef.current)` **always evaluates to `true`** (`nextRev !== draftRevision`), causing `CheckoutModal` to immediately supersede/cancel its own lock attempt and throw: *"Your draft changed while checkout was being prepared. Review the latest version before continuing."*
- **Solution:**
  1. **Synchronize `draftRevision` in `DocumentWorkspace.onApplyFieldValues`:** When `CheckoutModal` applies standardized address fields via `onApplyFieldValues`, increment `draftRevisionRef.current` and `setDraftRevision(draftRevisionRef.current)` in `DocumentWorkspace` (while preserving `isSignatureAdopted` and `isAffirmed` since the user explicitly confirmed the USPS standardization of their signed draft) and return the new `draftRevision` number synchronously so `CheckoutModal` and `DocumentWorkspace` never drift!
  2. **Queue Both Address Suggestions Cleanly Before `executeLockAndIntent`:** In `CheckoutModal.tsx`, verify both `sender` and `recipient` (or after accepting/keeping `sender`, check if the remaining role still needs verification/review for the new `draftRevision` before calling `executeLockAndIntent`), and re-bind fresh signed evidence for both roles at the updated `draftRevision` before calling `/api/docket/lock-and-intent`.

---

## 2. Implementation Plan & File Ownership

| Phase | Files Modified | Tasks |
| :--- | :--- | :--- |
| **Phase 1: Currency Formatting, Validation Parity & Date Input CSS** | `src/lib/docket/input-validation.ts`, `src/lib/docket/draft-recovery.ts`, `src/lib/docket/renderer/interpolate.ts`, `app/globals.css` | 1. Export `formatCurrencyValue(val)` / `formatCentsAsCurrency(cents)` in `input-validation.ts`.<br>2. Normalize `currency` fields in `interpolateNotice()` so bare numbers (`1500`) render as `$1,500.00` on the live preview and PDF.<br>3. Add `currency` validation (`parseCurrencyToCents`) and deposit balance math checks to `validateNoticeDraft()` in `draft-recovery.ts`.<br>4. Add iOS WebKit `input[type="date"]` overflow prevention rules in `app/globals.css`. |
| **Phase 2: Mobile Homepage Chooser Above-the-Fold Polish** | `src/components/docket/HomeLetterChooser.tsx`, `src/components/docket/InteractiveHomeWorkbench.tsx` | 1. Add inline `"Continue →"` action button on the selected letter card in `HomeLetterChooser.tsx` and allow second-tap on an already-selected card to trigger `handleContinue()`.<br>2. Auto-scroll the chooser action bar (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`) upon selecting a letter or hardware purpose.<br>3. Tighten mobile vertical spacing so the chooser footer sits above the fold on 390×844 viewports. |
| **Phase 3: Guided Drawer UX (Contextual CASS, Currency Blur, Date Containment, Single-CTA Sign)** | `src/components/docket/GuidedFieldDrawer.tsx`, `src/components/docket/StickyExecutionBar.tsx`, `src/components/docket/DocumentWorkspace.tsx` | 1. Remove the top-of-page `<section aria-label="Mailing address verification">` from `DocumentWorkspace.tsx` and render compact, contextual CASS verification controls inside the Sender and Recipient sections of `GuidedFieldDrawer.tsx` (active once that role's address fields are valid).<br>2. Constrain `<input type="date">` in `FieldInputRow` with `min-w-0 max-w-full appearance-none` and `overflow-hidden` on the row container.<br>3. Add `inputMode="decimal"` and `onBlur` currency formatting (`1500` → `$1,500.00`) to `currency` fields.<br>4. Auto-advance `"Adopt & Sign Letter"` click to `CheckoutModal` when `validation.isValid` is true, convert `"Signature Adopted ✓"` into a static badge, and hide the duplicate top-bar green CTA on mobile drawer view. |
| **Phase 4: CheckoutModal Multi-Address CASS Resolution Fix** | `src/components/docket/CheckoutModal.tsx`, `src/components/docket/DocumentWorkspace.tsx` | 1. Update `onApplyFieldValues` in `DocumentWorkspace.tsx` to increment and return `draftRevision` without invalidating signature/affirmation.<br>2. Update `CheckoutModal.tsx` (`handleProceedToPayment`, `handleApplyAddressSuggestion`, `handleKeepOriginalAddress`) so accepting a suggestion for `sender` seamlessly verifies/reviews `recipient` (and binds both evidences to the current `draftRevision`) before calling `executeLockAndIntent`. |
| **Phase 5: Automated Tests & Mobile Viewport Verification** | `tests/s2-chooser-and-routing.test.ts`, `tests/s4-details-and-review.test.ts`, `tests/s5-delivery-and-payment.test.ts`, `tests/docket-input-validation.test.ts` | 1. Add unit/integration tests for currency blur formatting, `interpolateNotice` currency normalization, `validateNoticeDraft` currency/deposit math checks, and multi-address CASS suggestion acceptance.<br>2. Run full test suite (`npm test`, `npx tsc --noEmit`) and verify zero regressions across all 6 system invariants. |

---

## 3. Definition of Done & Acceptance Criteria

1. **AC1 (Mobile Chooser Above-the-Fold Conversion):** Selecting a letter on mobile immediately reveals an inline `"Continue →"` CTA on the selected card and scrolls the bottom action bar into view; tapping an already-selected card advances to `/notices/[slug]`.
2. **AC2 (No Dead Top CASS Widgets on Page 2):** Navigating to `/notices/[slug]` on mobile opens directly to the letter preparation header and Step 1 fields without two disabled CASS widgets occupying the top of the viewport; contextual CASS verification remains available inline beneath the Sender and Recipient address sections and automatically at checkout.
3. **AC3 (iOS Date Picker Container Fit):** `<input type="date">` stays strictly within the bounds of `FieldInputRow` at 320px, 375px, and 390px widths with zero horizontal overflow.
4. **AC4 (Zero-Lag Currency Formatting & Validation):** Currency fields use `inputMode="decimal"`, allow lag-free typing (`1500`), auto-format to `$1,500.00` on blur, render as `$1,500.00` in `interpolateNotice()`, and validate format + deposit arithmetic in `validateNoticeDraft()`.
5. **AC5 (Single-CTA Signature Adoption):** Clicking `"Adopt & Sign Letter"` when all details are valid adopts the signature and automatically opens the Delivery & Payment modal; `"Signature Adopted ✓"` renders as a non-button badge and mobile drawer view shows only one `"Choose delivery and pay →"` button.
6. **AC6 (Zero-Error Multi-Address CASS Acceptance):** Accepting USPS suggestions for both Sender and Recipient in `CheckoutModal` keeps `draftRevision` and signed `AddressVerificationEvidence` synchronized for both roles and advances cleanly to the Final Review screen on the first try.
7. **AC7 (System Invariants & Test Suite):** All six DocketStamp invariants and existing test suites pass (`npx tsc --noEmit` and `npm test`).
