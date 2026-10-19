# Requirements-to-sprint coverage

All requirements initially **planned / not verified**. IDs are stable; progress.json task rows carry implementation evidence. Cross-sprint references mean both relevant gates must pass, not that one sprint can assume the other did the work.

| ID | Requirement | Tasks / sprint ownership | Required acceptance evidence |
| --- | --- | --- | --- |
| R01 | Business-specific architecture, six invariants, capability preservation | S0-T03; S1-T03; S3-T01/T02; S5-T01; S7-T03; S8-T01 | Paid/free/comp/retry invariant matrix; nine notices/three tiers; old-to-new capability walkthrough. |
| R02 | Honest independent customer/money reporting; no inferred completed milestones | S0-T01/T04; S2-T01/T02; S6-T01 | Empty/unknown fixtures, modern postal status invariance, independent paid/customer-class oracle. |
| R03 | Outstanding customer postal obligations and prioritization | S0-T03; S3-T01/T02/T03; S6-T01; S7-T01/T02 | Paid-undispatched, uncertain, returned, proof/email failure and all-open scope fixtures. |
| R04 | Shared precise event/metric/identity/time/denominator definitions | S1-T01/T02; S2-T01; S4-T01/T03; S6-T01 | Versioned schema/oracle, repeated session/order and cohort maturation/DST tests. |
| R05 | Authority, observed/inferred/estimated/unavailable and confidence dimensions | S1-T01/T04; S4-T03; S6-T01/T02; S7-T01 | Metric evidence envelope, explicit missing/unknowns and projection watermark screenshots. |
| R06 | Existing infrastructure; durable ingestion, authority and diagnostics | S2-T01/T03/T04; S3-T03; S4-T03; S6-T03 | Multi-instance dedupe/crash/outbox, bounded indexed queries; vendor justification if architecture changes. |
| R07 | Compact global scope, KPIs, journey, acquisition, exceptions | S6-T01/T02; S7-T01 | Desktop overview screenshot, no decorative preamble, exact drilldown scope and partial-day comparisons. |
| R08 | Investigation from every metric and correlated operational evidence | S4-T03; S6-T02; S7-T02 | KPI→evidence <=2 interactions; order timeline/request correlation; all records paginated, >50 scope. |
| R09 | Loading/empty/error/stale/partial and measured health | S4-T03; S6-T01; S7-T01/T04 | State fixtures; no incident ≠ healthy; no activity distinguished from no observation. |
| R10 | Responsive/accessibility and measurable usability | S7-T04; S8-T03 | Four widths, zoom, keyboard/focus, computed contrast, timed tasks with n/limitations. |
| R11 | Preserve codes/comps/free/recovery; campaign offers and correct previews | S5-T01/T02/T04; S7-T03 | Fixed/percent/100% across all tiers, validated links/eligibility and compatible old codes. |
| R12 | Navigation/resume continuity; atomic eligibility/limits/budgets/redemption | S5-T02/T03 | Full active notice journey, quota races, TTL/late capture, zero totals/processor minimum, refund restore. |
| R13 | Original acquisition plus promotion touches; exposure reporting; no causal lift claim | S4-T02/T04; S5-T04; S6-T04; S7-T03 | Touch history, source/mode/privacy and spend coverage; experiment decision record; no unsupported winner. |
| R14 | Consequential control effects, authorization and audit | S0-T02/T03; S3-T04; S5-T01/T03; S7-T02/T03 | Role/CSRF/object/env negative checks, stale version and actor/effect/result audit fixtures. |
| R15 | Durable financial truth/reconciliation, no browser authority or analytics-dependent outcome | S1-T03; S2-T01/T02/T03/T04; S3-T01; S5-T03 | Duplicate/mismatched PI, missing webhook/telemetry, successful refund/dispute/fee evidence; no side effects in replay. |
| R16 | Application controls plus decision/evaluation workflow | S3-T04; S7-T03 | Allowlisted real flag consumers, effective scope, diff/audit/rollback; decision hypothesis/evaluation log. |
| R17 | Additive migration, compatibility, historical uncertainty | S1-T04; S2-T03; S5-T01; S6-T03; S8-T01 | Old records/deep links/readers preserved, explicit inferred legacy, no invented backfill milestones. |
| R18 | Shadow reporting, safe replay, diagnostics and privacy | S2-T03; S3-T03; S4-T03/T04; S6-T03; S8-T03 | Deterministic replay hash, explainable deltas, redaction canaries and egress side-effect denial. |
| R19 | Evidence/provenance and release-safe verification | S7-T04; S8-T02/T03/T04 | Environment/commit evidence manifest, local/staging/production gaps explicit; no production certification without evidence. |
| R20 | Executable bounded delivery and machine ledger | S8-T04; orchestrator all sprints | DAG/ownership/task status consistency, coverage, exact results and final review/runbooks. |

Review findings coverage: F01→R02/R04; F02→R03/R15; F03→R07/R13; F04→R02/R05/R13; F05→R14; F06→R03/R14/R18; F07→R01/R03/R14/R15; F08→R13; F09→R11/R12; F10→R04; F11→R06/R18; F12→R04/R05; F13→R09; F14→R18/R19; F15→R06/R08/R18.

CEO questions coverage: outcomes→R03/R15; friction→R04/R08; acquisition/offers→R11–R13; money/obligations→R03/R15; intervention→R07/R14; next change/evaluation→R13/R16; trust→R05/R09/R18/R19.
