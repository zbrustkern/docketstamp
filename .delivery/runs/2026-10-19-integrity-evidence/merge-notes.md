# Merge and release notes

## Material trade-offs

- This sprint anchors the content digest and minimal adoption assertion in the
  same order record. It provides deterministic payload provenance when compared
  against a retained record, but it is not an independently anchored ledger
  against a privileged writer changing both fields.
- `signatureAdoption.adopted` and `.affirmed` are browser assertions. The server
  validates that they are true, requires the typed name to match the rendered
  document, and owns the lock timestamp. The record means the server received
  that affirmation at lock time; it is not proof that the server observed a
  physical click.
- No IP/device fingerprint was added. This limits PII expansion and keeps the
  feature appropriate for the document-preparation/USPS dispatch utility.
- No signature image, DocuSign or notary claim, legal conclusion, public proof
  export, production deployment, live payment, or live postal dispatch is part
  of this change.

## Review provenance

- Luna implementation completed the scoped changes.
- A separate Luna agent performed a read-only review recorded in
  `review-result.md`; verdict: conditional pass for staging-only provenance use.
- Coordinator independently ran the focused integrity suite, renderer/checkout
  suites, security/payment/telemetry checks, build, diff check, and release
  verification. Exact outcomes are recorded in the final sprint section.
