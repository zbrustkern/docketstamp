# Plan synthesis and integration rules

Codex drafted a full replacement run. Actual gpt-6-luna review found it too broad for one sprint and recommended separate trust, canonical order, migration, recipient, reminder, analytics/admin and documentation/test packages. Adopted seven sprint boundaries (0004–0010). Preserve existing sprint 0002/0003 ledger entries unchanged despite a prior document/status discrepancy.

Independent early lanes: trust boundaries (0004), canonical order adapter/checkout design (0005; integrate after 0004), one-time reminder backend (0008). Later account UI consumes stable order/reminder contracts. Analytics and documentation follow the canonical contracts. Migration remains dry-run tooling; production apply is excluded. No forced ad-account mapping, automatic identity merge or historical evidence rewriting.

All workers use isolated local clones and requested gpt-6-luna. Coordinator alone cherry-picks/reconciles shared contracts and edits ledger/state. No cross-app Antigravity execution is claimed; an optional undispatched handoff is retained. At most three review/repair cycles per package. Deploy the auth fix separately now; no production changes.
