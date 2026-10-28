# Checkout integrity implementation plan

1. Bind checkout ownership to verified Firebase identity or a scoped guest capability; ignore body-supplied account IDs. Keep policy checks and historical document integrity evidence unchanged.
2. Add server-owned attempt metadata and idempotency keyed by scope, request key, draft/revision, and canonical payload digest. Freeze exact document/quote identity before exposing payment credentials.
3. Add authorized supersession/cancellation lifecycle handling with explicit processing/unknown/capture-wins states. Block replacement checkout until the prior payment outcome is resolved; never infer refunds or transfer snapshots.
4. Expose a small fulfillment gate contract that rejects superseded or uncertain attempts while allowing existing pre-policy-update locks to remain valid.
5. Add focused mock-backed tests for identity spoofing, idempotent retries/key conflicts, stale/superseded fulfillment gates, and cancellation races; run focused tests and type checking, then record exact results and limitations.
