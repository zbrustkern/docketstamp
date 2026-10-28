# SPRINT-0011 verification and completion

**Result:** Implemented and verified locally. No commit, deployment, live payment, postal dispatch, or state/product exclusion. Completion covers this sprint's copy and targeted research scope; launch eligibility remains unresolved as documented below.

## Implemented outcome

All nine chooser titles now describe the customer's action. Deposit uses “Demand your security deposit back,” canonical title “Security Deposit Demand Letter,” and printed heading “FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT.” Hero, duplicated hardware-purpose labels, template headings/bodies/helpers, SEO and agent catalog copy are aligned. Letters make concrete first-person demands without inventing violations, attachments, statutory timing, universal rights or outcomes.

Recognized debt/privacy enum values retain their API values and resolve to qualified deterministic wording through shared interpolation. Missing choices remain required placeholders; unknown values are not silently converted. Discovery publishes both labels and exact machine values. Generic deposit deadline claims were removed while state references remain; the dataset itself is not legally audited.

Actual baseline rendering exposed multiline and unbroken-input overflow. Short-textarea whitespace is normalized in shared interpolation and long text wraps in print/preview. Source inputs, paid frozen snapshots, page dimensions, type sizes, clear-zone coordinates and the UPL footer remain unchanged. Final browser review also removed a duplicated metadata brand suffix.

## Checks and evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Focused chooser/home/cartridge/engine/new-copy/details/payment/release/snapshot suites | 175 tests passed, 0 failed | [Test log](evidence/focused-tests.log) |
| TypeScript | Exit 0, no diagnostics after final code edits | [Typecheck log](evidence/typecheck.log) |
| Chromium print bounds | 90/90 passed | [Measurements](evidence/revised/layout-results.json), [harness](check-layout.mjs) |
| Desktop/mobile UI | 1280×720 and 390×844: no document horizontal overflow; Continue visible; chooser-to-workspace navigation; demand heading visible including mobile preview; single brand suffix | [Results](evidence/ui/ui-results.json), [harness](check-ui.mjs) |
| Independent implementation review | Two findings corrected: nine relative authority links and privacy consent qualification | [Review](implementation-review.md) |
| Unrelated working changes | All 12 recorded fingerprints match | [Baseline fingerprints](preintegration-unrelated-hashes.json), [comparison](evidence/unrelated-files.json) |
| Whitespace diff check | Passed | `git diff --check` |

Print matrix: nine notices × three tiers with maximum supported text lengths (27); all 51 deposit state-reference selections (51); three newline-heavy bounded-textarea cases (3); nine maximum-length unbroken strings (9). Checks compare preview AST and physical raw paragraphs, rendered text bounds against the body rectangle, signature/footer separation and stamp placement. Representative deposit and privacy print screenshots and both desktop/mobile UI screenshots were visually inspected. The HTML was rendered locally, not submitted to Lob. This is browser geometry evidence, not postal-provider certification.

The corrected baseline passed 78/90 cases: three multiline vertical overflows and nine unbroken-string horizontal overflows. These are the demonstrated reason for the narrow rendering correction. An earlier baseline harness had a subpixel tolerance and missing-recipient fixture error; it was excluded from valid evidence. The first UI attempt timed out before client selection took effect; the diagnostic rerun waited for selected state and passed. No product bypass was used.

## Acceptance mapping

- AC1–AC3: chooser and rendering tests plus manual diff review verify stronger labels, stable contracts, conditional claims and missing-choice behavior.
- AC4: same interpolation feeds both renderers; exact footer and frozen-snapshot regressions pass; the actual 90-case print matrix passes without physical geometry changes.
- AC5: 175 tests, typecheck and desktop/mobile browser checks pass.
- AC6: [State memo](../../../docs/legal/STATE_LAUNCH_REVIEW_2026-10-20.md) covers seven states plus federal credit-services questions, discloses source limitations and the 43 unreviewed states plus DC, and records recommended future enforcement. No exclusion implemented.
- AC7: three governing specs have dated authority addenda; coordinator updated plan/ledger/provenance and verified unrelated file fingerprints.

## Delegation and limits

The bounded implementation used gpt-6-luna high; planning and independent review used gpt-6-luna medium. Legal issue spotting used gpt-6.1-sol high, with coordinator source checks and synthesis. Worker reported 132 tests before integration; coordinator's broader 175-test run is the final evidence. One worker wrote only in an isolated temporary clone; coordinator integrated the reviewed 28-file manifest. No Antigravity execution occurred. One worker repair cycle plus coordinator final review corrections were used.

Remaining launch gates: NC documented compliance; AZ/CA classification review; conditional NV/TX/WA paths; unresolved FL; separate nationwide paid credit-cartridge CROA/state-CSO classification; unreviewed jurisdictions; and full verification of retained deposit citations/deadline/penalty data before exact legal claims. These limits are explicit and are not cleared by the copy changes.
