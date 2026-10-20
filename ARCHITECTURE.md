# DocketStamp application architecture

Authority: [AGENTS.md](AGENTS.md), [Master Build Specification](docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md), and [Agentic Expansion Specification](docs/DOCKETSTAMP_AGENTIC_EXPANSION.md). This describes the repository's operational boundaries; individual replacement work packages and unresolved compatibility are tracked in the [sprint ledger](docs/sprints/ledger.json). The [original predecessor architecture](docs/archive/sendmynotes/ARCHITECTURE.original.md) is retained as historical evidence.

## Application and trust boundaries

The Next.js App Router application uses React client components for interactive preparation and server routes for authenticated data, staging, payment and fulfillment. Public Firebase web identifiers are configuration, not access authorization. `lib/firebase-config.ts` pins registered staging/production app identities; `lib/firebase-client.ts` initializes and validates reuse of the browser app. `lib/firebase-admin.ts` owns server Firestore/Auth access. Customer APIs must authorize the verified identity against the record owner; admin APIs additionally enforce `lib/admin-auth.ts`.

Staging is `staging.docketstamp.com` and Firebase project `docketstamp-staging`. Production is `docketstamp.com` and project `docketstamp`. Their app IDs, sender/project numbers, storage buckets, keys and public configuration must remain consistent. A staging hostname alone is not permission to substitute a production key, and an unverified token audience must never choose the server's trust boundary.

## Deterministic document pipeline

| Boundary | Implementation | Required behavior |
| --- | --- | --- |
| Notice definition | `src/lib/docket/notices/` | Locked prose, bounded field schemas, deterministic tokens. |
| Recipient/statute data | `src/lib/docket/data/` | Explicit dataset/provenance; no AI-inferred legal decisions. |
| Entity guardrail | `src/lib/docket/guardrails.ts` | Block gyms/fitness memberships under NAICS 713940, allow hardware OEMs. |
| Interactive preparation | `src/components/docket/DocumentWorkspace.tsx` | Guided fields, review, signature adoption and invalidation after material edits. |
| Shared interpolation | `src/lib/docket/renderer/interpolate.ts` | Same interpolation for screen and server letter content. |
| Physical HTML shell | `src/lib/docket/renderer/lob-html-shell.ts` | One 8.5 × 11 inch page with fixed USPS address/banner clear zones and footer. |
| Lock/payment boundary | `app/api/docket/lock-and-intent/route.ts` | Validate, render once, persist frozen HTML/integrity/adoption facts, then create payment. |
| Fulfillment | `lib/order-processor.ts`, `src/lib/fulfillment/lob.ts` | Authorize payment/free dispatch, dedupe attempts and send stored HTML without re-interpolating. |

The top reserved USPS band is 0–1.80 inches. The clerk stamp sits at top 1.85 inches/right 0.60 inches/width 3.15 inches. The prose begins at top 3.35 inches with 0.75-inch horizontal margins. All required disclosures remain present. A hash of the stored HTML is a narrow integrity record; it is not a determination of legal validity or external proof of delivery.

## Payment, snapshots and provider evidence

An order's frozen document and adoption/integrity fields are immutable after lock. Stripe intents, webhooks, free/discount authorization and admin dispatch must converge on equivalent validated snapshot requirements. Client flags cannot authorize payment success or bypass live configuration. The backend's payment/provider ledgers and idempotency controls distinguish confirmed, failed, duplicate and uncertain events.

`lib/admin-console/finance/` stores/reconciles payment authority; `lib/admin-console/postal/` handles dispatch attempts, explicit free authorization and postal evidence. Existing consumers must preserve these boundaries rather than introduce a parallel payment truth source. Actual fees/provider facts and configured cost estimates have different provenance; unknown cost or postal state stays unknown.

Lob letter IDs, tracking, mailed/delivery events and return-receipt evidence represent postal facts. Historical provider references require explicit provenance. A legacy vendor ID must not be relabeled as a Lob letter ID merely because a UI or route has been renamed. The canonical-order migration sprint centralizes read adapters, new writers and dry-run record classification while preserving raw historical fields.

## Staging isolation and external systems

`LOB_ADDRESS_VERIFICATION_KEY` verifies addresses; `LOB_DISPATCH_API_KEY` sends mail. Staging's deterministic CASS mode and test dispatch key prevent live postage. Stripe test/live modes are independently validated. Mock Firestore/Auth must be explicit and unavailable in hosted production execution.

Transactional email uses server-only Resend configuration and verified DocketStamp sender identities. An email can report a dispatch only after the authoritative dispatch result. Reminder emails require explicit user consent, a user-defined date and timezone, and idempotent delivery; historical annual occasions cannot establish statutory deadlines. New reminder contracts/scheduler enablement are separately tracked in Sprint 0008; no deployed recurring schedule is inferred from a route existing.

Google/Meta tags and CAPI carry separate destination ownership, consent and deduplication requirements. Conversion amounts/currency must derive from paid orders. Staging/test/legacy traffic must not become production notice revenue. Admin reporting distinguishes configured, disabled, missing, uncertain and verified states.

## Accounts, recipient hydration and agent surfaces

The account/address APIs preserve verified ownership, saved-recipient editing/import and default sender addresses. Recipient-to-notice actions use the notice chooser and existing prefill/staged-draft hydration contract. Historical orders/proofs remain accessible only through authorized views and provider-appropriate links. Account/reminder replacement status is explicit in Sprints 0007 and 0008.

External agents may stage a draft without an account/API key through supported prefills, REST, MCP and discovery manifests. Every staged field is validated against deterministic notice schemas and fitness guardrails. Opaque review links and draft expiry protect staged content. Agents never adopt signatures, pay or dispatch on behalf of the human through these staging endpoints. The human completes missing fields and reviews the actual notice before checkout.

## Durable replacement and release process

The replacement run uses isolated local Luna checkouts and sequential coordinator integration, with one coordinator owning sprint ledger/checkpoints. Shared types/contracts land before dependent UI/reporting. Replacement means building and validating the new workflow, then moving writers/readers and retiring bounded compatibility; it is not global string substitution.

Historical user/provider data is inventoried before any migration. Dry-run plans must preserve ownership, payment IDs, snapshots, digests and provider evidence; resume and rollback must reconcile counts without dispatching, charging or sending email. Actual production apply and cross-project user linkage require separately reviewed evidence.

For staging release, commit the exact verified source, push only the staging branch, build/roll out in `docketstamp-staging`, inspect effective public environment values, and confirm the served client identity. The Firebase Auth runbook records the commands and interactive verification limitations. Production branch, secrets and deployment remain separate.
