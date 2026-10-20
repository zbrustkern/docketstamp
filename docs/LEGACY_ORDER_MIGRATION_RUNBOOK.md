# Legacy order inventory and dry-run migration

This package provides an offline reader and fixture-driven migration planner. The tools do not connect to Firestore, Stripe, Lob, email, or any customer data store. They do not write order records. Do not add a database apply mode to these scripts.

Run a read-only inventory against the checked-in synthetic fixture:

```sh
node --import tsx scripts/orders/inventory-legacy-orders.ts
```

Build a resumable dry-run manifest:

```sh
node --import tsx scripts/orders/dry-run-legacy-order-migration.ts \
  --run-id local-review-2026-10-20 \
  --batch-size 2 \
  --out /tmp/docketstamp-order-migration-batch-1.json
```

Resume from the prior manifest with the same complete input fixture:

```sh
node --import tsx scripts/orders/dry-run-legacy-order-migration.ts \
  --run-id local-review-2026-10-20 \
  --batch-size 100 \
  --resume /tmp/docketstamp-order-migration-batch-1.json \
  --out /tmp/docketstamp-order-migration-complete.json
```

The manifest records total/schema/provider counts before and after the projected annotations, stable per-order migration IDs, quarantined provider conflicts, a last/next-order checkpoint, and rollback values for the two provenance fields. The only proposed changes are provider identity and raw provider reference annotations for unambiguous existing IDs. A lone `handwryttenOrderId` is classified as Handwrytten; both IDs without explicit provider provenance are quarantined. Frozen HTML, integrity digests, owner IDs, payment facts, dispatch attempts, postal evidence, and old provider fields are never changed by this planner.

The adapter remains the authoritative read path during review and any future rollback window. Historical references stay readable with their original provider classification. A Handwrytten reference must never be used for a Lob request. Historical orders without canonical v2 notice schema, adoption evidence, and a verified frozen HTML digest remain ineligible for new payment or dispatch.

Any future database migration requires a separately approved implementation and runbook after a read-only staging inventory, count reconciliation, review of quarantines, backup verification, and an explicit rollback rehearsal. The migration must not create a payment, send an email, submit a letter, reconcile by guessing, or change a frozen snapshot. No such apply capability is present here.
