# DocketStamp

DocketStamp is an automated self-help document preparation and USPS postal dispatch utility. Customers select a deterministic notice, enter their details, review the letter, adopt their typed signature, and choose a mailing tier. DocketStamp is not a law firm and does not provide legal representation or advice.

The [Master Build Specification](docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md), [Agentic Expansion Specification](docs/DOCKETSTAMP_AGENTIC_EXPANSION.md), and [AGENTS.md](AGENTS.md) govern this repository. See [ARCHITECTURE.md](ARCHITECTURE.md) for the actual application boundaries. Historical card-product documents are [archived separately](docs/archive/sendmynotes/README.md); their setup and product claims are not current instructions.

## Local staging setup

1. Use the project's Node.js runtime and install the lockfile dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`. Keep local secrets out of version control.
3. For live local Firestore, authenticate Application Default Credentials for `docketstamp-staging`, or supply an explicitly configured staging service account. The Firebase CLI's login and application credentials are separate contexts.
4. For offline development only, enable `USE_MOCK_FIRESTORE=true`. Never enable a mock store or mock Auth in hosted/production execution.
5. Configure Stripe test credentials and the staging Lob settings from the example, then run `npm run dev` and open `http://localhost:3000`.

The checked-in complete public Firebase web app identities live in `lib/firebase-config.ts`. Staging uses project `docketstamp-staging`; production uses `docketstamp`. Overrides must match the selected registered app, and conflicting environments fail closed. The [Firebase Auth runbook](docs/FIREBASE_AUTH_RUNBOOK.md) explains verification and deployment. `.env.local` uses staging explicitly; do not copy another application's credentials into it.

## Notice preparation and dispatch

The notice registry is `src/lib/docket/notices/`; verified recipients and state-reference data are in `src/lib/docket/data/`. Notice text uses locked prose and deterministic tokens. It must never become an open-ended AI legal-advice flow.

`DocumentWorkspace` provides guided required fields, preview/review and signature adoption. `/api/docket/lock-and-intent` validates adoption, renders the final physical HTML, stores an immutable snapshot plus integrity evidence, and only then starts payment. Payment confirmation dispatches that frozen snapshot through Lob. Changes to mutable form inputs must never change a paid letter.

The three configured retail tiers are:

| Tier | Price | Service |
| --- | --- | --- |
| `first_class` | $12.95 | USPS First-Class |
| `certified` | $19.95 | USPS Certified Mail |
| `certified_return_receipt` | $27.95 | USPS Certified Mail with return receipt |

Provision Stripe products/prices with `npm run stripe:bootstrap` in the intended test/live account and record the returned IDs in that environment. Test mode belongs in staging; production payment/postal credentials are configured independently.

Lob keys have separate purposes: `LOB_ADDRESS_VERIFICATION_KEY` for address verification and `LOB_DISPATCH_API_KEY` for sending letters. Staging uses `LOB_ENV=staging_mock_cass` and a test dispatch key, so verification is deterministic and staging cannot incur live postage. Do not reuse a live dispatch key to make staging address validation work.

## Accounts, administration and integrations

Customer APIs require verified Firebase identity and enforce account/order ownership. Admin login additionally requires an authorized account and a signed expiring session; server-only session/email secrets must never use a `NEXT_PUBLIC_` prefix. Outgoing admin email and paid/free dispatch have their own validation/authorization boundaries.

Agents can prepare a draft through supported URL prefills, staged-draft REST/MCP entry points, and discovery manifests. Staging a draft never signs, pays, or dispatches it; the human reviews and adopts the signature. Preserve draft expiry, opaque access links, validation and the fitness exclusion at every entry point.

Analytics account ownership and environment destinations must be verified independently of Firebase app identity. Do not reuse predecessor destination IDs or treat a Firebase measurement ID as authorization to configure Google Ads/Meta. Reminder/account/provider migrations are tracked explicitly in the sprint ledger; planned replacement contracts are not evidence that cloud data or external schedules have been migrated.

## Verification

- `npm run test:firebase` — offline project-selection, identity consistency, singleton and notice checks.
- `npm run verify:firebase-auth` — read-only live verification of the project behind each public key and its authorized website domain.
- `npm run test:security`, `npm run test:payment-mode`, `npm run test:admin-auth` — transaction, test/live isolation and account/admin boundaries.
- `npm run test` — default supported suite; record failures rather than suppressing them.
- `npm run build` — production build.
- `npx tsc --noEmit` — repository typecheck, including tests.

At the start of the replacement run, the production build passed; typechecking had 63 inherited diagnostics and the docket suite had one stale CASS assertion. Current replacement sprint evidence records subsequent changes and results. Do not assume a historical validation claim is a current green check.

## Deployment and replacement work

Firebase App Hosting has separate staging and production projects. `apphosting.staging.yaml` supplies the staging environment, complete public Firebase identity, test Stripe bindings, split Lob settings and server-only secrets. Console-level overrides must be inspected because they can supersede the manifest. Public Next.js values require a rebuild.

The [replacement roadmap](docs/DOCKETSTAMP_LEGACY_REPLACEMENT_PLAN.md), [sprint ledger](docs/sprints/ledger.json), and [current run](.delivery/runs/2026-10-20-legacy-replacement/INDEX.md) track implementation, compatibility and validation. Replacement work preserves historical records and builds equivalent DocketStamp workflows before retiring old contracts. Production migration, live dispatch, real customer mail and schedule activation are separate explicit operations.
