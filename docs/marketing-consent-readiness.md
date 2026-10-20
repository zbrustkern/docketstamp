# Marketing consent release boundary

Server-side Meta Conversions API delivery is intentionally disabled. The current `marketingConsent` value is supplied in the lock-and-intent request body and is only a client assertion; it is not server-verifiable evidence of an affirmative grant. Do not enable CAPI by adding an environment flag or trusting this field. The egress receipt records the disabled state and order processing leaves CAPI retry/tracking state unset.

The shipped UI currently has no supported consent preference flow that issues a durable grant. Until that flow and its server-verifiable evidence exist, CAPI must not send customer identifiers or purchase values. Meta Pixel and Google tags continue to require the explicit first-party storage grant and honor client GPC; no code should create that grant implicitly.

Sprint 0009 remains active for this item. Before enabling server CAPI, a follow-up must provide all of the following:

1. An accessible, clear opt-in/preferences UI that records a first-party grant and supports withdrawal. No prechecked consent or consent implied by checkout.
2. A server-verifiable, purpose-bound grant (for example, a signed, short-lived consent assertion issued by the preference endpoint) that cannot be forged by setting request JSON. Lock-and-intent may persist only that verified result.
3. A server-side `Sec-GPC: 1` check at every CAPI entry point; GPC always blocks delivery even when a prior grant exists.
4. Tests proving absent, malformed, expired, withdrawn, forged, and GPC grants cause zero provider requests; a valid grant allows only the approved minimized payload and event ID/value.
5. Environment-scoped Meta test-event codes for local and staging only. Production must ignore test-event code variables and explicit overrides.
6. Retry-safe tracking: record an event as sent only after the provider accepts it, and preserve an idempotent event ID across retry attempts.

The current implementation is a fail-closed release boundary, not an end-to-end consent feature. Local/staging test-event code configuration does not enable CAPI delivery.
