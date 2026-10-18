# Deployable builder-agent prompts

Copy the following into a builder session in this repository. Replace `SPRINT_ID` with one sprint, starting with `S1`. Assign subsequent sprints in dependency order with the same shared ledger. The planning is complete; these prompts request implementation.

## Single-sprint builder prompt

```text
Implement sprint SPRINT_ID of DocketStamp's homepage and purchase-experience redesign.

Read before planning or coding:
1. AGENTS.md
2. docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md
3. docs/DOCKETSTAMP_AGENTIC_EXPANSION.md
4. docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md (v2, replacing the old homepage spec)
5. docs/DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md

Inspect current source, git status, and ledger evidence. Preserve all existing
uncommitted work, including concurrent account/admin/auth/checkout changes and
HeaderUserNav. Do not reset, overwrite, or stage unrelated files. Older Send My
Notes documents are not DocketStamp product authority.

Implement only the assigned sprint and necessary scoped integration fixes. Verify
its prerequisites from source and evidence. If a prerequisite is genuinely absent,
report the concrete dependency rather than inventing a parallel implementation.
Resolve routine reversible decisions yourself using the design spec. If a sprint
is too large, split it into named sub-sprints in the ledger with preserved gates.

The goal is one broad, clear homepage chooser and one continuous preparation and
purchase flow. Keep the actual shared-renderer document preview. Remove duplicated
selection surfaces and personal-data entry from home. Existing campaign/company/
agent links enter the same /notices/[slug] workspace with supported context intact.
Use plain customer language, without internal implementation descriptions.

Preserve all six invariants: hard NAICS 713940 exclusion with hardware OEM use cases
allowed; exact UPL/statutory disclosures; one-page 8.5x11 geometry and Lob clear
zones; shared interpolateNotice render parity; immutable freeze-before-pay snapshot;
isolated verification/dispatch keys and staging_mock_cass. Do not rewrite statutory
prose, prices, or external API contracts to simplify UI work. No AI legal advice or
guaranteed legal/business outcomes.

URL prefills must never falsely assert AI origin. Verification/signature/payment/
mailing status must reflect actual current state. Examples cannot overwrite or
enter real drafts. Preserve stage/field/recipient/tier/focus hydration and REST/MCP/
WebMCP consumers. Never weaken server validation, payment amounts, ownership/token
checks, snapshot integrity, or fulfillment idempotency. Preserve guest checkout.

Use current components, registries, validation, commerce, and telemetry where
possible. Suggested file lists are starting points, not wholesale replacement
instructions. Keep presentation titles separate from formal document titles.
Avoid duplicated business logic or a second form/payment/analytics architecture.

Validate the assigned acceptance criteria with meaningful focused tests and browser
inspection. Inspect current package scripts before using the sprint's commands.
Save screenshots for visual changes; test relevant desktop/mobile and keyboard
behavior. Use mocks or configured test/staging services for payment/fulfillment.
Do not deploy, make live purchases, mail letters, or claim unexecuted checks passed.

If an integration cannot be exercised, complete independent authorized work, record
the precise limitation, and leave that acceptance gate incomplete. Never fabricate
evidence or conversion uplift. Do not create a commit or PR unless separately asked.

Update docs/DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md with status, changed files, exact
check results, evidence paths, limitations, and next handoff. Mark complete only
when every assigned criterion is satisfied.

Finish with: changes made; completed sprint; tests and visual evidence; remaining
acceptance gaps/risks; exact next sprint to assign.
```

## Optional coordinator prompt

Use this when you want an orchestrator to dispatch builders and reviewers across the entire plan. It authorizes delegation for implementation, not production launch.

```text
Coordinate implementation of docs/DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md using builder
agents. Read AGENTS.md, both canonical DocketStamp product specs, the v2 homepage
design spec, and the sprint plan first. Preserve all existing uncommitted work.
You may delegate scoped implementation and independent review.

Assign one sprint at a time in order S1 through S7 using the single-sprint prompt
in docs/DOCKETSTAMP_HOME_BUILDER_PROMPT.md, replacing SPRINT_ID explicitly. Include
current checkout/branch, prerequisite evidence, file ownership, acceptance criteria,
and checks in each assignment. Use isolated workspaces if useful, explicitly
accounting for uncommitted prerequisites; a new worktree will not include them by
default. Avoid concurrent edits to shared files and the ledger. The coordinator
owns integration and ledger reconciliation.

Have an independent reviewer inspect each completed sprint against its acceptance
criteria and six invariants before starting dependent work. Fix material findings
before advancing. A builder completion claim is not evidence of correct behavior.
Keep review scope proportional to the sprint.

Continue through all seven sprints with concrete evidence and meaningful progress
updates. Do not deploy, make live payments, dispatch mail, overwrite unrelated work,
or claim unmeasured conversion gains. Report integration gaps honestly. Finish
with a release-candidate summary linked to the ledger and evidence report.
```
