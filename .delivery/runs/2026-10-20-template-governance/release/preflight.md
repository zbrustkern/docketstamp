# Staging and production release preflight

User authorized deployment of the completed work to both environments, with live Lob keys still pending.

The release merges the tested Sprints 0011/0012 source with origin/staging `dbe7bcd66f7af2ea9ddd8d8bccfd615b2726a347`, retaining newer mailing-address validation, postal-code suggestions, factual input schemas and canonical URL aliases. Arbitration remains a request for terms/procedure; no unsupported opt-out election or generic deposit statute/deadline is asserted. Deposit demands retain the requested balance and its factual basis.

Template governance defaults preserve the nine existing templates when no saved policy exists. New templates and missing entries in an existing policy remain held. No geographic restrictions or legal-review approvals are activated by deployment. Policies remain environment-specific.

Added a checkout readiness gate: live Stripe requires live Lob address-verification and dispatch configuration before creating an order or PaymentIntent. Staging keeps Stripe/Lob test credentials and deterministic CASS. Production currently has live Stripe but no Lob keys, so new checkout stays unavailable until mailing is configured. Bound the existing dedicated production admin session-signing secret and granted backend access; no secret value was printed or added to source.

Validation: the production `npm run build` passed (font download required network access). Full `npm test` passed, including new governance and checkout-readiness tests. Focused API/MCP/governance suite passed 50 tests. Typecheck passed. Headless Chrome verified 91 print-layout cases, including max lengths, line breaks and unbroken text. Browser checks passed for admin edits, pause controls across public pages/API/MCP/resumed drafts, state restrictions, stale revision conflicts, failed refresh behavior and desktop/mobile sizing. No provider payment, postal dispatch or customer email was executed.

Cloud build and final rollout results are recorded separately after deployment. Previous production source: `b97551226aec144d469ca18b01ebc139df66f95c`; previous staging source: `dbe7bcd66f7af2ea9ddd8d8bccfd615b2726a347`.
