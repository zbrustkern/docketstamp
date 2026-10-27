# Checkout and fulfillment independent review

## Scope

Reviewed the checkout attempt store and lock replay path, supersession route, payment authority updates, free-order authorization, postal attempt store/dispatcher, and retry-fulfillment route. No live payment, provider, email, postal, deployment, or commit action was used. Server tests ran with the isolated in-memory Firestore mode and the network-denying preload.

## Results

The deterministic regressions in `tests/robustness-server-review.test.ts` cover four cases:

- A payment authority update that arrives while supersession waits on a delayed cancellation cannot be overwritten by the stale `cancelled` result. The canonical attempt and order mirror remain paid/captured-exception, and the fulfillment gate rejects dispatch.
- A delayed lock initialization cannot regress a paid attempt or its order mirror to `locked`.
- A verified owner cannot supersede another owner's attempt using its capability, and a second owner cannot obtain an idempotent replay through the same draft capability; it receives an active-attempt result.
- A replay of an in-flight `creating` reservation with a temporarily absent order returns `CHECKOUT_ATTEMPT_BUSY` without cancelling the original creator.

The five regression tests pass with:

```sh
NODE_ENV=test USE_MOCK_FIRESTORE=true MOCK_FIRESTORE_MEMORY_ONLY=true \
  node --require ./tests/admin-console/offline-preload.cjs --import tsx \
  --test tests/robustness-server-review.test.ts
```

The related checkout and fulfillment suites also pass (10 tests total), and `npx tsc --noEmit --pretty false` passes.

The accepted-dispatch crash window is now covered by a regression: a durably accepted postal attempt can restore the consumed payment-obligation outbox and create its follow-on-effects outbox without making another provider submission. The current recovery implementation is in `reconcileAcceptedDispatchOutboxes()` and is exercised through the public attempt-store API.

## Remaining issue

The accepted-effects worker moves an expired `processing` lease to `attention_required` and does not automatically replay the follow-on bundle, which may include duplicate-sensitive email/telemetry/metadata operations. The dispatch remains accepted and cannot be resubmitted, but an explicit safe reconciliation path for the follow-on effects may still be needed. Relevant paths: `lib/admin-console/finance/authority.ts` and `lib/order-processor.ts`.

The UI continuity pass also surfaced account-transition and URL-history PII cases and reported them to the parent for integration review: `DocumentWorkspaceInner` initializes its draft identity once before a possible guest-to-account transition, and `writeWorkflowHistory()` retains all prefill query parameters when writing workflow history entries. These are outside this server review's edit scope.

## Integration follow-up

The continuity workstream subsequently fixed both account-context transitions and URL scrubbing, with scoped recovery and workflow-history regressions in the normal robustness suite. The expired follow-on-effects lease remains an explicit operator exception; automatic replay of an uncertain non-idempotent notification is intentionally not enabled. See [RESULT.md](RESULT.md) for final validation and release gates.
