# Reporting and operator visibility plan

1. Keep generation/read/audit contracts intact while making source reads bounded by event/effective time and preserving explicit environment.
2. Reconcile capture/refund/dispute facts by financial effective time; build paid-order cohorts from in-window captures, but include older captures/refunds only where needed for in-window net cash and current open postal obligations.
3. Scope orders/postal/outbox joins through already-scoped authority facts. Missing environment or incomplete joins remain visible as partial; never infer environment or treat scan caps as complete.
4. Keep conversion as an entry cohort with a seven-day horizon and an explicit immature-session count. Keep spend, supplier, and processor cost coverage separate; unavailable/incomplete inputs yield unknown contribution.
5. Provide local-calendar Today/Yesterday/7/30/custom windows as DST-correct half-open UTC bounds and a small authenticated executive panel with freshness/evidence labels, keeping existing admin tools intact.
6. Add reference-case tests for late conversion, current refund on prior capture, older unpaid mailing, mixed currency, missing costs/spend, and DST; run offline tests and typecheck. Record limits in the result document.
