# Intent — Integrity Evidence for Frozen Docket Documents

## Goal

Strengthen DocketStamp's existing freeze-before-pay record with a small, honest
integrity-evidence layer. This is an operational provenance feature for an
automated document-preparation and USPS dispatch utility, not an e-signature,
notary, legal-opinion, or legal-validity product.

## Evidence at planning time

- `app/api/docket/lock-and-intent/route.ts` freezes `documentHtml` before
  creating a Stripe PaymentIntent, satisfying the core snapshot invariant.
- The locked payload is later passed directly to Lob by `lib/order-processor.ts`.
- `Order` stores Lob IDs, tracking and return-receipt fields, but has no digest
  or explicit signature-adoption/affirmation audit fields.
- `CheckoutModal.tsx` currently says SHA-256 is preserved even though no digest
  is written; that claim is inaccurate today.
- The browser requires a typed name and affirmation before it allows signature
  adoption, but those facts are not currently persisted by the lock endpoint.

## Scope

1. Add a canonical SHA-256 integrity record for the exact UTF-8 frozen Lob HTML.
2. Capture a narrow, server-timestamped adoption/affirmation record at locking.
3. Keep frozen evidence fields write-once in normal application flows and keep
   payment/fulfillment updates from modifying them.
4. Correct customer copy so it accurately describes only implemented behavior.
5. Add automated tests that prove the stored digest validates the stored HTML,
   changes with a material snapshot change, and that adoption cannot be claimed
   without the required customer action.
6. Deploy the verified change to `origin/staging` and Firebase staging only.

## Non-goals

- No signature drawing/image, biometric capture, DocuSign integration, notary
  representation, legal conclusion, or claim that a recipient must accept a
  notice.
- No public document/evidence export or new customer PII logging.
- No production push, live payment, live postal dispatch, or data backfill.
- No change to the immutable document geometry, deterministic notice copy, or
  Lob environment-key separation.

## Acceptance criteria

1. At checkout lock, the server computes and stores a lowercase SHA-256 digest
   of exactly the `documentHtml`/frozen Lob HTML bytes, with an explicit
   algorithm and evidence-schema version.
2. A stored signature evidence object contains only the typed signer name,
   server lock/adoption timestamp, and a stable identifier/version for the
   affirmation presented to the customer. The route accepts it only if the
   signature was adopted and affirmation was acknowledged; it validates the
   typed name against the deterministic document signer.
3. The browser supplies those assertion facts only after its existing required
   typed-name + checkbox adoption interaction. Editing the signed draft still
   invalidates adoption.
4. Fulfillment uses the original frozen HTML and normal status/payment updates
   cannot overwrite integrity evidence.
5. Customer-facing language never suggests legal validity, a notarization, or
   provider-backed e-signature certification. SHA-256 is mentioned only after
   it is actually stored.
6. Focused tests cover successful record creation, hash verification,
   tamper/change sensitivity, rejected missing/mismatched adoption assertions,
   freeze-before-pay order persistence, and retained Lob fields. Relevant
   existing payment/security tests pass.
7. Changes are committed, pushed only to `staging`, and Firebase App Hosting
   staging is rolled out from that exact commit. Production is untouched.

## Constraints

- Preserve all six DocketStamp invariants, particularly deterministic
  dual-render parity and freeze-before-pay.
- The server is authoritative for the digest and timestamp; client timestamps
  and client-provided hashes are never trusted.
- Do not store raw affirmation prose redundantly; preserve the authoritative
  display text in UI and store a stable version identifier.
- Keep retention and audit access within existing order/admin access controls.

## Lanes

- Luna implementation: scoped code, type, and test changes.
- Luna review: read-only inspection of the finished diff and tests.
- Codex coordinator: plan/ledger, independent verification, commit, staging
  push, and deployment evidence.
