# SPRINT-0011 — Forceful demand language and state launch review

**Status:** Complete; deployed to staging and production (paid production checkout held pending live configuration)
**Run:** `2026-10-20-demand-copy`
**Source:** `4225135eb5bc0d1b35407851a809a69480a571c6`
**Owner:** Codex coordinator; Luna implementation, Sol legal research

## Pyramid index

1. Objective and authority
2. Scope and copy decisions
3. Tasks and dependencies
4. Acceptance and validation
5. Risks, unresolved decisions and provenance
6. Execution evidence

## Objective and authority

Present the existing self-help letters as clear customer actions, including formal demands, while removing unsupported facts, legal entitlements and outcome promises. Deliver a sourced, targeted state-law launch review identifying potential initial exclusions.

The user explicitly approved the prior review and requested implementation on October 20, 2026. This scoped copy revision supersedes conflicting titles/prose in the [Master Build Specification](../DOCKETSTAMP_MASTER_BUILD_SPEC.md), [Agentic Expansion Specification](../DOCKETSTAMP_AGENTIC_EXPANSION.md) and [homepage specification](../DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md); add dated authority notes there. All six system invariants remain mandatory and unchanged. No AI-generated legal advice is added to the product.

## Scope and copy decisions

### Approved chooser titles

| Existing canonical slug | Display title |
| --- | --- |
| security-deposit-return-demand-letter | Demand your security deposit back |
| tenant-repair-and-maintenance-notice | Demand repairs from your landlord |
| fdcpa-30-day-debt-validation-letter | Dispute a debt and demand verification |
| pre-arbitration-notice-of-dispute-and-refund-request | Demand a refund for removed or restricted features |
| statutory-health-and-biometric-data-deletion-demand | Demand deletion of your personal data |
| fcra-credit-bureau-written-dispute-letter | Dispute a credit-report error |
| written-contract-and-policy-cancellation-letter | Cancel a service or policy in writing |
| tenant-notice-of-intent-to-vacate | Give formal move-out notice |
| 30-day-mandatory-arbitration-opt-out-notice | Send an arbitration opt-out notice |

Hero: **Make it formal. We’ll print and mail it.** Supporting copy: **Demand your deposit back, dispute an error, or send a cancellation notice. Prepare and review your letter, then send it by USPS. Certified Mail available.**

Deposit title: **Security Deposit Demand Letter**. Printed heading: **FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT**. Other canonical titles should be concise and aligned with their action, without automatic timeliness, universal statutory coverage or attorney authorship claims. Keep meaningful statutory citations in letters and explanatory context.

### Deterministic copy policy

- Speak in the customer's first person; demand a concrete remedy and written response. No invented attachments, key surrender, established violation, entitlement to penalties, lawyer involvement or intent to sue.
- Deposit: state user-entered amounts/date, demand the requested balance, request itemized explanation/supporting records for claimed deductions and payment of the undisputed balance. Separate the requested response period from legal deadlines; preserve the original field values and signatures. Remove generic move-out-triggered deadline and absent penalty-warning claims.
- Existing state summaries are not verified merely because they are in the canonical dataset. Do not promote them into categorical printed deadline claims during this sprint. Retain a state statutory reference, explain in helper text that legal deadlines depend on applicable conditions, and explicitly state that the chosen response period does not change statutory deadlines. A fully sourced 51-jurisdiction deadline/penalty audit remains a launch gate for exact deadline claims.
- Repairs: demand repair of the reported condition and request a response/schedule; do not declare every condition a legal habitability violation or the five-business-day response a statutory deadline.
- Debt: customer disputes the stated alleged debt and demands verification. Describe mandatory collection suspension conditionally on FDCPA applicability and a timely written dispute during the validation period; distinguish requested documents and communication preference from universal entitlements. Preserve enum values for staged-draft compatibility but avoid blindly presenting an absolute preference as a legal command.
- Credit: demand reinvestigation and correction/deletion as required by applicable FCRA rules; avoid unconditional 30-day or deletion guarantees.
- Refund: demand the chosen remedy based on user-reported facts; do not assert that a generic letter fulfills every contract's pre-arbitration procedure or deadline.
- Arbitration: preserve the opt-out notice action but remove automatic “timely,” universal 30-day eligibility and all-rights-preserved claims. Helpers tell the sender to check the governing agreement's eligibility, deadline, method and address.
- Privacy: demand deletion and revoke consent where applicable; acknowledge verification, coverage and lawful retention exceptions; ask for explanation of retained data and required submission method. Do not imply the selected list of statutes establishes applicability.
- No new outcome/receipt/court-admissibility guarantees in marketing or agent discovery. Preserve exact mandatory UPL strings; add no invented lawyer-review claims.

Allowed files: chooser metadata; nine notice files; home workbench; app/page metadata; llms.txt and other actual discovery copy consumers; narrowly affected tests; dated specification addenda. No schema, slug, transport, payment, postal shell, data-registry or frozen-order mutations unless coordinator approves a demonstrated necessary correction. Coordinator-approved validation correction: collapse embedded whitespace in short text values through shared interpolation to prevent proven newline-driven physical overflow, with AST/print parity tests; wrap long unbroken input in both preview and physical prose without altering page dimensions, font sizes or clear-zone coordinates; change the misleading API error label “statutory validation” to “validation” without altering validation behavior.

Non-goals: production deployment; live payment/postage; state exclusions implemented from provisional research; full 50-state UPL or deposit-law clearance; new templates or tiers; external communications; concurrent admin work.

## Ordered tasks and dependencies

| Task | Owner | Depends on | Result |
| --- | --- | --- | --- |
| T01 | Coordinator + Luna critique | none | Intent, local draft, actual critique, plan and reserved ledger ID |
| T02 | Luna isolated writer | T01 | Aligned chooser/hero/title/heading/SEO/discovery and finite template/helper changes |
| T03 | Sol researcher + coordinator | T01, independent of T02 | Primary-source memo for NC/AZ/NV/CA plus TX/FL/WA screen; requirements, exemptions, nexus, uncertainty, launch recommendation |
| T04 | Coordinator/reviewer | T02 | Diff review, legal-claim review, focused tests, typecheck, actual browser fit and UI checks; up to three repair cycles |
| T05 | Coordinator | T03/T04 | Integrated changes, evidence per criterion, state launch decision backlog and accurate ledger/checkpoint |

One writer per checkout. Worker uses an isolated temporary clone of the source revision; coordinator preserves unrelated dirty files and integrates only reviewed allowed changes. Use the low-cost Luna model for bounded code and critique, a workhorse Sol model for legal research; coordinator performs final reasoning and validation.

## Acceptance and validation

- AC1: All nine chooser titles and duplicated hardware purpose labels match; canonical IDs/slugs/aliases/schema field keys/enum values remain stable. Search and recipient compatibility regressions pass.
- AC2: Preview/print/catalog/SEO/discovery agree on stronger actions. Deposit canonical title/header are exact. Current copy contains no absent penalty-warning, guaranteed timeliness, universal deletion/collection-stop or conclusive-court-proof promises in changed surfaces.
- AC3: Deterministic letters state supported user facts and requested remedies; response periods are distinguished from legal clocks; conditional rights stay conditional. User-provided enum content cannot reintroduce an unqualified legal assertion through interpolation.
- AC4: Mandatory footer unchanged; same interpolation powers preview/print; existing frozen snapshot regression passes. All affected letters fit single-page and clear zones with maximum supported inputs in an actual browser, with no clipping or footer collision. Shorten prose rather than shrink type or alter geometry.
- AC5: Focused chooser/home/cartridge/engine/rendering and snapshot tests pass, as does TypeScript. Desktop/mobile labels fit without horizontal overflow. Record any baseline failure separately; CSS-string checks alone are not physical-fit evidence.
- AC6: State memo cites official primary sources where accessible, discloses currency and retrieval limits where not, and separates text from applicability inference, names specific hold candidates and conditions to support, covers nexus and future backend enforcement, and explicitly records unscreened states. No state is silently disabled and no nationwide clearance is claimed.
- AC7: Governing documents have dated scoped authority notes; run/ledger provenance and limitations are accurate. Unrelated working changes remain untouched.

Suggested checks: `node --import tsx --test tests/s2-chooser-and-routing.test.ts tests/s3-homepage-composition.test.ts tests/docket-cartridges.test.ts tests/sprint-0011-demand-copy.test.ts`; `npm run test:docket`; relevant frozen snapshot tests; `npx tsc --noEmit --incremental false`. Run actual Chromium DOM bounds for physical letters and inspect representative rendered screenshots plus 390px/1280px homepage. Use local mocks only.

## Risks, unresolved decisions and provenance

A legal research memo is issue spotting and launch planning, not a legal opinion. Unknown corporate location, credentials, attorney-review records and consumer state nexus prevent a final eligibility decision. Support decisions must distinguish selling software/forms from personalized assistance or representation; a recipient's address alone is not the consumer's jurisdiction.

Do not assume NC or other rules vanish if the invoice calls this mailing. A future exclusion feature must cover direct/UI/REST/MCP/staged drafts and server pre-payment validation, with explicit supported geography and treatment of existing paid orders. Specify that backlog after research.

Planning provenance: actual read-only Luna critique saved in the run; coordinator synthesized it with current source. Single-app Codex work; Antigravity unavailable and not claimed. Optional handoff is saved. State researcher uses primary web sources. Agent reports are provisional until coordinator checks the actual artifacts.

## Execution evidence

Completed locally. [Verification report](../../.delivery/runs/2026-10-20-demand-copy/verification.md) maps every acceptance criterion to evidence: 175 tests passed, TypeScript passed, 90/90 Chromium print cases passed, desktop/mobile UI passed, and all 12 pre-existing unrelated-file fingerprints matched. [Implementation review](../../.delivery/runs/2026-10-20-demand-copy/implementation-review.md) findings were corrected.

[State launch review](../legal/STATE_LAUNCH_REVIEW_2026-10-20.md) recommends NC hold, provisional AZ/CA holds, conditional NV/TX/WA review paths, unresolved FL, and a separate nationwide paid credit-cartridge classification review. These are recommendations with explicit applicability/source limits. No state or template was disabled. Full jurisdictional eligibility and deposit-law verification remain launch gates.

Delegation: Luna high implementation; Luna medium critique/review; Sol high legal research; coordinator integration and browser validation. No Antigravity run, production deployment, live payment or postal dispatch occurred.

## Deployment

User-authorized release `4e24aec` is verified on staging and production. See [.delivery deployment evidence](../../.delivery/runs/2026-10-20-template-governance/deployment.md). The release also preserves newer staging address/factual-input safeguards and keeps arbitration as a procedure-information request. Legal/provider launch reviews remain separate from technical deployment.
