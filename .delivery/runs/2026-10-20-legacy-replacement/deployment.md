# Staging authentication repair release

Source: `1226a9cff7a2419a14f37ba505e1f0756a9d2186`, pushed only to `origin/staging`.

- Local production build passed before release.
- Firebase App Hosting `docketstamp-staging` / `docketstamp` accepted the exact-source rollout. The staging branch auto-triggered build 011 and the explicit CLI request created build 012, both for this same SHA. No further rollout was triggered for replacement work.
- Auto rollout 007 succeeded; both builds reached READY, with Cloud Run latest ready revision `docketstamp-build-2026-10-20-012` and Ready condition succeeded.
- Read-only inspection through the existing Firebase CLI authenticated session confirmed the effective public runtime environment: staging project, staging hostname, verified API key, app ID, sender number, auth domain, bucket and measurement ID all match the registered staging app. No unrelated or secret values were exported.
- `/admin` returns HTTP 200. Its served layout/shared Firebase client chunks contain app `1:267056924276:web:e8c64af5d4be3d57477321` and the configuration consistency guard; they no longer contain the old `910796604705` app ID.
- Both Auth project/domain checks passed before deployment. The domain had already been authorized; the deployed key mismatch was the root cause.
- Interactive Google account login was not performed by the agent. User can refresh/re-login on staging. No payment, postal dispatch, customer email, production ref, production environment or production secret was changed.

Machine-readable selected public evidence: deployment-public-evidence.json. Future staging pushes should first observe the automatic rollout and use an explicit rollout only when needed, avoiding duplicate builds for the same revision.

## Replacement staging release — verified

Source `ed6193659384ed8395b00c5b9f397bbc041334c0` was pushed only to `origin/staging`. Automatic App Hosting build `build-2026-10-20-013` reached READY and `rollout-2026-10-20-008` SUCCEEDED at 2026-10-20 21:23:44 UTC. Cloud Run latest created/ready revision is `docketstamp-build-2026-10-20-013`, Ready CONDITION_SUCCEEDED. No duplicate explicit rollout was started.

Public checks passed at 21:24 UTC: `/admin`, `/account`, and `/favicon.ico` return 200; unsupported predecessor checkout returns 410 with `LEGACY_CHECKOUT_UNSUPPORTED` before creating an order or payment. Three served client chunks contain the registered staging web app and no old staging app ID. Chrome displays the admin sign-in screen without the screenshot's domain warning. The complete effective public Firebase runtime remains the staging configuration. Interactive Google account login was not performed.

Remote main remains `b97551226aec144d469ca18b01ebc139df66f95c`. No production changes, real payment/postage, customer email, live data migration or scheduler activation occurred. Reminders and unverified marketing remain disabled as recorded in the verification report. Exact selected evidence: replacement-deployment-public-evidence.json.
