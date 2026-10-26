# Verified staging and production deployment

Release: `4e24aece1233e1a520474ef1746fd3f83f916971`. Both `origin/staging` and `origin/main` point to this commit.

| Environment | Rollout | Ready runtime | Public result |
| --- | --- | --- | --- |
| [Staging](https://staging.docketstamp.com) | `rollout-2026-10-21-001` SUCCEEDED | `docketstamp-build-2026-10-21-001` | Pages, availability, aliases, agent discovery, admin protection and browser hydration passed |
| [Production](https://docketstamp.com) | `build-2026-10-21-002` SUCCEEDED | `docketstamp-build-2026-10-21-002` | Pages, availability, aliases, agent discovery, admin protection and browser hydration passed |

The source integrates Sprints 0011/0012 with the newer staging address-validation and letter-quality changes. Production's first attempt failed on admin-secret access before replacing serving traffic; the standard App Hosting grantaccess command corrected build/runtime access, and the same source was successfully retried.

## Available controls

Open Admin → **Templates & coverage** ([staging](https://staging.docketstamp.com/admin?tab=templates), [production](https://docketstamp.com/admin?tab=templates)). The panel supports individual/global pauses, review records, sources and reuse status, and residence/property-state rules. Both environments currently have their nine existing templates available under implicit revision 0. No review approvals or geographic blocks were activated. Policies are separate between environments.

## Test and paid-launch configuration

- Staging retains Stripe test keys, Lob test dispatch and `LOB_ENV=staging_mock_cass`; staging pages remain noindex.
- Production is deployed for browsing, preparation and administration. Live checkout is held because live Lob verification/dispatch keys are missing. A direct production checkout smoke request returned **503 MAILING_UNAVAILABLE**, with no order/payment identifiers, before order persistence or Stripe initialization.
- Before accepting paid production orders: configure separate live Lob verification/dispatch credentials, complete production Stripe publishable-key and webhook bindings, and run the paid-launch readiness checks. No live keys were invented or substituted with staging credentials.
- Public Firebase app identity and authorized domains match each environment. Production now binds its existing dedicated admin signing secret. Authenticated human Google login was not performed by the agent.

## Verification

Production build and full npm regression suite passed. Focused API/MCP/governance checks passed 50 tests. The local browser checks cover pause/resume, geography, stale saves, failed refreshes and mobile access. All 91 final print-layout cases passed. Read-only hosted Chrome checks passed on both environments with no uncaught browser errors. No charge, physical mailing, customer email or remote policy mutation was performed.

Evidence: `release/preflight.md`, `release/build.log`, `release/npm-test-final.log`, `release/staging-after.json`, `release/staging-smoke.json`, `release/production-after.json`, `release/production-smoke.json`, and `../2026-10-20-demand-copy/evidence/release-final/layout-results.json`.

The release was built and committed in `/private/tmp/docketstamp-release-20261020`. Shared workspace source was synchronized only where it still matched the captured source snapshot; no concurrent edits conflicted. The original workspace branch/index was preserved.
