# Checkout integrity implementation result

## Delivered

- Lock ownership now comes only from a verified Firebase bearer token. Request `userId` is ignored. Guest attempts use a cryptographically random capability stored by digest; ownership checks use that capability.
- `lock-and-intent` accepts `draftId`, `draftRevision`, `checkoutCapability`, and `idempotencyKey`. It binds a stable request digest to the verified owner scope, request key, quote, and canonical document inputs. Replays return the original attempt and exact persisted HTML snapshot; key reuse with changed inputs returns 409.
- Orders retain the original frozen HTML and document-integrity evidence. New attempt metadata stores snapshot hash, quote/pricing identity, amount, currency, tier, policy revision/content digest/nexus, payment intent, and lifecycle state. Existing historical snapshot hash formats are unchanged.
- Stripe PaymentIntent creation uses a stable per-attempt idempotency key and can recover the same provider request if the first server response was lost.
- Added an authorized supersession endpoint. It marks cancellation pending before provider work, verifies cancellation/capture state, and preserves captured/processing/unknown outcomes as explicit blocked states. It does not issue refunds. A paid or free-authorized attempt cannot be superseded.
- Added a pure fulfillment gate contract. It allows finalized `paid` and `free_authorized` attempts, blocks superseded/cancelled/uncertain/capture-exception attempts, and preserves behavior for historical orders without attempt metadata.
- Lock accepts signed, draft/revision/address-bound verification evidence. For legacy callers that omit evidence, the server verifies the exact submitted addresses; if postal normalization changes one, checkout stops and returns the proposed address for explicit review. Invalid supplied evidence is rejected. Provider mode restrictions preserve staging/live separation.

## Verification

- Focused offline tests: `NODE_ENV=test USE_MOCK_FIRESTORE=true MOCK_FIRESTORE_MEMORY_ONLY=true node --require ./tests/admin-console/offline-preload.cjs --import tsx --test --test-concurrency=1 tests/checkout-attempt-integrity.test.ts tests/address-verification-evidence.test.ts tests/fulfillment-convergence.test.ts` — 6 passed, 0 failed.
- TypeScript: `npx tsc --noEmit --pretty false` — passed.
- The offline preload blocked network transports. No live Stripe or postal-provider call was made; mock results are not provider acceptance evidence.

## Residual limits

- Provider capture and free-order completion must continue to update the flattened order lifecycle fields through the fulfillment authority integration so the new dispatch gate sees verified `paid` or `free_authorized` state. Those shared changes are being integrated separately.
- An attempt left in `creating` with no committed order is safely marked cancelled on retry; a provider or database outage after an order exists is recovered with Stripe's stable idempotency key or remains blocked for reconciliation.
- Full browser checkout and Stripe webhook race exercises were not run in this workstream; the validation here covers focused state/store tests and TypeScript only.
