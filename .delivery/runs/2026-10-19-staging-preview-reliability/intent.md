# Intent — Staging Preview and Reliability Repair

## Seed

Repair the staging purchase journey after manual testing exposed (1) a `Review letter` action that opens delivery pricing without explicitly presenting the review surface and (2) a raw Cloud Firestore permission error at payment initialization. Define a customer-safe and operations-useful failure-handling standard for the whole journey. Clarify the security-deposit vacated-property address input.

## Evidence and context

- Customer capture 1: after all details and signature are complete, the visible `Review letter` action does not reveal the letter before checkout.
- Customer capture 2: delivery-tier modal works, but the next action exposes `PERMISSION_DENIED: Cloud Firestore API has not been used in project docketstamp...`.
- `DocumentWorkspace.tsx` owns the preview and sends both completion paths to `setIsCheckoutOpen(true)` once the draft is signed.
- `LivePaperSheet.tsx` receives the `InterpolatedDocument` from `interpolateNotice()`.
- `lock-and-intent` renders the frozen Lob document using `renderLobHtmlPayload(doc)` after it has created the same interpolated document.
- `apphosting.yaml` defaults `FIREBASE_PROJECT_ID` to `docketstamp`; `apphosting.staging.yaml` overrides it to `docketstamp-staging`.
- The deployed error names `docketstamp`, proving the staging environment-specific override was not applied to that rollout.
- Firebase documentation says `apphosting.staging.yaml` is selected only when the backend Environment name is `staging`; console-defined values have higher precedence.

## Constraints

- Preserve all six DocketStamp system invariants, including freeze-before-pay and dual-render content parity.
- Never make a production Firestore database merely to hide a staging configuration defect.
- Do not expose provider/project names, raw exception text, secrets, or payment/provider diagnostics to customers.
- Keep actionable diagnostic details available to authorized admins with correlation IDs.
- No real postage or production payment in validation.

## Acceptance criteria

1. A signed customer can explicitly inspect the complete letter before delivery selection on mobile and desktop; `Review letter` never opens checkout.
2. The review display and frozen Lob payload have deterministic content parity, and a representative actual-print proof is tested for geometry/clear zones.
3. The staging backend demonstrably runs with `FIREBASE_PROJECT_ID=docketstamp-staging`; checkout initializes an order without Firestore project errors.
4. Every customer-facing failure point has a plain-language recoverable message, retained form state where safe, an accessible alert, and a support/reference ID; admins receive classified diagnostics and alerts.
5. The vacated-property address accepts structured address details while producing the same deterministic one-line address token in the letter.

## Lanes

- Local Codex: source inspection, plan synthesis, ledger ownership.
- Alternate review: no configured Antigravity/alternate-app access detected. A handoff request is saved for an independent feasibility critique before implementation.

## Unknowns requiring verification during execution

- Confirm the staging App Hosting backend Environment name is unset/not `staging`, and whether a console variable additionally overrides the YAML value.
- Confirm the current Cloud Firestore database and App Hosting service account IAM in `docketstamp-staging` after the correct environment config is active.
- Decide whether preview proof should use Lob's test PDF or a local print render in addition to automated geometry assertions.
