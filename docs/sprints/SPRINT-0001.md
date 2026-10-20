# Sprint 0001 — Preview, Staging Checkout, and Failure Resilience

**Status:** Active  
**Run:** `2026-10-19-staging-preview-reliability`  
**Authority:** `DOCKETSTAMP_MASTER_BUILD_SPEC.md`, `DOCKETSTAMP_AGENTIC_EXPANSION.md`  
**Source evidence:** customer staging captures; source at `7882796`; Firebase App Hosting configuration documentation.

## Pyramid index

| Outcome | Work package | Dependency |
| --- | --- | --- |
| A customer reviews exactly what will be mailed before buying | WP1 review navigation; WP2 render-proof parity | WP1 before WP2 validation |
| Staging checkout writes to staging Firestore | WP3 App Hosting environment repair | External configuration access |
| Failures are helpful to customers and actionable to admins | WP4 failure taxonomy and UI/API mapping; WP5 observability/tests | WP3 informs representative failure evidence |
| Vacated property data is easy to enter without changing letter semantics | WP6 structured address UX | WP1 state retention patterns |

## Objective

Make the full staging purchase journey truthful and recoverable: a signed customer must deliberately see their final letter, staging must use only staging resources, and every expected failure must give customers a safe next action while providing administrators the information to resolve it.

## Root-cause record

### Review behavior

The preview was built: `DocumentWorkspace` renders `LivePaperSheet` from `interpolateNotice()`. On mobile, the workspace initializes with the drawer visible and the document hidden behind `View letter`. The `Review letter` secondary button invokes `onNextRequiredField`; after a valid signed draft, `handleNextRequiredField` opens `CheckoutModal`. This is a semantic navigation bug: the control label promises review but executes checkout.

### Lob representativeness

The content pipeline is synchronized: both the screen preview and the server freeze route consume the same `InterpolatedDocument` created by `interpolateNotice()`, and `renderLobHtmlPayload()` receives that frozen document. This satisfies deterministic text/token parity.

The layouts are not the same renderer: `LivePaperSheet` is a React/Tailwind screen component, while Lob uses independent print CSS in `lob-html-shell.ts`. Therefore, the current screen is representative of content and document structure, but it is not sufficient evidence of pixel-perfect or clear-zone parity. The sprint must add a print-proof gate against the frozen Lob HTML/PDF.

### Staging payment failure

The visible `PERMISSION_DENIED` names project `docketstamp`. `apphosting.yaml` sets that project ID; `apphosting.staging.yaml` correctly overrides it with `docketstamp-staging`. Firebase only applies the environment-specific file when the App Hosting backend Environment name is `staging`, and console variables take precedence. The deployed response is direct evidence that the override was not effective. The repair is to set the staging backend Environment name to `staging`, remove/confine conflicting console variables, trigger a staging rollout, and verify the effective rollout environment. Do not enable Firestore in production as a workaround.

## Scope

- Review-state navigation and accessible mobile/desktop preview affordances.
- Shared-content and actual-print parity tests for immutable frozen payloads.
- Staging App Hosting environment configuration and checkout verification.
- A consistent customer error contract, retries, admin alerting/diagnostics, and coverage of known failure points.
- Structured vacated-property address entry compiled to a deterministic letter token.

## Non-goals

- Production Stripe/Lob setup, production Firestore enablement, real postage, or a new document template.
- Legal advice, free-text legal generation, or modifications to statutory letter prose.
- Broad admin-console redesign beyond failure classification, alert linkage, and diagnostics.

## Ordered tasks

### WP1 — Make review an explicit state

1. Introduce an explicit `review` UI state or route within the document workspace.
2. Make `Review letter` switch to the document pane, focus/scroll the complete 8.5×11 preview, and never open delivery pricing.
3. Make checkout initiation only available from a clearly labeled action after the customer has had the review state presented. Retain the existing signature/affirmation and invalidate it upon material edits.
4. In checkout, make `Back to review` restore this state and preserve all draft, tier, and address-verification data.
5. Ensure keyboard focus, screen-reader labels, Escape/back behavior, and mobile control visibility are tested.

**Acceptance:** Desktop and 390px mobile journeys prove review-before-delivery; no `Review letter` interaction can call `setIsCheckoutOpen(true)`.

### WP2 — Prove render/print parity at the immutable boundary

1. Retain `interpolateNotice()` as the sole token interpolation source for screen and server output.
2. Add a fixture that creates a signed, complete document, locks it, and asserts the frozen HTML contains exactly the preview's interpolated content (sender, recipient, RE line, statutory values, signature, UPL footer, docket ID, tier).
3. Render the frozen Lob payload in a print-capable test path (and, where available, inspect the Lob test PDF) to verify one page and the mandated clear zones/stamp/footer geometry.
4. Label the screen preview accurately until visual renderer equivalence is proven; do not claim it is a literal Lob print preview.

**Acceptance:** Content differences fail automated tests; a recorded representative print proof passes one-page/clear-zone review.

### WP3 — Repair and lock down staging App Hosting configuration

1. In Firebase Console, set backend `docketstamp` in project `docketstamp-staging` to Environment name `staging`.
2. Inspect backend console Environment variables and remove/replace any console-level `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, or `ENVIRONMENT` values that conflict with staging YAML. Console values win over YAML.
3. Confirm the backend live branch remains `staging` and production remains `main`.
4. Trigger one staging rollout, inspect that rollout's environment-value sources, and confirm both server and browser Firebase configuration identify `docketstamp-staging`.
5. Verify the staging Firestore database/API and the App Hosting service account's required Firestore permissions. If absent, enable/configure them only in `docketstamp-staging`.
6. Add a fail-closed environment consistency check: a production runtime must never use a staging project, and a staging runtime must surface a safe classified configuration fault rather than silently falling back to `docketstamp`.

**Acceptance:** a staging lock-and-intent succeeds through Firestore with an order visible only in staging; effective rollout evidence shows staging project values.

### WP4 — Customer-safe failure system and admin alerts

Create a typed error boundary/mapper used by UI and APIs. Each failure must have a stable public code, plain-language message, safe retry/recovery action, accessibility alert, correlation ID, and an internal category/cause.

| Failure surface | Customer treatment | Admin treatment |
| --- | --- | --- |
| Missing/invalid form values or signature | Inline field guidance; focus first invalid field | Validation aggregate only; no letter-body logging |
| Draft/hydration/recovery failure | Keep current typed values; offer retry or start fresh | Stage ID/status and classified cause |
| Address validation unavailable/invalid | Explain that address could not be confirmed; allow edit/retry; never claim CASS verification | Provider response class and attempt history |
| Checkout initialization / Firestore / config | “We couldn’t prepare secure payment. Nothing was charged.” Retry; preserve draft/tier/email | `CHECKOUT_CONFIGURATION` or `ORDER_PERSISTENCE` incident with provider/project metadata retained privately |
| Stripe Elements load / payment decline / confirmation | Clear payment-specific recovery; no raw Stripe error | Stripe request/payment-intent correlation and error class |
| Webhook verification or fulfillment | Confirmation reflects paid versus mailing-submitted truthfully; customer support path if delayed | High-severity signed event/dispatch incident, idempotency key and provider event IDs |
| Lob dispatch/status callback | Do not imply mail acceptance before confirmation; track retry or exception state | Fulfillment queue/error and webhook event diagnostics |
| Unexpected boundary/network failure | Neutral retry message with reference ID, preserve safe client state | Error digest, route, release, correlation ID, alert/dedupe |

Rules: never emit raw provider text, project identifiers, stack traces, secrets, payment details, or letter content in customer-visible alerts or telemetry. Admin diagnostics must be authorization-protected and redact secrets/letter contents.

**Acceptance:** each listed class has API and UI tests proving safe copy/state retention plus an authorized admin incident/evidence record.

### WP5 — Regression matrix and rollout gates

1. Add focused tests for signed review navigation, resize/mobile visibility, preview/frozen content comparison, staging environment selection, failed order persistence, payment retry, webhook/fulfillment classification, and error redaction.
2. Run existing security, payment-mode, docket, admin-auth, typecheck, and build suites.
3. Manual staging matrix: successful checkout with Stripe test card; invalid address; payment decline; temporary initialization failure; cancel/back/retry; verified Lob test/mock status.
4. Do not ship if staging still reports project `docketstamp`, a raw provider error reaches the customer, content differs from the frozen snapshot, or a dispatch result is overstated.

### WP6 — Vacated-property address ergonomics

Replace the current one-line `vacatedPremisesAddress` field with street address, unit/address line 2, city, state, and ZIP inputs (or a compact structured address component). Compile them in a single canonical deterministic display string for `{{vacatedPremisesAddress}}`; preserve legacy prefill compatibility and the 90-character one-page limit.

**Acceptance:** an address with an apartment/unit and a normal street address render correctly in the letter and retain/recover/edit without duplicate entry.

## Risks and mitigations

- **External config ambiguity:** Console overrides may mask YAML. Mitigate by recording rollout environment-source evidence before testing.
- **Preview overclaim:** Same content does not mean same pixels. Mitigate with frozen HTML/PDF proof.
- **Retry duplicates:** Retrying checkout/fulfillment could double charge or dispatch. Keep existing idempotency and immutable snapshot semantics; test every retry.
- **Error observability leaking sensitive facts:** Centralize redaction and ban raw error interpolation.
- **Geometry pressure from structured address:** format the token compactly and test maximum inputs against the one-page renderer.

## Validation

- `npm run test:docket`
- `npm run test:security`
- `npm run test:payment-mode`
- `npm run test:admin-auth`
- targeted new review, parity, error-contract, and configuration tests
- `npx tsc --noEmit`
- `npm run build`
- staging manual matrix using Stripe test mode and Lob mock/test mode only

## Review provenance

Local source review and plan synthesis by Codex. Firebase configuration behavior cross-checked against official Firebase App Hosting documentation. Independent alternate-app critique is pending; see the run handoff artifact.
