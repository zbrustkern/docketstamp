# DocketStamp inherited-system replacement plan

Date: 2026-10-20. Status: audit complete; Firebase repair deployed to staging at `1226a9c`; replacement execution tracked in Sprints 0004–0010.

Authority: [Master Build Specification](DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](DOCKETSTAMP_AGENTIC_EXPANSION.md). This plan supplements those specifications and the existing sprint ledgers; it does not replace their acceptance criteria.

## Audit evidence and scope

The [discovery inventory](evidence/docketstamp-legacy-inventory-2026-10-20.json) records 85 tracked text files and 523 matching lines after the Firebase source repair. Patterns cover SendMyNotes branding, Aster & Blanche, Handwrytten contracts, `smn_` browser namespaces, inherited Firebase identities, recognizable card behavior, and analytics destinations requiring ownership verification. It includes historical documentation and intentional compatibility fields: a match is a review lead, not proof a feature is reachable or wrong. No customer records, ignored local environment files, secrets, git history, or external advertising accounts were scanned. New files from this repair are outside that tracked-file snapshot.

Read-only Firebase CLI checks verified the registered web apps in both DocketStamp projects. Public Auth configuration requests confirmed that the former staging fallback key resolves to project number `910796604705` with SendMyNotes authorized domains. The real staging project is `267056924276` and already authorizes `staging.docketstamp.com`. Production's real project is `937129689950`; its source fallback also contained another project's web app identity. Both correct keys pass project-number and domain checks using `npm run verify:firebase-auth`.

The staging backend is correctly associated with its staging web app and has environment name `staging`. The full cloud environment override list remains unverified: the local gcloud CLI has no active account. SDK configuration and backend association were readable through the authenticated Firebase CLI. No cloud changes or deployment were performed.

## Completed repair, pending rollout

- Replaced staging and production Firebase web identities with complete SDK configurations obtained from Firebase, including API key, app ID, sender ID and Firebase measurement ID.
- Made checked-in App Hosting manifests explicit about the complete public identity at BUILD and RUNTIME.
- Added a shared resolver that rejects conflicting project/environment identifiers and overrides that differ from the selected registered identity. An existing Firebase singleton must match before reuse.
- Replaced the hardcoded production-domain errors with shared handling: admins see the actual hostname/origin and intended project plus the API-key mismatch recovery; customers see usable recovery instructions.
- Rebuilt `.env.example` around local staging, the three notice tiers, split Lob keys, admin sessions and optional transactional email. It no longer provisions the card-art pipeline or points developers at another Firebase project.
- Added offline regression coverage and a read-only online project/domain verifier. See [Firebase rollout runbook](FIREBASE_AUTH_RUNBOOK.md).

These repairs do not migrate users, copy orders, authorize old domains, or alter frozen document/payment/dispatch behavior. Google Ads/Meta/standalone GA4 destinations are a separate ownership decision, not interchangeable with Firebase's measurement ID.

## Replacement rules

Build the DocketStamp capability and its acceptance tests before retiring an inherited dependency. For each work package, trace callers, persisted records, API clients and UI states; define the new contract; supply a reader adapter where needed; move writers; reconcile evidence; then retire the compatibility path. Do not globally replace names or relabel old records as new evidence.

Preserve all six invariants: fitness exclusion with permitted hardware OEMs; deterministic notices and required disclosures; one-page geometry and USPS clear zones; shared interpolation; immutable freeze before payment; and separate Lob address/dispatch keys with staging isolation. No new AI legal advice or inferred legal deadlines.

## P0 — Identity, authentication and access boundaries

Evidence: `lib/firebase-admin.ts` around token verification still includes `sendmynotes-2a417` in a non-production fallback allowlist. The fallback can reconstruct claims after cryptographic verification fails, and initial Auth project selection can use an unverified token's audience. `lib/admin-auth.ts` still names its cookie `smn_admin_session`. The historical-secret blocklist intentionally includes an old predictable key.

Build:

1. Extend the verified project policy to server Admin initialization and token verification. Pin the expected issuer/audience to the deployment's configured DocketStamp project before verification; never select a trust boundary from unverified token claims.
2. Require cryptographic verification for real tokens. Replace the non-production claim reconstruction with an explicitly configured Firebase Auth emulator or isolated offline verifier injected only by tests. Keep production mock prohibitions.
3. Check whether any DocketStamp users/orders were written under legacy Auth UIDs. Produce a read-only inventory and an explicit verified-account migration mapping if needed. Do not import the old project's customer base or link accounts on email alone.
4. Version the admin cookie to a DocketStamp name. Define logout/expiry behavior for the old cookie, clear it on login/logout, and prefer a deliberate re-login over silently accepting obsolete sessions. Preserve HMAC signatures, expiry and authorized-email checks.
5. Keep known weak legacy secrets blocklisted; their names belong in security evidence, not a zero-string deletion target.

Acceptance: valid staging and production tokens work only in their own environments; wrong-audience, wrong-issuer, forged, expired and revoked tokens fail; account and admin APIs reject unauthorized requests. Offline tests cannot enable token reconstruction in hosted execution. Account/order ownership survives any approved migration. Check cloud public overrides and complete the Firebase rollout runbook first.

## P1 — Canonical notice/order/dispatch model and payment entry points

Evidence: `lib/types.ts`, `lib/order-processor.ts`, Stripe webhook and checkout confirmation routes still write or consume `handwryttenOrderId`, status and tracking aliases. `app/api/admin/order-proof/route.ts` falls back from `lobLetterId` to a legacy ID. `app/api/checkout/create-intent/route.ts` still accepts card artwork, font/message fields, reminders and a `CARD_FLAT_RATE_CENTS` checkout model. A source match does not establish which callers are active.

Build:

1. Enumerate all paid/free/admin order creation paths and trace their reachable callers. Define a versioned DocketStamp order with notice ID/version, tier, recipient and sender, frozen HTML/hash, signature/adoption, amount, payment mode, provider identity and authoritative postal evidence.
2. Route every supported purchase through the same validate → render → freeze → persist → payment boundary. Bring discounts/free orders into equivalent freeze and dispatch authorization semantics. Replace old endpoints with a compatible adapter only when the request contains a complete valid notice; otherwise return a clear unsupported/deprecated result before payment.
3. Inventory persisted schemas before changing records. Build a pure legacy reader that preserves original provider and raw reference, and a dry-run, resumable migration with checkpoints, before/after counts and rollback mappings. A Handwrytten ID must never be assumed to be a Lob ID. Classify unknown provenance as unknown.
4. Move all new writers/results to canonical Lob fields. Keep old records readable through one adapter rather than scattered `lob || handwrytten` chains. Remove duplicate aliases only after callers and records reconcile.
5. Preserve transactional dispatch idempotency, retry rules, view-token protections and immutable snapshots throughout migration.

Acceptance: paid, free, discount, duplicate-webhook, retry and concurrent-dispatch fixtures produce at most one authorized dispatch; every new order has a frozen snapshot before payment; paid notices never re-render mutable inputs. A genuine legacy reference cannot trigger a Lob lookup. Old order history remains truthful and accessible. Tests prove staging cannot incur live postage.

## P1 — Account and recipient workflows

Evidence: `app/account/page.tsx` still offers “Send Card,” greeting-card return-envelope help, birthday defaults and a card milestone/reminder editor. `components/v3/Step5Confirmation.tsx` and `app/order/[id]/page.tsx` retain legacy status handling. Saved-address and recipient-occasion structures remain in `lib/types.ts` and account APIs.

Build a recipient address book that launches a notice chooser and prefills the selected notice's recipient fields through the existing deterministic hydration contract. Include editable return addresses, CASS verification states, tier-specific tracking and evidence, and clear handling of unavailable historical proofs. Keep current identity/ownership checks and import workflows. Treat occasion metadata as optional historical data; do not convert birthdays into statutory deadlines.

Acceptance: saved recipient → select notice → review → adopt signature → pay works on desktop/mobile with no dead card-builder links; existing addresses remain intact; account history displays provider-appropriate status and authorized proof links. Incomplete recipients return to the correct required field.

## P1 — Deadline reminders with explicit scheduling semantics

Evidence: `lib/reminders.ts` stores `occasion_reminders` and defaults to birthday. `lib/reminder-utils.ts` rolls past month/day dates into next year. `app/api/reminders/route.ts`, `app/api/checkout/create-intent/route.ts` and `lib/email-alerts.ts` still use occasion/card contracts; notice-themed email copy does not make annual birthday scheduling a valid deadline model.

Build a versioned notice reminder with an explicit calendar date, timezone, one-time schedule, user-supplied label/basis, opt-in, lead time and delivery/idempotency state. Retain create/edit/delete, ownership, unsubscribe and failure recovery. Locate any actual scheduler/deployed cron before changing writers. Migrate only records with an unambiguous date and confirmed intent; preserve other records as historical or request reconfirmation. Never calculate a legal deadline from a birthday or infer one using AI.

Acceptance: past deadlines do not recur next year; timezone/DST, leap dates, rescheduling, opt-out, duplicate scheduler runs and failed email retries are tested. A reminder never signs, pays or dispatches a notice. Every new reminder deep-links to an appropriate notice review flow.

## P1 — Analytics ownership, funnel contracts and economics

Evidence: `lib/google-ads.ts` defaults to “Handwritten Card” and $9 values and hardcodes tag, Ads conversion and standalone GA4 IDs. `lib/meta-ads.ts` and `.env.example` previously shared a hardcoded pixel ID. `apphosting.yaml` still explicitly sets the inherited standalone `G-5DV25FZ7Q8` measurement ID. Ownership of advertising properties is unverified, so do not invent replacement IDs or equate them with the Firebase app IDs. `lib/telemetry.ts` uses `smn_telemetry_session`; `lib/telemetry-schema.ts` accepts old card events; `lib/metrics-rollup.ts` retains font/occasion tallies, card counters and a flat 220-cent fulfillment assumption.

Build:

1. Confirm DocketStamp ownership and intended sharing for Google tags, GA4 properties/streams, Ads conversion actions and Meta datasets. Record explicit environment destinations; stage test events separately from production reporting. Missing/unverified destinations should have an explicit disabled state after their consumers are updated.
2. Define the canonical notice funnel using the existing DocketStamp events; version event schemas and map historical card events only to a separate legacy cohort. Preserve consent, event deduplication, attribution and browser/server purchase deduplication. Payment/fulfillment authority remains server-side.
3. Use actual order amount, currency and tier; never default to a card price/category. Replace font/occasion reports with notice, tier, recipient category and fulfillment-evidence reporting without reading notice prose or personal details for analytics.
4. Use per-tier costs and actual invoice evidence when available, with explicit estimated/unknown states. The master spec's tier estimates are reference inputs, not proof of incurred spend. Integrate existing `lib/admin-console/finance` authority and reconciliation rather than creating a competing finance model.

Acceptance: test/live/legacy cohorts stay separate; emitted purchase values equal paid order values; no duplicate conversion on refresh/webhook replay; missing analytics configuration is visible to admins; First-Class/Certified/return-receipt fixtures reconcile to the appropriate fee/cost basis and unknowns remain unknown.

## P2 — Admin provider surfaces and browser namespace migration

Evidence: `components/admin/HandwryttenStatusWidget.tsx` exports a Lob component plus a legacy alias; `app/api/admin/handwrytten-balance/route.ts` and `sync-handwrytten/route.ts` re-export Lob handlers. Incidents retain `HANDWRYTTEN` labels. `lib/feature-flags.ts`, admin feature-flag help and telemetry use `smn_` names.

Build canonical Lob modules/routes, update every caller and shared contract, and preserve the current truthful unknown/no-health-probe state until a real probe exists. Deprecate route aliases with measured usage and a removal date; do not make an old provider identifier silently invoke a new provider. Route historical incidents through a versioned provider adapter. Migrate feature/telemetry namespaces with bounded dual-read/canonical-write behavior and explicit precedence; preserve event dedupe state through the transition. Do not touch the current `docketstamp_draft_v2_*` recovery format unnecessarily.

Acceptance: admin sync, proof, retry, free dispatch and incident journeys use canonical routes and authorization; legacy routes cannot misroute provider IDs; namespace migration retains intended flags and does not double-count purchases. Remove compatibility code only after tests/callers/usage establish it is unused.

## P2 — Documentation, tests and asset inventory

Evidence: `README.md`, `ARCHITECTURE.md`, `docs/CANONICAL_PROJECT_BRIEF.md`, `docs/CANONICAL_PRODUCT_SPECS.md` and the old integration audit still describe the predecessor product. Multiple tests import removed modules such as `lib/handwrytten`, `lib/nano-banana`, card presets and old builders. The current go-live ghost audit checks a small fixed list and misses configuration, namespaces and behavior.

Build a DocketStamp README and architecture guide from the canonical specs and actual supported workflows: local staging setup, full environment contract, account/admin access, deterministic notices, agent staging, snapshot/payment boundary, Lob isolation and deploy verification. Mark old product briefs/audits as historical, with clear authority pointers; retain original evidence under an archive instead of rewriting history. Review ignored Aster & Blanche paths as local provenance, not shipped features.

Replace obsolete tests with equivalent DocketStamp guarantees before retiring them: order idempotency, sender validation, pricing by tier, proof/tracking, deterministic draft recovery and security. Keep documented legacy-adapter fixtures until migration ends. Expand the audit to recursively cover active source/config with a reasoned compatibility allowlist; combine string scanning with behavior tests so renamed card workflows cannot pass as notices. Trace public assets and font references before removal; payment-card identifiers and unrelated words such as “master” are not legacy-brand matches.

Acceptance: README instructions boot an isolated DocketStamp staging environment; all current-product tests and typechecking pass; historical suites are explicitly segregated from supported tests without suppressing current-source errors. No reachable customer flow contains card-art/occasion behavior unless deliberately supported and specified. Every intentional legacy contract has an owner, reason and retirement condition.

## Delivery sequence and evidence gates

1. Roll out the completed Firebase repair to staging using its runbook; verify real authorized admin login and correct token audience. Prepare a separate production rollout using production values.
2. Complete the server trust boundary and inventory actual data/callers. Agree the canonical order/recipient/reminder contracts before running migrations.
3. Build order adapters and canonical writers; move payment entry points; verify snapshot, payment and dispatch invariants.
4. Build recipient and one-time deadline workflows against those contracts. Verify saved data, mobile/accessibility and recovery paths.
5. Replace analytics/reporting and provider admin contracts; reconcile new and historical cohorts.
6. Complete dry-run migrations in staging, review reconciliation and rollback evidence, then schedule approved production migration. Use checkpointed batches; never redispatch or recharge during migration.
7. Update documentation and test authority continuously; retire compatibility paths only when the corresponding replacement and evidence gate pass.

For each package, record before/after fixtures, commands and results, changed contracts, migration counts, unresolved unknowns and rollback instructions in its existing sprint ledger. Rollback must preserve frozen HTML, order/payment/dispatch IDs and prevent duplicate writes. Keep a migration adapter through the rollback window. The Firebase repair must roll back to a verified DocketStamp configuration, never to another project's key.

## Current validation limits

The repair's Firebase regression suite, admin/account authorization suite, payment-mode safety suite and online Auth identity/domain verification pass. Repository-wide typechecking reports 63 diagnostics, identical line-for-line to an isolated checkout of the original HEAD, with no added diagnostics. The full `npm test` command passes Firebase, transaction security and payment-mode checks, then stops at the docket renderer suite (22 passed, 1 failed). The same renderer assertion fails in the isolated original HEAD; the repair did not change that renderer or test. The separately run admin/account suite passes all 22 checks. Interactive Google login and effective cloud environment overrides must be verified after staging redeployment. None of the remaining work packages above is represented as implemented.

## Execution update — 2026-10-20

The Firebase repair has been deployed to staging at `1226a9c`; effective public environment values and served client identity were verified using the authenticated Firebase CLI session. See the current run deployment evidence. The earlier unverified-cloud-settings note above is historical audit context. Sprints 0004–0010 divide the roadmap into testable packages; requested Luna subagents implement isolated branches and the coordinator reviews/integrates them sequentially. No production deployment, customer-data migration or external reminder schedule activation is included.
