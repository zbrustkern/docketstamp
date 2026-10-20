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
