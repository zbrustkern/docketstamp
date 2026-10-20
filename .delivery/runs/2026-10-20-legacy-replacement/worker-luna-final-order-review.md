# Final order/payment/provider/migration review

Read-only review of integrated HEAD `453034c` and current worktree state. No tests or live calls were run; the coordinator is running integrated validation.

## Findings

1. **[P2] Snapshot authority does not bind signature-adoption evidence.** `lib/frozen-notice-order.ts` validates the HTML digest and only checks that signer name, timestamps, and affirmation version are present. `computeOrderSnapshotHash()` in `lib/admin-console/finance/authority.ts` hashes the frozen HTML, addresses, tier, and amount, but omits `documentIntegrityEvidence`. Changing `signatureAdoption.signerName`, `adoptedAt`, or `affirmationVersion` while leaving the HTML untouched therefore passes frozen-order validation and does not invalidate an existing payment/free snapshot hash. Bind the integrity-evidence fields into the authority hash (or a separately verified evidence digest) and add a regression that mutates each field after checkout.

2. **[P2] A resume cursor can skip migration records.** In `lib/legacy-order-migration.ts`, `input.afterOrderId` takes precedence over `priorManifest.checkpoint.lastOrderId`; the code checks only that the supplied ID exists in the source. With records `a,b,c`, a first one-record batch checkpointed at `a`, and a resumed call supplying `afterOrderId: 'b'`, the second batch starts at `c` and can report `complete: true` while `b` is absent from `processedOrderIds`. When resuming, derive the cursor only from the prior checkpoint or reject any override that is not exactly the checkpoint cursor; test the skipped-record case.

## Verified safeguards

- Checkout saves the frozen rendered HTML and integrity evidence before creating a Stripe intent; free orders skip zero-dollar Stripe intents.
- Paid authority checks succeeded status, captured amount, USD currency, configured Stripe mode/account, order binding, and recorded intent ID. The processor and postal-attempt ledger provide separate idempotency gates.
- Markerless historical paid notices are explicitly accepted only when complete frozen HTML and integrity evidence validate; incomplete/free legacy records are routed to reconciliation.
- Lob staging mock mode cannot select live dispatch. Unknown/conflicting postal provenance is not queried through Lob; Handwrytten identifiers remain provider-specific.
- Order detail access returns a minimal anonymous DTO and only exposes the allow-listed private view to a secure token, verified owner, or admin.

