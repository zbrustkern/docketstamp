# SendMyNotes: Conversion Redesign Validator Remediation Report

**Document ID:** CR-VAL-002  
**Date:** October 12, 2026  
**Audience:** Independent Validator & Founder  
**Branch:** `cr/integration`  
**Governing Review:** Independent Review of `CR-VAL-001` (October 12, 2026)  
**Governing Decisions:** Canonical Project Brief & Canonical Product Specifications (October 11, 2026)  

---

## 1. Executive Summary

This report documents the completed implementation and verification of all **9 findings** identified in the Independent Review of `CR-VAL-001`.

Every remediation adheres strictly to the October 11, 2026 founder decisions:
1. **Purchase Measurement & Authority:** Wired backend `recordServerTelemetry` into paid order execution, excluded founder/comp/test cohorts from revenue & conversion funnels, eliminated premature `AddPaymentInfo` triggers, and established a durable per-order purchase ledger.
2. **Selected Occasion Isolation:** Card selection retains exact occasion context (sympathy, thank you, birthday, or custom art). Zero automatic greeting/text insertion on entry; 1-tap suggested starters are explicitly user-selected.
3. **Draft Recovery & Zero Fictional Defaults:** Purged all fabricated placeholder names ("Dear Eleanor,", "Warmly, Thomas", etc.). Full user-authored message parts (greeting, note, signoff, recipient, sender, active step) are persisted in `lib/draft` and recovered on refresh. Post-payment state marks `completed: true` and locks step to confirmation to prevent accidental second checkout.
4. **Provider-Controlled Wallet:** Integrated Stripe `ExpressCheckoutElement` above `PaymentElement` with fallback divider. Wired availability telemetry (`wallet_availability_observed`). Apple Pay remains explicitly marked unverified until certified on real iOS hardware.
5. **Protected Receipt & Server-Backed Fulfillment:** Propagated `viewToken` through intent creation to guest receipt continuity (`/order/:id?viewToken=...`). `Step4` verifies `confirm-order` HTTP response before proceeding. `Step5` renders dynamic server-backed fulfillment stages ("Payment Received", "Queued for Fulfillment", "In Production", "Mailed").
6. **Folded A2 Commercial Output:** Replaced 5:7 dimensions (1500×2100) with true Folded A2 17:22 commercial print dimensions (1275×1650 px at 300 DPI, with 1020×1320 240 DPI and 892×1155 210 DPI tiers) in `lib/image-optimizer.ts` and card preview components.
7. **Mobile Action Bar De-Duplication:** Removed duplicate sticky bars from `Step2NoteComposition` and `Step3EnvelopeAddressing`. The single, persistent `ActionBar` controls step progression.
8. **Meta Customization Privacy:** Eliminated customer prompt text from Meta Pixel `CustomArtworkGeneration` telemetry, replacing it with static non-PII labels.
9. **Route Cutover & Claims Rollout:** Mounted the candidate draft-backed experience in `components/ExperienceRouter.tsx` (`isV3`) and `app/new/page.tsx`. Corrected legacy stock ("Folded A2 Cardstock") and delivery claims in legacy components.

---

## 2. Remediation Verification Matrix

| Finding | Description | Severity | Remediated Files | Verification Evidence |
| :--- | :--- | :---: | :--- | :--- |
| **1** | Purchase measurement not fully connected; spoofed client events rejected but server telemetry not wired; inside_note_edited counted as note completion; test/comp cohorts not excluded; AddPaymentInfo fired prematurely | **P1** | `lib/order-processor.ts`<br>`lib/metrics-rollup.ts`<br>`app/preview/entry/client.tsx` | • Server telemetry emitted in `processPaidOrder`.<br>• `noteCompleted` requires explicit `note_completed`.<br>• `isExcludedOrderCohort` excludes test/comp/founder orders.<br>• Durable ledger via `paidOrderIds`.<br>• Premature `AddPaymentInfo` removed.<br>• Tests pass (8 assertions in `test:remediation`). |
| **2** | Selected occasion can produce wrong message (birthday starter leaking onto sympathy / thank-you) | **P1** | `app/preview/entry/client.tsx`<br>`components/v3/Step2NoteComposition.tsx` | • Selected design's occasion is strictly preserved.<br>• Removed auto-injection of birthday text.<br>• 1-tap "Use suggested starter" chip matches current occasion bank.<br>• Tests pass (5 assertions in `test:remediation`). |
| **3** | Full draft recovery not implemented; fabricated names ("Eleanor Vance", "Thomas Miller"); salutation/signoff reset on refresh; post-payment refresh risk | **P1** | `app/preview/entry/client.tsx`<br>`lib/draft/store.ts`<br>`lib/draft/types.ts`<br>`lib/draft/reducer.ts` | • Fabricated strings replaced with `""`.<br>• `salutation` and `signOff` preserved in `sanitizeDraftState`.<br>• `currentStep` persisted.<br>• `MARK_COMPLETED` sets `completed: true` & locks to confirmation step.<br>• Tests pass (13 assertions in `test:remediation`). |
| **4** | Wallet integration incomplete; mounts PaymentElement only; no Express Checkout element or availability callback | **P1** | `components/v3/Step4ReviewAndPayment.tsx` | • `ExpressCheckoutElement` mounted above `PaymentElement` with divider.<br>• `handleExpressReady` emits `wallet_availability_observed`.<br>• Apple Pay remains marked unverified pending physical device test.<br>• Tests pass (2 assertions in `test:remediation`). |
| **5** | Receipt and fulfillment confirmation need server state; viewToken dropped; confirm-order HTTP result uninspected; static "In Production" | **P1** | `app/preview/entry/client.tsx`<br>`components/v3/Step4ReviewAndPayment.tsx`<br>`components/v3/Step5Confirmation.tsx` | • `viewToken` preserved and passed to receipt URL (`/order/:id?viewToken=...`).<br>• `confirm-order` HTTP response status checked before success transition.<br>• Dynamic server-backed status labels rendered.<br>• Tests pass (5 assertions in `test:remediation`). |
| **6** | Grid proportions do not complete A2 output alignment; image-optimizer produces 1500×2100 (5:7); CardPreview uses 5:7 | **P1** | `lib/image-optimizer.ts`<br>`components/CardPreview.tsx` | • Sharp resize target updated to 1275×1650 px (300 DPI Folded A2, 17:22 ratio).<br>• CardPreview aspect ratios updated to `aspect-[17/22]` and `aspect-[17/11]`.<br>• Tests pass (7 assertions in `test:remediation`). |
| **7** | Assembled mobile shell has duplicate fixed bottom action bars | **P2** | `app/preview/entry/client.tsx`<br>`components/v3/Step2NoteComposition.tsx`<br>`components/v3/Step3EnvelopeAddressing.tsx` | • Passed `hideFixedActionBar={true}` to embedded components.<br>• Single sticky `ActionBar` controls navigation.<br>• Tests pass (2 assertions in `test:remediation`). |
| **8** | Custom prompt text sent to Meta Pixel telemetry | **P1** | `app/preview/entry/client.tsx` | • Prompt substring removed from Meta event.<br>• Uses non-PII static label: `contentName: "Custom Artwork Card"`.<br>• Tests pass (1 assertion in `test:remediation`). |
| **9** | Route wiring and claims rollout unfinished; legacy 120 lb stock and mailing today claims | **P1** | `components/ExperienceRouter.tsx`<br>`app/new/page.tsx`<br>`components/CheckoutStep.tsx`<br>`components/VendingMachineBuilder.tsx` | • `ExperienceRouter` mounts candidate flow when `isV3` is true.<br>• `/new` route mounts candidate flow.<br>• Corrected "5×7" to "Folded A2 Cardstock" and "mailing today" claims in legacy files.<br>• Tests pass (6 assertions in `test:remediation`). |

---

## 3. Test Suite & Build Status

- **Type Check:** `npx tsc --noEmit` exits `0` with zero diagnostic errors across all files.
- **Automated Tests:** `npm test` runs 13 test suites covering 380+ assertions; **all 13 pass (0 failures)**:
  - `test:target` (43 passed)
  - `test:security` (23 passed)
  - `test:flags` (14 passed)
  - `test:ads` (45 passed)
  - `test:meta` (43 passed)
  - `test:sync` (11 passed)
  - `test:intent` (6 passed)
  - `test:payment-mode` (22 passed)
  - `test:sender-validation` (17 passed)
  - `test:telemetry-ingestion` (36 passed)
  - `test:delivery-estimate` (10 passed)
  - `test:draft` (68 passed)
  - `test:remediation` (49 passed)
- **Production Build:** Next.js build compiles all 71 routes without errors.
- **Gating Integrity:** Production allocation remains strictly gated. Remote `origin/main` remains untouched.

---

## 4. Next Operator & Validator Steps

1. **Physical Device Audit:**
   - Execute Apple Pay and Google Pay checkouts on physical iOS Safari and Android Chrome devices to confirm sheet presentation and token handling.
2. **Viewport Screenshot Inspection:**
   - Review 320px, 375px, 390px, and 430px mobile viewport renders of the active 4-step candidate journey.
3. **Reversible Candidate Allocation:**
   - Deploy `cr/integration` behind the `isV3` feature flag for controlled traffic allocation, measuring verified customer conversion via server telemetry.
