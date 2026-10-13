# SendMyNotes: Conversion Redesign Validator Remediation Report

**Document ID:** CR-VAL-003  
**Date:** October 12, 2026  
**Audience:** Independent Validator & Founder  
**Branch:** `cr/integration`  
**Governing Review:** Independent Review of `CR-VAL-002` (`docs/CONVERSION_REDESIGN_CR-VAL-002_RELEASE_REVIEW.md`)  
**Governing Decisions:** Canonical Project Brief & Canonical Product Specifications (October 11, 2026)  

---

## 1. Executive Summary

This report documents the resolution and end-to-end verification of all **6 findings** identified in the `CR-VAL-002` Release-Readiness Review.

With these remediations, `cr/integration` is ready for operator-controlled preview and payment testing. Production allocation remains strictly gated behind feature flag `isV3`, leaving `origin/main` untouched.

Key architectural fixes verified in this increment:
1. **Guest Receipt Contract & Token Hygiene:** Unified the token query parameter contract to support both `viewToken` and `token`. Added immediate URL history sanitization (`window.history.replaceState`) on mount to strip bearer tokens from the address bar, preventing token leakage in outbound HTTP `Referer` headers or client analytics, while securely persisting the token in `sessionStorage[order_token_<id>]`.
2. **Refresh Recovery & Flow Reset:** Replaced client-only boolean flags with server-backed order recovery. If `draft.completed === true`, the client recovers `orderId` and `viewToken` and verifies the order state against `/api/orders/${orderId}?token=${viewToken}`. If unverified or unpaid, the client completed bit is never trusted and the user is guided back to payment. Implemented auto-resume on pay-step refresh (`!clientSecret`), and created `resetEntireFlow()` to wipe drafts, contacts, salutations, sign-offs, and checkout keys when clicking "Clear draft" or "Send another card".
3. **Post-Payment Double-Pay Prevention & Reconciling State:** Locked payment form submission immediately upon Stripe `paymentIntent.status === "succeeded"` (`isPaymentCaptured: true`). If `/api/checkout/confirm-order` fails or times out, the client transitions to `"RECONCILING"` rather than presenting an active "Pay" button or decline message for an already charged customer. Suppressed marketing conversion pixels until server order verification succeeds.
4. **Stripe Express Checkout Elements & Telemetry:** Replaced global window telemetry with direct module import `trackEvent` from `@/lib/telemetry` for `wallet_availability_observed`. Implemented `await elements.submit()` prior to `stripe.confirmPayment` per Stripe's official Express Checkout Element specification. Apple Pay remains accurately labeled unverified pending physical iOS hardware testing.
5. **Purchase Attribution, Durable Ledger & Atomic Serialization:** Preserved visitor `sessionId` and `experienceVersion` from entry to `/api/checkout/create-intent` through to the Firestore `Order` document, eliminating synthetic `sess_<order>` fallbacks. Disconnected session conversion totals from the durable order ledger (`paidOrderIds`), allowing repeat purchases in the same session to increment order and revenue counts correctly. Serialized concurrent rollup writes via an atomic ingestion queue.
6. **Complete `/send` Occasion Route Coverage:** Extended `components/ExperienceRouter.tsx` to accept `initialOccasion`, `initialCoverUrl`, and scenario parameters. Mounted `ExperienceRouter` in both `app/send/[occasion]/page.tsx` and `app/send/[occasion]/[slug]/page.tsx`, ensuring ad traffic directed to occasion-specific landing pages receives the candidate draft-backed experience when `isV3` is enabled.

---

## 2. Remediation Verification Matrix

| Finding | Description | Severity | Remediated Files | Verification Evidence |
| :--- | :--- | :---: | :--- | :--- |
| **1** | Guest receipt contract mismatch (`viewToken` vs `token`); bearer token leakage risk in Referer / analytics | **P1** | `app/order/[id]/page.tsx`<br>`app/api/orders/[id]/route.ts`<br>`components/v3/Step5Confirmation.tsx` | • Receipt page supports both `token` and `viewToken` parameters.<br>• URL history sanitized on mount via `replaceState`, stripping tokens from address bar while preserving other query params.<br>• Token persisted in `sessionStorage[order_token_<id>]`.<br>• API route verifies `viewToken` query param.<br>• Tests pass (`tests/review-remediation.test.ts`). |
| **2** | Refresh recovery preserves client flags without server order identity; unresumed pay intents; incomplete flow reset | **P1** | `app/preview/entry/client.tsx` | • Server verification of recovered `orderId`/`viewToken` before showing confirmation; unverified/unpaid drafts reset `completed: false`.<br>• Pay-step refresh auto-resumes `initializeCheckout()`.<br>• `resetEntireFlow()` clears draft, addresses, salutation, signOff, order identity, viewToken, and checkout session keys on "Clear draft" and "Send another card". |
| **3** | Post-payment reconciliation incomplete; confirm-order failure risks re-presenting Pay action or double charge | **P1** | `components/v3/Step4ReviewAndPayment.tsx`<br>`components/v3/Step5Confirmation.tsx` | • `isPaymentCaptured` locks form and submit button immediately when Stripe succeeds.<br>• Confirm-order network failures transition safely to `"RECONCILING"`.<br>• Confirmation UI renders "Reconciling Order..." badge.<br>• Meta and Google Ads conversion events suppressed until order status is verified. |
| **4** | Wallet implementation needs direct telemetry module wiring and `elements.submit()` validation | **P1** | `components/v3/Step4ReviewAndPayment.tsx` | • Telemetry wired to module import `trackEvent` from `@/lib/telemetry`.<br>• `handleExpressConfirm` executes `await elements.submit()` before `stripe.confirmPayment` per Stripe docs.<br>• Apple Pay explicitly documented as unverified pending physical device test. |
| **5** | Purchase attribution detached; repeat purchases in session suppressed; non-atomic rollup updates | **P1** | `app/api/checkout/create-intent/route.ts`<br>`app/preview/entry/client.tsx`<br>`lib/metrics-rollup.ts` | • Intent creation persists visitor `sessionId` and `experienceVersion` into `Order`.<br>• `stageSessionIds.paid` and `paidOrderIds` separated; second purchase in same session increments `summary.paid`.<br>• `ingestQueue` serializes concurrent rollup writes safely.<br>• Tests pass (10 assertions in `tests/review-remediation.test.ts`). |
| **6** | Partial route coverage; `/send/[occasion]` and `[slug]` bypassed candidate | **P1** | `components/ExperienceRouter.tsx`<br>`app/send/[occasion]/page.tsx`<br>`app/send/[occasion]/[slug]/page.tsx` | • `ExperienceRouter` extended with occasion and cover URL props.<br>• Both `/send/[occasion]` and `[slug]` routes mount `ExperienceRouter`, routing to `EntryPrototypeClient` when `isV3` is true.<br>• Production build compiles all 71 static and dynamic routes. |

---

## 3. Test Suite & Verification Results

- **Type Check (`npx tsc --noEmit`):** Clean exit code `0`, 0 errors.
- **Automated Test Suites (`npm test`):** All 13 test suites pass (exit code `0`, 390+ assertions):
  - `tests/target-experience.test.ts` (43 passed)
  - `tests/security.test.ts` (23 passed)
  - `tests/feature-flags.test.ts` (14 passed)
  - `tests/ad-readiness.test.ts` (45 passed)
  - `tests/meta-capi.test.ts` (43 passed)
  - `tests/sync-reconciliation.test.ts` (11 passed)
  - `tests/create-intent.test.ts` (6 passed)
  - `tests/payment-mode-safety.test.ts` (22 passed)
  - `tests/sender-validation.test.ts` (17 passed)
  - `tests/telemetry-ingestion.test.ts` (36 passed)
  - `tests/delivery-estimate.test.ts` (10 passed)
  - `tests/draft-model.test.ts` (68 passed)
  - `tests/review-remediation.test.ts` (57 passed)
- **Next.js Production Build (`npm run build`):** Successfully compiled and statically optimized all 71 routes without diagnostic warnings or errors.
- **Gating Status:** Production allocation remains strictly gated. Remote `origin/main` is untouched.

---

## 4. Next Step: Operator Controlled Testing Protocol

Per the review recommendations, the next step is operator testing in a controlled preview environment prior to live customer traffic allocation:

1. **No-Charge Viewport & Keyboard Audit:**
   - Test `/preview/entry` on mobile viewports (320px, 375px, 390px, 430px).
   - Verify single persistent bottom action bar behavior when virtual keyboard opens during note composition and envelope addressing.
2. **Stripe Test Mode Wallet & Card Verification:**
   - Launch with Stripe test credentials (`pk_test_...`) on an HTTPS preview tunnel (e.g., ngrok or staging URL with Apple Pay domain association).
   - Test Express Checkout element presentation, wallet cancellation, card fallback, and successful test payment completion.
3. **Receipt & Flow Reset Verification:**
   - Verify guest receipt URL sanitization (`?viewToken=` stripped from browser address bar upon load).
   - Verify "Send another card" and "Clear draft" cleanly reset draft and checkout session state.
4. **Authorized Controlled Live Transaction:**
   - Following successful test mode runs, perform a single controlled live order, marked as test, reconciled in Stripe and Handwrytten.
