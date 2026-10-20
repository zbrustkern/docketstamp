# Luna implementation handoff

Run: `2026-10-19-integrity-evidence`  
Project: `/Users/zeke/code/DocketStamp`  
Starting revision: `17ad41d4020ce1b136eb93181c4c70a822be3c31`

Implement `docs/sprints/SPRINT-0003.md` within the source/test scope it names.
Read `AGENTS.md`, the master build specification, the agentic expansion
specification, and the full sprint before editing. Preserve all six invariants.

Allowed write scope: `app/api/docket/lock-and-intent/route.ts`,
`src/components/docket/{CheckoutModal,DocumentWorkspace,GuidedFieldDrawer}.tsx`,
`lib/types.ts`, narrowly necessary utility files under `src/lib/docket/`, and
new/updated focused tests. Do not change deployment configuration, secrets,
production branches, Lob dispatch behavior, unrelated admin/email work, or
existing order data.

Return a concise report with changed files, exact commands/results, unresolved
risks, and a self-review. Do not commit, push, deploy, or alter the sprint
ledger/run-state files.
