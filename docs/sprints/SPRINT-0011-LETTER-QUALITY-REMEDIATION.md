# SPRINT-0011 — DocketStamp letter quality and input integrity

**Status:** Active implementation; independent review and integration pending.  
**Base:** current staging source `ed6193659384ed8395b00c5b9f397bbc041334c0` (`Record replacement validation and remaining sprint acceptance`).  
**Core branch:** `codex/docketstamp-quality-core-2026-10-20`.  
**Core worktree:** `/tmp/docketstamp-quality-core-2026-10-20`.  
**No production/main edits, pushes, deployments, real payments, or real mail are in scope.**

The [canonical quality standard](../DOCKETSTAMP_LETTER_QUALITY_STANDARD.md) applies to every active template and all future variants. This sprint resolves demonstrated shared-code defects and coordinates separate template-content and address-first UX work. Legal review remains a release dependency wherever a template asserts a statutory or contractual right, duty, deadline, procedure, remedy, or effect.

## Commit-level work plan

| Proposed commit | Owner | Scope | Depends on |
| --- | --- | --- | --- |
| `fix(docket): validate factual inputs and protect derived legal values` | Core/integration lead | Parse with each notice schema; allowlist factual fields and common postal fields; validate state codes, ISO dates, currency, amount consistency, lengths, and address shapes; ignore renderer-owned legal values; preserve address line 2 in preview, frozen output, and provider payload source. Add deterministic regression tests. | Current staging base only. |
| `fix(notices): align templates with reviewed purpose and prerequisites` | Template-content worker | Correct template wording, claims, metadata, and chooser descriptions; retain evidence/source status and focused tests. Do not imply that an unreviewed jurisdiction or contract term was lawyer approved. | Core field contracts where relevant; separate worktree. |
| `fix(docket): prioritize tenancy address and safe ZIP suggestions` | Address-first UX worker | Put premises address first for tenancy flows; add confirmable, editable ZIP city/state suggestions without selecting legal jurisdiction, overwriting saved values, or conflating property, residence, forwarding, and recipient addresses. | Core common-field compatibility; separate worktree. |
| `docs(docket): record reviewed coverage and release acceptance` | Coordinator | Review each branch, integrate sequentially, resolve shared files without overwriting user work, record tested base/commit SHAs and legal-review gaps, run focused acceptance and assess release blockers. | All worker commits and independent reviews. |

Commit messages are proposals; coordinator may adjust them to match final scope. Workers return local commits only. Coordinator performs all integration and owns any release decision.

## Acceptance matrix

| Track | Acceptance evidence | Owner | Status at plan creation |
| --- | --- | --- | --- |
| Shared validation | Parsed schema output is the only template content source; unknown and protected statutory/derived fields cannot enter generated output; malformed dates, unsupported jurisdictions, invalid amounts, inconsistent balances, overlong fields, and malformed addresses are rejected. | Core | In progress |
| Address preservation | Sender and recipient line 1, line 2, city, state, and ZIP remain consistent in preview, body-derived full address, frozen document structure, and mail payload. | Core + UX | In progress |
| Template purpose and language | All nine templates, choices, variants, chooser descriptions, and claims have explicit purpose fit; unsupported duties, deadlines, remedies, proof claims, and required prerequisites are corrected or gated. | Template worker | Pending |
| Address-first UX | Premises address appears first where relevant; ZIP suggestion requires confirmation and editable selection; manual/unknown/multiple-city/outage paths preserve user-entered and restored values. | UX worker | Pending |
| Deterministic coverage | Every field-choice/state combination and each mail tier renders from local fixtures; malicious protected-key attempts and invalid boundary cases are covered without network, payment, postal, or account side effects. | Core + coordinator | In progress |
| Legal source coverage | Every live statutory or contract-specific claim records jurisdiction, official source, version/effective date, review date, prerequisites, exceptions, coverage, and legal reviewer status. Any missing lawyer review remains explicitly pending. | Template worker + coordinator | Pending; no law-firm approval is presumed |
| Integration safety | Workers use independent worktrees; original checkout changes remain untouched; coordinator reviews commits before integration and records resulting base/merge evidence. | Coordinator | Pending |
| Release gate | No Critical or High finding remains in an enabled path; legal review is complete for material legal claims; focused tests and print/preview checks pass; production remains untouched pending separate authorization. | Coordinator | Pending |

## Verification policy

Core verification is deterministic and local. It must exercise all current combinations and malicious field overrides without calling Stripe, Lob, USPS, Firebase, external recipients, or other services. A green test suite proves only the code properties it exercises. It does not prove statutory accuracy, contract coverage, legal sufficiency, dispatch, acceptance, delivery, or admissibility.

Record per-template legal review with: `template/variant`, `claim`, `jurisdiction or governing agreement`, `official primary source`, `source effective/version date`, `reviewed date`, `prerequisite fields`, `known exception`, `test case`, `qualified reviewer`, and `status`. Until an authorized reviewer records completion, use `pending legal review`; do not label the content validated or approved.

## Scope boundaries and risks

The template and UX workers own their specified files. The core lead owns shared renderer, route validation, address preservation, standard, sprint plan, and shared regression tests. Any changed schema or shared field contract must be coordinated before integration. Do not resolve conflicts by discarding concurrent work; ask the coordinator to choose when both branches legitimately change the same source. No TEST watermark is required for controlled staging tests.
