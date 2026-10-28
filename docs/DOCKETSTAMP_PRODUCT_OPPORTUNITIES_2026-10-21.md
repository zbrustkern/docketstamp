# DocketStamp product opportunities: making formal notice as easy as checkout

**Research date:** October 21, 2026  
**Status:** Product opportunity review and proposed prioritization; no new templates or live policies enabled.  
**Scope:** Non-fitness consumer cancellation, statutory notice, refund, and corporate dispute procedures in the United States.  
**Evidence:** Current repository inventory and the linked statutory, regulator, and company sources reviewed during this research. Commercial rankings are judgments about product fit, not validated demand, conversion, or acquisition-cost estimates.

## 1. Product thesis and meaning of “click to cancel”

The founder's intended use of **click to cancel** is a service-design principle: bring a simple digital transaction to tasks that still require an inconvenient physical notice. The customer completes DocketStamp's form, reviews and adopts the letter, and pays. DocketStamp handles preparation, printing, envelope production, postage, mailing, and the available postal records.

The opportunity exists wherever a customer would otherwise need to identify a notice procedure, compose a letter, find the appropriate recipient, print it, and arrange mailing. It includes cancellation, ending an unnecessary recurring expense, requesting a refund, reporting an account error, and initiating a contract's informal dispute process. Its value does not depend on a nationwide click-to-cancel mandate, a company's failure to provide an online cancellation button, or an allegation that the company broke the law.

**The desired customer experience is: select the task → complete the form → review and sign → pay → DocketStamp mails the notice.** Removing the customer's physical work is the core benefit. A company may still require a response, verification, inspection, or settlement discussion after receiving the notice; dispatch does not itself establish that the requested outcome occurred.

This clarification broadens the original research framing. A straightforward PMI cancellation request can fit the thesis just as well as a disputed subscription cancellation. Required mailed notices have especially strong fit; accepted mailed notices can also be useful when the customer values convenience and retained records. A procedure that requires a webform, original handwritten signature, or unsupported enclosures may require a different product.

## 2. Governing architecture and current inventory

This review operates under the [Master Build Specification](DOCKETSTAMP_MASTER_BUILD_SPEC.md) and [Agentic Expansion Specification](DOCKETSTAMP_AGENTIC_EXPANSION.md), including their scoped copy and governance updates. The six system invariants remain applicable: the NAICS 713940 fitness exclusion; deterministic administrative form letters and mandatory UPL disclosures; one-page letter geometry and USPS clear zones; identical preview/print interpolation; immutable freeze-before-payment snapshots; and staging/production Lob key separation.

The [compiled notice registry](../src/lib/docket/notices/index.ts) contains these nine products. Registry presence is distinct from live policy availability and legal clearance.

| Current product | Canonical slug | Relationship to the opportunity scan |
| --- | --- | --- |
| Tenant Move-Out Notice | `tenant-notice-of-intent-to-vacate` | Existing example of replacing physical notice work with a digital purchase. |
| Security Deposit Demand Letter | `security-deposit-accounting-request` | Existing demand category; specialized consumer statutes require their own reviewed procedures. |
| Tenant Repair Demand Letter | `tenant-repair-and-maintenance-notice` | Existing factual demand category. |
| Credit Report Dispute Letter | `credit-report-dispute-request` | Concerns credit reporting; a credit-card billing-error notice is a separate product. |
| Debt Dispute and Verification Request | `debt-dispute-information-request` | Concerns collection claims; distinct from bank-debit revocation and servicing errors. |
| Service or Policy Cancellation Letter | `service-cancellation-request` | Foundation for contract-specific cancellation and refund flows. |
| Product Complaint and Refund Demand | `product-complaint-refund-request` | General complaint/refund demand; its historical pre-arbitration ID does not make it compliant with each company's notice procedure. |
| Arbitration Terms and Opt-Out Procedure Request | `arbitration-opt-out-procedure-request` | Requests information; does not itself exercise an arbitration opt-out. |
| Personal Data Deletion Demand | `personal-data-deletion-request` | Existing privacy category; not expanded in this scan. |

The recipient inventory already includes home security, pest/lawn services, home warranties, telecom/insurance, and hardware companies. Their presence does not establish that one address is valid for every cancellation, dispute, refund, privacy, or opt-out purpose. Address standardization and delivery suitability are separate from verification of the contractually or legally designated notice recipient.

Related work: [official-template opportunity review](legal/OFFICIAL_TEMPLATE_PRODUCT_REVIEW_2026-10-20.md), [state launch review](legal/STATE_LAUNCH_REVIEW_2026-10-20.md), and [template governance sprint](sprints/SPRINT-0012.md). This document extends the opportunity backlog; it does not resolve the provider-model, source-reuse, or jurisdiction questions recorded there.

## 3. Opportunity portfolio

“Mail fit” distinguishes a prescribed postal method from a written-notice process where mail is useful but certified service is optional. Priority reflects customer work removed, consequence of the notice, compatibility with the existing product, and procedural complexity.

| ID | Opportunity | Mail fit | Inventory relationship | Proposed disposition |
| --- | --- | --- | --- | --- |
| OPP-01 | Mortgage servicing error notice | Written notice; designated postal address where established | New product | First development group |
| OPP-02 | Credit-card billing-error notice | Timely written notice; designated address; accepted electronic methods may also qualify | New product | First development group |
| OPP-03 | Recurring bank-debit authorization revocation | Written follow-up to company and bank; mail is one supported approach | Cancellation extension plus separate bank notice | First development group |
| OPP-04 | PMI cancellation request | Written request for eligible loans; certified mail not generally required | New cancellation product | Early validation alongside first group |
| OPP-05 | Vehicle service contract cancellation/refund | State and contract-specific notice; strong potential for mailed fulfillment | New cancellation vertical | Next development group |
| OPP-06 | Massachusetts Chapter 93A demand | Written pre-suit demand; certified/return receipt recommended by the state | New state-specific demand | Next development group |
| OPP-07 | Texas DTPA notice | Written pre-suit notice; no universal certified-mail requirement established by this scan | New state-specific demand | Later, after applicability review |
| OPP-08 | California CLRA correction demand | Certified or registered mail, return receipt requested | New state-specific demand | High postal fit; deeper review first |
| OPP-09 | AT&T notice of dispute | Mail or official online submission | Company-specific dispute extension | Narrow procedure pilot |
| OPP-10 | Comcast/Xfinity notice of dispute | Mail, email, or official online submission | Company-specific dispute extension | Narrow procedure pilot |
| OPP-11 | PlayStation arbitration opt-out | Mailed written notice under the reviewed US terms | Actual election beyond current information request | Narrow procedure pilot |
| OPP-12 | PayPal notice of dispute | Certified mail plus original handwritten signature and supporting material | New company-specific dispute product | Defer under current fulfillment model |
| OPP-13 | eBay notice of dispute | Current agreement directs the notice to a webform | Potential digital assistance, outside current postal product | Deprioritize for paid mail |

## 4. Statutory and cancellation opportunities

### OPP-01 — Mortgage servicing error notice

**Customer task:** Report a misapplied mortgage payment, an incorrect servicing fee, or a specific escrow servicing error after routine support has not resolved it.

**Evidence:** [12 CFR §1024.35](https://www.consumerfinance.gov/rules-policy/regulations/1024/35/) defines a written notice containing borrower identification, account identification, and the asserted error. A designated notice address must be used when the servicer establishes one. Acknowledgment is generally due within five days excluding weekends and legal public holidays; ordinary covered errors generally have a 30-day response period on the same basis. Exceptions, different periods, and permitted extensions apply.

**Proposed product:** A focused notice with borrower/account identifiers, error category, transaction date, disputed amount where relevant, and a concise factual account. A mortgage information-request product is a related future candidate, but needs separate review of its governing requirements.

**Fit and boundaries:** Strong match for deterministic, one-page notices. Begin with routine payment, fee, and escrow issues. Foreclosure-related matters, origination/underwriting complaints, and broad demands for every loan document should not be folded into that initial scope. The notice is not a promise to stop foreclosure or erase the payment obligation.

### OPP-02 — Credit-card billing-error notice

**Customer task:** Dispute a duplicate charge, an uncredited payment/refund, or qualifying goods/services not accepted or delivered as agreed.

**Evidence:** [12 CFR §1026.13](https://www.consumerfinance.gov/rules-policy/regulations/1026/13/) generally requires the creditor to receive the written notice at the disclosed address within 60 days after transmitting the first statement reflecting the error. It specifies identifying information and the error's type, date, amount, and explanation. Acknowledgment is generally due within 30 days unless resolved; resolution is due within two complete billing cycles, no later than 90 days. An expressly accepted electronic submission method can satisfy the written-notice requirement.

**Proposed product:** Capture statement transmission date, issuer's billing-dispute address, sufficient account identification, charge/credit details, and a bounded explanation. Preserve available receipt evidence and clearly distinguish receipt deadlines from checkout or dispatch dates.

**Fit and boundaries:** New capability beyond the credit-report dispute template. Ordinary quality complaints about accepted goods are not automatically billing errors under this procedure. Near-deadline cases need an appropriate faster accepted channel; purchasing a letter does not establish timely receipt.

### OPP-03 — Recurring bank-debit authorization revocation

**Customer task:** Withdraw permission for future recurring debits and create a record of the instruction, either alongside cancellation or while changing payment methods.

**Evidence:** The [CFPB's automatic-payment guidance](https://www.consumerfinance.gov/ask-cfpb/how-do-i-stop-automatic-payments-from-my-bank-account-en-2023/) describes contacting the company and bank, followed by a letter or email. [Regulation E §1005.10](https://www.consumerfinance.gov/rules-policy/regulations/1005/10/) separately addresses stop-payment instructions and revocation. Oral stop-payment instructions can be time-sensitive, and a bank may require written confirmation.

**Proposed product:** A user-selected sequence with distinct documents: service cancellation where desired, merchant debit-authorization revocation, and bank notification. Each mailing has its own recipient and fulfillment record. A bundle would require new order/checkout behavior rather than assuming the existing single-letter purchase covers multiple recipients.

**Fit and boundaries:** This is a direct application of the founder's friction-reduction thesis. Initial non-fitness categories can build on existing monitoring, pest/lawn, warranty, and subscription inventory. Revoking a bank debit does not terminate the service contract or extinguish an amount owed. Credit-card recurring charges require separate treatment; an urgent bank instruction should not wait for postal delivery.

### OPP-04 — Private mortgage insurance cancellation request

**Customer task:** Ask to remove borrower-paid PMI after reaching the applicable eligibility point, avoiding the work of composing and mailing the request.

**Evidence:** [CFPB guidance](https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/) describes written requests when qualifying loans reach the applicable 80% original-value threshold. Conditions include payment history, current payments, junior liens, and evidence concerning property value. Automatic termination at the scheduled 78% point is a separate rule. FHA, VA, and lender-paid insurance have different treatment.

**Proposed product:** A request based on the customer's loan information and declared facts, with loan/property identifiers and a request for any additional evidence the servicer requires. Avoid representing that the letter alone completes cancellation or replaces a required appraisal.

**Fit and boundaries:** Especially close to the clarified thesis: the customer buys administrative convenience to pursue recurring savings without needing an existing dispute. Validate eligibility screening, notice routing, customer willingness to pay, and servicer digital alternatives early. Treat financial savings as conditional rather than guaranteed.

### OPP-05 — Vehicle service contract cancellation and refund request

**Customer task:** Cancel an unwanted vehicle service contract and request the applicable refund/accounting.

**Evidence:** The [California Department of Insurance guide](https://www.insurance.ca.gov/01-consumers/105-type/95-guides/01-auto/servcontextwar.cfm) explains cancellation under Civil Code §1794.41. Full-refund eligibility generally depends on cancellation within 60 days of receipt, or 30 days for a used vehicle without a manufacturer warranty, compliance with the contract's cancellation procedure, and no filed claim. Later cancellation or claims can produce partial refunds. The [New Motor Vehicle Board](https://www.nmvb.ca.gov/consumer_program/mediation_overview.html) recommends certified mail with return receipt and notes that a financed-contract refund may go to the lender.

**Proposed product:** A reviewed California flow with contract/obligor identification, VIN, mileage where needed, purchase and receipt dates, claim history, financing status, and cancellation/refund instructions. Add an accounting follow-up only where useful and supported.

**Fit and boundaries:** Extends the cancellation category into a distinct purchase with potentially meaningful refund value. Verify the contract-specific recipient and any required forms or enclosures. Do not automatically extend this product to GAP products, insurance, every extended warranty, or other states.

### OPP-06 — Massachusetts Chapter 93A demand

**Customer task:** Send a formal demand concerning a qualifying unfair or deceptive consumer transaction, such as a failed repair or defective purchase.

**Evidence:** [Massachusetts' official guidance](https://www.mass.gov/info-details/30-day-demand-letter) describes a demand generally required 30 days before filing a covered consumer claim, with exceptions. The notice identifies the consumer, complained-of conduct, injury, and requested relief. Certified mail with return receipt is recommended rather than legally required; the guidance also recommends a regular-mail copy.

**Proposed product:** A state-specific, factual demand with transaction details, reported conduct, loss, and relief selected by the customer. Review how to support the recommended second mailing within the product.

**Fit and boundaries:** Strong formal-demand candidate already identified in the prior official-template review. Coverage, exceptions, source reuse, and provider-model questions remain separate launch decisions. Do not promise multiple damages or treat a user-selected response period as the statutory period.

### OPP-07 — Texas DTPA notice

**Customer task:** Provide the pre-suit complaint notice for a qualifying consumer purchase or service dispute.

**Evidence:** The [Texas State Law Library](https://guides.sll.texas.gov/consumer-protection/relief) describes Business & Commerce Code §17.505's general requirement for written notice at least 60 days before suit, including reasonable detail of the complaint and potential damages. Statutory exceptions and claim eligibility need to be evaluated for the proposed product.

**Proposed product:** A narrowly scoped notice capturing transaction facts and customer-supplied loss amounts. Applicability and damage categories require reviewed questions and deterministic text.

**Fit and boundaries:** Good potential for a state-specific demand family. More legal classification work is needed than for a general refund request; the application should not invent claims, calculate speculative damages, or characterize every unsuccessful transaction as a DTPA violation. This scan does not establish a universal certified-mail requirement.

### OPP-08 — California CLRA correction demand

**Customer task:** Give the statutory correction notice for qualifying alleged Consumers Legal Remedies Act violations before seeking damages.

**Evidence:** [Civil Code §1782, reproduced by FindLaw as current January 1, 2026](https://codes.findlaw.com/ca/civil-code/civ-sect-1782/), specifies notice at least 30 days before a damages action, identifying particular alleged §1770 violations and demanding correction, repair, replacement, or other rectification. It specifies certified or registered mail, return receipt requested, to the transaction location or the recipient's principal place of business within California. [California Judicial Council instruction 4701](https://courts.ca.gov/system/files/2024-08/judicial_council_of_california_civil_jury_instructions_2024.pdf) corroborates those requirements.

**Proposed product:** A narrowly reviewed correction demand with relevant transaction facts, identified alleged conduct, requested correction, and qualifying recipient location. The dispatch tier must match the reviewed statutory method.

**Fit and boundaries:** One of the strongest direct postal-method matches. Eligibility, allegation specificity, source freshness, and California provider classification make it a deeper-review candidate. The official legislative page returned 403 during research; obtain operative primary text before implementation. This is not a universal California refund letter.

## 5. Company-specific procedures

These procedures generally begin informal negotiation before arbitration. Preparing and mailing the notice does not itself provide mediation, initiate arbitration, or represent the customer in a settlement discussion.

### OPP-09 — AT&T notice of dispute

**Customer task:** Escalate an unresolved account or service complaint through AT&T's formal process, including disputed billing, promised credits, or charges after cancellation.

**Evidence:** [AT&T's current support guidance](https://www.att.com/support/article-modal/my-account/000095431/) describes a Notice of Dispute that can be printed and mailed or submitted online, a 60-day investigation/contact period, and a possible phone/video informal settlement conference. The [consumer arbitration agreement](https://www.att.com/scmsassets/support/other/attconsumerarbitrationagreement.pdf) specifies notice completeness, signature, and other procedural requirements.

**Proposed product:** A versioned AT&T notice with required account/contact identifiers, factual issue, relief and calculation, consumer adoption, and purpose-specific routing. Retain the free online path as an alternative.

**Fit and boundaries:** A useful company-specific pilot beyond the general refund letter. Verify the governing agreement/product and signature acceptance before launch; older AT&T documents surfaced different periods and certified-mail requirements. Do not mix those versions or assume the notice completes every required personal-participation step.

### OPP-10 — Comcast/Xfinity notice of dispute

**Customer task:** Escalate an unresolved Comcast service/account complaint to its legal department through the published notice process.

**Evidence:** [Comcast's notice page](https://www.xfinity.com/nod) accepts a completed notice online, by email, or by mail and describes an effort to resolve it within 60 days. The [April 2026 residential agreement](https://assets.xfinity.com/assets/dotcom/projects/cix-5055_xfinity-com-welcome-kit-legal/RSA_N1_042026.pdf) identifies required information, signature, a complete-notice trigger, and personal participation in the negotiation conference.

**Proposed product:** A procedure-specific form with account/service address, relevant services, facts, requested relief and calculation, signature, and the legal/arbitration notice destination. Paid mailing is optional convenience alongside the free submission methods.

**Fit and boundaries:** The existing Comcast recipient entry is a starting point, not confirmation that its generic correspondence designation satisfies this procedure. Check agreement applicability, required form content, signatures, and supporting-document needs. Track the complete-notice receipt event separately from payment or initial mailing.

### OPP-11 — PlayStation arbitration opt-out

**Customer task:** Exercise an available arbitration opt-out without researching and arranging a mailed letter personally.

**Evidence:** [Current US PlayStation terms §14.3](https://www.playstation.com/en-us/legal/terms-of-service/) specify a written notification mailed within the stated 30-day acceptance window, with the consumer's name, address, PlayStation Services online ID if applicable, and an explicit election. Existing agreements to arbitrate can remain effective. The reviewed terms list a San Mateo destination; older terms surfaced a Los Angeles address.

**Proposed product:** An actual company/version-specific election capturing the acceptance date, relevant identifiers, required statement, and verified notice destination. This would be a new capability alongside the current generic procedure-information request.

**Fit and boundaries:** Strong match for making a physical administrative task easy. Review the window, governing agreement, mailing timing, and effect of prior agreements. Do not imply that every terms update creates a fresh opportunity to escape earlier obligations. Certified service may be useful for records, but the cited clause prescribes mailing rather than expressly requiring certified mail.

**Adjacent extension:** Section 14.4 also describes a mailed dispute notice and a 60-day negotiation period. It calls for relevant documents/supporting information, so it needs a separate assessment of the one-page/no-enclosures limitation before being offered as a compliant notice product.

### OPP-12 — PayPal notice of dispute: defer

**Customer task:** Escalate an unresolved dispute with PayPal itself, distinct from an ordinary buyer/seller resolution-center claim.

**Evidence:** The [US user agreement updated September 14, 2026](https://www.paypal.com/us/legalhub/paypal/useragreement-full?locale.x=en_US) requires certified mail, a completed notice with an original handwritten signature, account contact details, detailed claims, requested relief/calculation, and relevant reasonably available supporting material. It establishes a 60-day negotiation period and possible personal settlement conference. Older indexed material described 45 days; it must not drive a new product.

**Disposition:** Attractive postal demand, but incompatible with treating the present printed `/s/` signature and single-page notice as sufficient. A scanned or printed signature should not be presumed equivalent to the specified original handwritten signature. Defer unless a separately reviewed fulfillment method can satisfy the requirements. The current [notice form](https://www.paypal.com/us/legalhub/paypal/pp-notice-dispute?locale.x=en_US) is supporting procedural evidence, not permission to ignore the agreement.

### OPP-13 — eBay notice of dispute: deprioritize postal fulfillment

**Customer task:** Escalate an unresolved dispute with eBay under its informal dispute-resolution process.

**Evidence:** The [current US user agreement, effective June 28, 2026 for existing users](https://www.ebay.com/help/policies/member-behavior-policies/user-agreement-and-privacy-policy?id=4259), directs initiation through a Notice of Dispute webform and describes a 45-day process. Older mail/email procedures and forms remain discoverable and should not be substituted for the governing procedure. Its opt-out clause also restricts third-party submissions, requiring separate assessment before offering an opt-out mailing service.

**Disposition:** Lower fit for the current postal product. Any future assistance should follow the applicable digital process. Do not market a generic mailed letter as satisfying the current webform requirement.

## 6. Product requirements implied by the opportunities

### 6.1 Procedure records, not only recipient addresses

Each supported notice should have reviewed records for company/legal entity or statutory scope, notice purpose, applicable agreement/version, source URL and review date, required fields, permitted submission methods, recipient destination, signature requirements, enclosures, and timing triggers. Distinguish a mailed-letter requirement from a requirement for certified mail and from optional proof-of-delivery service.

These records are a proposed capability. The existing policy overlay's residence/property dimensions do not encode all the transaction, account, loan, contract, and timing facts needed by these products. Headquarters location, sender address, and IP are not substitutes for those facts.

### 6.2 Preserve the simple customer transaction

Ask only the questions required for the selected supported procedure, then show the complete deterministic notice for adoption and payment. Route and format the letter from reviewed configuration. Preserve the exact frozen content and expose available mailing records. Explain any remaining customer action, such as a requested conference, without representing it as a step DocketStamp already performed.

Keep each notice within the current single-page geometry. A two-recipient sequence can use separate one-page notices, but requires explicit product and payment support. A procedure requiring enclosures, a prescribed longer form, or an original handwritten signature cannot be made compatible by silently omitting those requirements.

### 6.3 Track the right event

Checkout, document adoption, fulfillment submission, USPS acceptance/postmark, delivery, complete-notice receipt, and the effective cancellation date are different events. Each proposed product needs a reviewed definition of the relevant event and any calendar/business-day rules. Do not use a payment timestamp as proof of a postmark or receipt. Deadline reminders may assist the customer but cannot certify an unobserved event.

### 6.4 Position and price the work performed

Charge transparently for preparation, printing, postage, fulfillment, and records. The administrative convenience can have value even when an official free form or digital option exists. Avoid promising cancellation, a refund, preserved rights, or a favorable response solely because the notice was purchased or delivered.

The existing registry prices are $12.95 for First-Class, $19.95 for Certified, and $27.95 for Certified plus return receipt. They are current product prices, not validated pricing for each new opportunity. Bundles need their own economics and explicit mailing counts. No market-size, willingness-to-pay, or acquisition-cost estimates were established in this scan.

## 7. Proposed sequence and validation

1. **Develop the first three candidates:** OPP-01 mortgage servicing errors, OPP-02 card billing errors, and OPP-03 bank-debit revocation/cancellation sequences. They add distinct tasks with structured facts and clear administrative work for DocketStamp to perform.
2. **Validate PMI cancellation early:** OPP-04 is especially aligned with the founder's clarified thesis and may deserve promotion based on customer research and feasibility. Evaluate it alongside the first group rather than excluding it for lacking a dispute.
3. **Expand cancellation and demands:** Review OPP-05 vehicle service contracts and OPP-06 Massachusetts demands, then OPP-07 Texas and OPP-08 California as their applicability/provider questions are resolved.
4. **Pilot narrowly scoped company procedures:** Assess OPP-09 AT&T, OPP-10 Comcast, and OPP-11 PlayStation independently. Validate complete content, accepted signatures, correct routing, and one-page feasibility for each.
5. **Retain explicit deferrals:** OPP-12 PayPal needs a different fulfillment capability; OPP-13 eBay currently favors digital submission. Neither should be launched by renaming the generic refund template.

For each first-group candidate, the next reviewable deliverable is a procedure specification with sources, eligibility and unsupported branches, required inputs, deterministic prose, delivery method, timing behavior, and a sample rendered notice. Customer interviews and intent/search research should then test the actual task, the physical work avoided, and willingness to pay. Rank changes should cite that evidence rather than treating this qualitative order as measured demand.

New templates retain the repository's default-paused governance behavior until the required review and authorized human enablement. This document schedules no automation, alters no paid snapshot, and makes no live availability change.

## 8. Click-to-cancel legal context and research limits

The product thesis in section 1 is independent of the federal rule's status. As background, the [FTC's March 2026 notice](https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option) describes new rulemaking consideration after the 2024 rule was vacated. [California's Attorney General](https://oag.ca.gov/node/608083) describes state automatic-renewal protections, including online cancellation for covered online enrollments. Those laws may inform particular products; they are not the basis for claiming that every customer can terminate every contract with a mailed letter.

Research limitations: this is an opportunity scan, not a 50-state audit, completed provider/reuse review, test of company acceptance, or measurement of consumer demand. Company terms and destinations change. The PlayStation address change, PayPal signature/period changes, and eBay submission-method change demonstrate why sources must be bound to the actual supported procedure and rechecked before implementation. Preserve the fitness exclusion across every proposed vertical, recipient, discovery surface, and staged notice.

## 9. Immediate implementation from the existing inventory

The user authorized a sprint and Luna execution for useful additions that do not require further substantive review. [SPRINT-0013](sprints/SPRINT-0013.md) implements a browsable `/letters` library and six cancellation starting points: home security/monitoring, residential pest/lawn, home warranty, telecom/satellite, automobile/property insurance, and commercial/residential service subscriptions. Each uses an exact existing category value to prefill the current cancellation form; the customer can edit it.

This improves discovery and removes a selection step while retaining the existing nine underlying letters, their text, and their availability and location controls. It adds no company-specific procedural assertion, new notice recipient, or claim of legal clearance. The thirteen researched opportunities above remain the expansion backlog. Implementation and verification evidence are linked from the sprint; no deployment or live policy change is included.
