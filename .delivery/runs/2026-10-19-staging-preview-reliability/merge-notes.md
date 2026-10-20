# Merge notes

This is a local Codex plan. No independent alternate-app critique has been performed because no alternate-app connector is configured in this session. The saved handoff file is the exact request for that review before implementation.

Material tradeoffs:

- The plan separates the immediate staging configuration repair from application-code resilience; enabling Firestore in production is explicitly out of scope.
- Shared interpolation guarantees document content parity, not pixel parity. The plan therefore adds an actual frozen-payload print proof rather than claiming the screen preview is identical to Lob output.
- Customer-facing messages are deliberately generic and recoverable; the admin surface retains classified diagnostic evidence by correlation ID.
