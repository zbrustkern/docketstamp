# DocketStamp Letter Quality Standard

**Status:** Proposed canonical product standard, effective for review of every user-selectable letter and future variants.  
**Owner:** Product and engineering; qualified counsel reviews legal rules when a template states or depends on them.  
**Last updated:** 2026-10-20

DocketStamp prepares deterministic self-help correspondence and postal dispatch records. It is not a law firm and does not give legal advice. This standard is a drafting and product acceptance rule; passing it is not a finding that a letter is legally sufficient or approved by a law firm.

## Rules that apply to every letter

1. **Truthful factual inputs.** Every statement presented as a user's fact must come from a field the user supplied or affirmed. Do not infer events, dates, amounts, prior notices, enclosures, acceptance, delivery, or other people's conduct from a template default or from a service tier.
2. **Purpose fit.** The title, field set, prompts, generated body, and requested action must describe the same task. A document must collect the facts needed to perform that task and avoid claiming it accomplishes a different task.
3. **Collect prerequisites before asserting an effect.** When a claim depends on a contract term, notice, date, status, address, consumer election, or prior communication, collect and validate that prerequisite or use neutral request language that does not claim the condition is met.
4. **Use the jurisdiction that actually governs the issue.** Ask for the relevant property, residence, transaction, or contract jurisdiction when needed. Postal address autofill is a convenience and never selects or silently changes legal jurisdiction. Unsupported jurisdictions must fail closed or receive neutral, non-statutory wording; they must not receive invented fallback law.
5. **Separate requests from legal duties.** Label user-selected response periods as requested deadlines. Describe a recipient duty only when its trigger, prerequisites, scope, and current authority are established for the selected situation.
6. **Substantiate amounts and remedies.** Reconcile arithmetic and identify the factual basis for each demanded amount. Do not equate an unpaid balance with an amount legally owed when deductions, credits, fees, interest, or a required accounting may change the amount. Do not promise penalties, court access, class-action rights, or other remedies without substantiated eligibility.
7. **Maintain authority and provenance.** Record the official source, jurisdiction, cited provision, effective/version date, last review date, source owner, applicable prerequisites, known exceptions, and test coverage for every legal rule used. Unreviewed or stale claims remain marked pending and cannot be described as verified.
8. **Describe process and evidence accurately.** Distinguish document preparation, payment, provider acceptance, USPS acceptance, transit scans, delivery, and signature receipt. A generated record or tracking option does not prove an event occurred or guarantee admissibility.
9. **Make signature intent clear.** Show whose signature is being adopted and what the user affirmed. Do not imply notarization, oath, court filing, representation, or universal contractual compliance unless a separate verified workflow supports it.
10. **Use plain, professional correspondence.** Prefer concise, specific, respectful language. Avoid registry or court-like styling that implies an authority, filing, deadline, or proof that the product cannot establish.
11. **Preserve all confirmed content across surfaces.** The live preview, frozen HTML, generated PDF, structured mailing address, and dispatch record must use the same validated facts and address components. Unknown values must be visible or omitted intentionally, never silently substituted.
12. **Keep claims aligned across product surfaces.** Template title, help text, chooser metadata, SEO copy, sales pages, checkout, and receipt must not promise rights, deadlines, service, or evidence beyond the actual document and provider behavior.

## Severity and review tiers

Severity describes a finding's consequence. It does not reduce the truthfulness requirements for lower-risk content.

| Severity | Meaning | Release treatment |
| --- | --- | --- |
| **Critical** | A known defect can generate materially false legal text, direct the wrong party, defeat the document's stated purpose, or create an unsafe signed record. | Block the affected template or path until corrected and verified. |
| **High** | Unsupported legal duty, deadline, remedy, factual assertion, required prerequisite, jurisdiction, or derived-field override can materially mislead the user or recipient. | Block the affected template or variant until corrected; legal review is required when the defect depends on law. |
| **Medium** | Ambiguity, missing but non-dispositive information, address/status confusion, or unmeasured print fit could impair use or credibility. | Resolve before claiming the affected behavior is reliable; document accepted constraints. |
| **Low** | Cosmetic or editorial improvement with no identified effect on truth, purpose, rights, or delivery. | Track as improvement; never use this tier to excuse unsupported content. |

| Review tier | Typical use | Required rigor |
| --- | --- | --- |
| **1 — Routine correspondence** | Factual requests and ordinary notices without asserting a special statutory election or remedy. | Editorial review, field/schema checks, print/preview parity, and truthful status checks. |
| **2 — Financial or contract correspondence** | Deposit accounting, credit reporting, debt collection, subscription or insurance cancellation. | Tier 1 plus traceable authority for legal claims, explicit amount reconciliation, prerequisite review, and qualified counsel review of reusable statutory language. |
| **3 — Rights-preserving or procedure-dependent notices** | Arbitration opt-out, pre-dispute notice, privacy rights, special service or objection requirements. | Tier 2 plus agreement/version and jurisdiction coverage, timing/channel/prerequisite tests, and counsel review before claiming that an election or statutory remedy is effective. |
| **4 — Court, sworn, filed, or notarized instruments** | Documents represented as court filings, affidavits, sworn statements, or notarized acts. | Unavailable in the current letter workflow. Requires a separately designed and reviewed workflow before support. |

## What can be checked automatically

Deterministic validation may enforce required fields, enums, supported state codes, actual calendar dates, amount syntax and arithmetic, configured length limits, protected derived keys, address component preservation, signature-name equality, unresolved-token detection, and parity between the locked values and mailing payload. It can also verify that a legal citation matches an internal reviewed record. It cannot establish that user facts are true, that a landlord or company is legally responsible, that a contract applies, that a legal deadline has begun, or that a remedy is available.

Human editorial review assesses whether the document does what its stated purpose promises, whether instructions and requests read clearly, and whether titles, fields, body, preview, PDF, and marketing describe one coherent instrument. Qualified legal review assesses applicable law, coverage, prerequisites, exceptions, current authority, and legally consequential language. Automated tests and a source citation are not substitutes for that review.

## Release acceptance checklist

- [ ] The template's stated purpose is narrow and matches every generated variant.
- [ ] Each asserted fact has a corresponding user input, verified product event, or cited legal source.
- [ ] All prerequisites for legal claims and requested effects are collected and validated.
- [ ] The selected jurisdiction represents the relevant issue and is independent of postal autofill.
- [ ] Statutory duties, requested response periods, and user-selected deadlines are distinguished.
- [ ] Currency fields parse, reconcile, and describe what the user is actually requesting.
- [ ] Legal source and version records exist; unresolved legal review is explicit.
- [ ] User fields cannot replace citations, deadlines, penalties, status, IDs, or other renderer-owned values.
- [ ] Signature name, consent, capacity, and affirmation are clear and consistent.
- [ ] Preview, frozen HTML, PDF, and mail-provider address payload preserve identical validated content.
- [ ] Provider and USPS lifecycle claims match an event that actually occurred.
- [ ] Every defined variant is exercised with deterministic fixtures; boundary and invalid inputs fail safely.
- [ ] The selected severity tier and reviewer dispositions are recorded before release.
