# Customer continuity implementation plan

This slice wires meaningful workspace history, tab-scoped recovery, server address verification evidence, and an exact frozen-snapshot review into the existing workspace and checkout. It preserves optional auth/guest checkout, current staging and prefill behavior, registry tier pricing, signature consent boundaries, all required UPL/statutory disclosures, and all six system invariants. It does not change physical renderer geometry or postal dispatch behavior.

## Contract and implementation

- Keep workflow step state in sanitized URL/history entries (`details`, `review`, `delivery`, `payment`); never place names, addresses, draft values, capability tokens, or payment secrets in history state. Initial state uses replacement; transitions push; traversal restores the step without another push and the first step allows ordinary browser departure.
- Extend tab-scoped recovery with draft/account context and monotonically increasing draft revision. Recovered data never restores signature consent, address verification, or payment authority. Storage failures leave the in-memory draft usable.
- Verify sender and recipient mailing destinations through the server endpoint. Bind accepted evidence to a canonical exact-address digest, provider mode, and verification time. Show provider normalization and require explicit acceptance. ZIP suggestions remain unverified. Address edits and stale responses invalidate evidence.
- Carry `draftId`, `draftRevision`, a per-draft guest checkout capability, and per-lock idempotency key through lock creation. Discard stale lock replies and reconcile by superseding their server attempt when supported. Material edits disable the old payment UI and request server supersession; they never treat clearing a local secret as revocation.
- Display the exact frozen `reviewPayload` returned by the lock and require explicit confirmation before opening payment. Keep existing legal disclosures and signature affirmations intact.

## Validation evidence

Add focused pure and mounted tests for history sanitization/traversal, recovery authority reset, address digest/evidence matching and response freshness, frozen review gating, and lock revision races. Run the relevant existing checks and record results and contract gaps in `continuity-result.md`.
