# Actual Luna planning review

Reviewer: gpt-6-luna subagent /root/luna_plan_review (read-only).

Returned recommendation: split the roadmap into seven focused boundaries: P0 trust/access; canonical orders/payment; legacy order migration/evidence; account/recipients; one-time reminders; analytics plus separately owned provider/admin migration; documentation/tests/assets. Dependency order: canonical provider contracts before account/history, identity and dataset provenance before migration, explicit date/timezone/consent contracts before reminder UI. Agentic expansion beyond current supported surfaces belongs in a later tranche.

Highest-risk acceptance gaps called out: dispatch races/replayed out-of-order webhooks including free/discount; mutation after freeze/digest; genuine Handwrytten IDs across proof/retry/migration never causing Lob access; dry-run/resume/rollback with unchanged ownership/payment/snapshots; wrong issuer/audience/revocation and no hosted auth mocks; test/live Lob separation; gym/OEM guardrails; one-page/clear-zone/parity/footer checks; deadline DST/leap/past/opt-out/retry cases; real order conversion amounts and missing analytics ownership disabled visibly.

Adopted in sprint plans 0004–0010 and merge-notes.md. This is an actual local subagent critique, not a second-app review.
