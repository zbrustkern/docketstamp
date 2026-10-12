# Conversion redesign recovery audit

**Checked October 12, 2026. Read-only inspection of implementation; no branches merged, no code changed, no deployment.**

## Saved work

| Branch | Tip | Commits ahead of main | What is preserved |
| --- | --- | --- | --- |
| cr/S0-04 | dbb7211 | 2 | Server payment-mode handling, checkout failure safety, test-payment isolation, personal sender validation; two new test programs. |
| cr/S0-02 | 006b770 | 1 | Browser authority-event rejection, telemetry schema allowlist, unique-session stage counters, server telemetry helper; ingestion tests. |
| cr/S0-05 | bf7d17e | 1 | Shared product facts, revised delivery estimates, partial claims cleanup, claims inventory; delivery tests. |
| cr/S1-proto | ed39abb | 1 | Session draft model, compact flow header/progress/action bar, card grid/preview and `/preview/entry`; draft tests. |

Five commits affect 55 distinct files. The four implementation worktrees have no
uncommitted changes. Their branches remain reachable locally. The original
`subagent-Lane-*` branch names still point to the original main commit; recover
from the `cr/*` branches, not those older names.

Local main and a fresh remote `git ls-remote` check both show
`4351309e779a9295e3cd4771987b392dfa5b93c5`. None of the five implementation commits is
on main. GitHub advertises no `cr/*` branch refs. Implementation is saved locally,
not pushed to those remote branches. Canonical/planning documentation in the main
working directory is still uncommitted and must be preserved during integration.

## Checks rerun

Exported each committed branch to a separate temporary directory, used existing
installed dependencies, removed service/payment credentials from the test
process environment, and ran in test mode. Existing worktrees were untouched.

- Checkout safety: 22 assertions passed.
- Sender validation: 17 assertions passed.
- Telemetry ingestion: 35 assertions passed.
- Draft model/storage: 66 assertions passed.
- Delivery/product facts test program: passed.
- TypeScript check (`--noEmit --incremental false`): passed on each of four branches.

These are targeted isolated checks, not integrated regression, browser usability,
real Apple Pay, or physical fulfillment verification. No live order was placed.
The new tests are not yet added to package.json scripts, so existing `test:*`
commands alone do not cover them.

## Completion assessment

Meaningful early implementation is preserved. It is not an end-to-end redesigned
purchase flow. The entrance prototype explicitly substitutes a placeholder for
the note step, disables its next action, and says custom artwork generation is
coming later. It is not connected to the production homepage/ad landing flow.

Remaining material work:

1. Integrate the four branches and run the combined regression/build checks.
2. Wire server-verified purchase telemetry into real payment/confirmation paths,
   reconcile orders/sessions, and exclude founder/test/comp orders from customer
   reporting. A helper existing is not proof of caller integration.
3. Tighten completion semantics: the new rollup still treats `inside_note_edited`
   as note completion. Review the capped stage-session ID lists before relying on
   long-running deduplication.
4. Finish truthful copy in the checkout/builder/preview files deferred by the
   claims inventory, and implement actual A2 artwork/preview alignment.
5. Connect the entrance shell/draft model to one routed candidate flow and custom
   generation, then implement the editor-first note and simplified address steps.
6. Add actual Express Checkout wallet integration, synchronized checkout revisions,
   guest receipt-token continuity, and real-device tests.
7. Finish sanitized product proof, retention, accessibility, rollout/rollback and
   gate evidence. No completed gate reports were found in these branch trees.

The changed-file sets of the four branches are currently disjoint, which makes
integration comparatively straightforward. This does not establish semantic
compatibility or a passed integrated build.

## Deployment evidence

Remote main does not include the redesign commits. A hosting revision check could
not run: gcloud has no active authenticated account. Therefore deployment state
is not independently certified. There is no evidence from the inspected branches
of a merged candidate or completed release gate. Do not equate unchanged main
with proof that no manual deployment occurred.

## Recommended continuation

Preserve the existing main documentation changes; create a dedicated integration
checkout, bring in the five saved commits, wire the incomplete contracts, and run
integrated checks. Then finish the complete candidate journey before production
allocation. Avoid restarting these lanes or treating the card-selection prototype
as the finished redesign.
