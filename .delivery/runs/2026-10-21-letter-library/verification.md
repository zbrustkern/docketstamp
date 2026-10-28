# SPRINT-0013 verification

**Outcome:** Complete in the local working tree. All eight acceptance criteria met. No deployment, live policy update, payment, or postal dispatch performed.

## Implementation review

The coordinator inspected the actual source changes and homepage/sitemap diff. The new library intersects the canonical chooser entries with current public availability. Cancellation starting points derive from the existing select options and encode exactly one field. Loading and errors suppress start links. Missing or denied cancellation availability removes the general cancellation card and all six shortcuts. Location checks remain in the existing workspace.

The page distinguishes nine underlying letters from six cancellation starting points. Existing chooser titles and descriptions are reused; both mandatory disclosures are present. The homepage gains a prominent mobile/desktop link beside the existing directory link and a footer link, while retaining one chooser and its legacy anchors. The sitemap includes `/letters`.

Review adjustments: Luna made the cancellation section wording customer-facing, added the prominent homepage entry, and kept the numbered workflow instructions inside their grid cells. No new statutory procedure or company-specific notice was deemed cleared for launch by this sprint.

## Checks and evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Coordinator targeted suite | 54 tests passed | [focused-tests.log](focused-tests.log) |
| Coordinator template-governance regression | 26 tests passed | [template-governance.log](template-governance.log) |
| Coordinator TypeScript | `npx tsc --noEmit` exited 0 | [typescript.log](typescript.log) |
| Luna final spacing recheck | 28 focused tests, TypeScript, and diff check passed | [Implementation report](luna-implementation-report.md) |
| Coordinator browser behavior | 17 scenarios passed; no page errors or unexpected write attempts | [results.json](evidence/ui/results.json), [browser.log](browser.log) |
| Coordinator final layout/navigation | 3 viewport scenarios passed after spacing adjustment; one loaded homepage chooser at each size | [layout-results.json](evidence/ui/layout-results.json), [layout-browser.log](layout-browser.log) |
| Source, prior work, ledger, and local links | 18 protected file hashes unchanged; 163 baseline paths checked; 12 prior ledger entries unchanged; no missing local documentation links; `git diff --check` passed | [integrity.json](evidence/integrity.json), [verification script](verify-integrity.py) |

The browser run used mocked availability on `127.0.0.1:3115`, blocked external requests and all writes, and recorded blocked local telemetry separately. It made no payment or dispatch attempt. Desktop was 1440×1000; mobile was 390×844; narrow mobile was 320×740. The browser evidence covers all six matching prefilled values and subsequent user edits, loading, HTTP failure, malformed payload, retry, missing entry, paused/held cancellation, all-unavailable state, and residence gating (TX denied, CA permitted with the preset retained). Keyboard Tab focus and horizontal overflow were checked at each viewport.

The first cold development-page load produced a transient client syntax error. It did not recur on subsequent fresh browser contexts with the same application source. The browser harness was corrected to distinguish the page alert from Next's route announcer and to record deliberately blocked telemetry separately from unexpected writes. The complete passing run and final layout run had no page errors. Earlier `failure.png`/`failure.txt` artifacts are diagnostic remnants, not final-state screenshots.

## Acceptance mapping

| Criterion | Evidence and result |
| --- | --- |
| AC1 | Library renders canonical available letters, both disclosures, and navigation at all three widths. [Desktop](evidence/ui/desktop.png), [mobile](evidence/ui/mobile.png). |
| AC2 | All six category URLs hydrate the exact existing enum value; each value can be edited. Focused tests and six browser scenarios passed. |
| AC3 | URL tests assert the single `field.serviceTypeLabel` parameter, unknown-value rejection, and unchanged recipient/tier defaults. |
| AC4 | Browser loading/error/malformed/paused/held/missing/all-unavailable cases expose no inappropriate start links; retries recover. [Paused](evidence/ui/paused.png), [error](evidence/ui/error.png). |
| AC5 | The preset reaches the existing location gate; disallowed state remains gated and allowed state opens the workspace with the preset. [Location gate](evidence/ui/location-gate-mobile.png). Existing policy regression passed. |
| AC6 | Home access, keyboard focus, one loaded chooser, retained directory link/anchor, and no horizontal overflow passed at all widths. [Mobile home](evidence/ui/home-mobile.png). Existing homepage/routing regression passed. |
| AC7 | Protected hashes unchanged. Source review and screenshots show nine letters plus a separate starting-point group. |
| AC8 | Targeted tests, policy regression, TypeScript, browser, diff, and integrity checks passed. Fulfillment and live deployment were not exercised. |

## Limits

These checks establish the scoped local implementation behavior. They do not establish production availability, company acceptance, demand, or legal clearance for any researched opportunity. Live availability remains determined by the existing policy controls. Source hashes in the integrity record identify the implementation verified here; later changes require appropriate rechecking.
