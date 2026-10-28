# Fulfillment convergence plan

1. Preserve current payment facts, verified obligation checks, immutable snapshot hashing, provider receipts, and the per-order payment outbox. Trace every paid, free, and operator dispatch entry point before migration.
2. Route paid obligations through `dispatchAuthorizedObligation`, matching free and operator dispatch. Keep provider idempotency tied to order identity and require reconciliation after uncertainty or an expired lease.
3. Apply the checkout-attempt dispatch gate immediately before provider submission. A captured payment remains recorded even when lifecycle state blocks fulfillment.
4. Preserve order status, receipt, telemetry, and CAPI follow-on behavior after accepted dispatch; ensure duplicate webhook/confirmation delivery cannot submit or notify twice.
5. Add durable follow-on recovery only where it fits existing outbox semantics, and add focused regression/race tests for route convergence, lease expiry, uncertainty, stable idempotency, and attempt gates.
6. Record actual changes, checks, and limitations in `fulfillment-result.md`. Do not call live payment or postal providers, send real email, deploy, automate, or commit.
