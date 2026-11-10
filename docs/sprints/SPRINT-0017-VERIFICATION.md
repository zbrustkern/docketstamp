# Sprint 0017 — staging verification

Scope: user-approved refined sprint implemented by three Luna lanes with coordinator integration/review. Production and Google activation remain held.

## Local evidence

- Full offline `npm test` passed (isolated in-memory Firestore; no provider requests).
- Attribution/reporting: 35 passing tests; robustness: 40 passing tests.
- New experiment tests cover navigation aliases, consent integrity, eligibility, minimal CSV payloads, refund evidence, first-capture queue creation, diagnostics sanitization, reconciliation coverage, delivery state transitions and disabled transmission.
- TypeScript and optimized Next.js build passed before staging release; final artifact checks are recorded in the local delivery run.
- `git diff --check` passes. Private operational evidence and unrelated pre-existing files are excluded from release history.

## Staging verification checklist

- Confirm deployed revision and successful rollout; verify production remains on its baseline.
- Dashboard is default; Orders & Fulfillment, System Health & Incidents, Templates & Coverage and secondary tools remain reachable.
- Pilot preset, reviewed CSV preview, explicit missing evidence and Google delivery diagnostics render without legacy analytics.
- Notice landing renders optional first-party consent; allow/refuse/withdraw persist correctly; no Google delivery is enabled.
- Staging/live payment exclusions and sensitive-route privacy controls remain intact. Exercise the consent endpoint and staged checkout freeze; retain synthetic QA classification.

## Held activation work

No real conversion was sent or uploaded. The approved destination registry is empty. CSV preparation and API delivery cannot be enabled through browser inputs. A compatible DocketStamp conversion action, credentials, consent/data-handling review, real acceptance/attribution evidence, refund adjustment delivery and manual/API handoff verification are separate activation gates. No recurring delivery job was installed. No new Google browser tag was installed or sensitive-route privacy gate relaxed.

Google contract references: [offline event destination and payload](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events), [processing status](https://developers.google.com/data-manager/api/reference/rest/v1/requestStatus/retrieve). Provider acceptance is not proof of attribution.
