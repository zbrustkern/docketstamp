# Security-deposit deadline wording — staging review

Scope authorized November 3, 2026: correct the printed deadline wording where state conditions require it, preserve formal DEMAND positioning, test and deploy to staging for review. No production promotion, campaign launch, account/verification change, payment, signature adoption or mailing is authorized by this release.

## Problem and bounded correction

The previous paragraph said that a landlord must itemize deductions and refund the balance within the selected state's reference period **“of surrender of possession.”** That universal trigger omitted conditions present even in the existing state registry. The current inputs do not establish a termination date, surrender date separate from move-out, prior demand date, written forwarding-address delivery, statutory coverage, or bad faith.

The opening demand and user-stated basis remain unchanged. The revised paragraph demands compliance with the selected state's law and preserves its registry citation. Two source-checked timing statements describe conditions without asserting that they occurred:

- **Texas:** “The 30-day refund period runs from surrender, subject to the written forwarding-address requirement in § 92.107 and other applicable conditions and exceptions.” The existing main citation is `Tex. Prop. Code Ann. § 92.103 / § 92.109`; § 92.107 is now explicit in the timing sentence.
- **Arizona:** “The 14-day period excludes Saturdays, Sundays and legal holidays and follows termination of tenancy, delivery of possession and tenant demand, subject to applicable conditions and exceptions.” The existing citation remains `Ariz. Rev. Stat. § 33-1321(D)`.
- **Other supported states:** “Any statutory return or accounting deadline depends on the applicable triggers, conditions and exceptions.” A numeric deadline is not printed without a reviewed timing statement. This deliberately avoids turning an unreviewed registry summary into a finding that a statutory clock has started or expired. Existing reference labels/notes beside the form are unchanged and are not newly certified by this work.

The closing paragraph still demands the specified balance and an itemized statement with supporting documentation. It adds: “My requested response period does not change any statutory deadline. I reserve all remedies available under applicable law.” This replaces the generic bad-faith-damages escalation sentence without asserting an entitlement to penalties.

No new factual inputs are needed for this conditional, non-adjudicative wording. Calculating an actual legal due date or asserting overdue status would require additional facts and a separately reviewed rules design; it is outside this fix.

## Sources checked November 3, 2026

- [Arizona Legislature, A.R.S. § 33-1321(D)](https://www.azleg.gov/ars/33/01321.htm): termination, delivery of possession and tenant demand; excludes Saturdays, Sundays and legal holidays; itemization and any amount due.
- [Texas State Law Library, Security Deposits](https://guides.sll.texas.gov/landlord-tenant-law/security-deposits): quotes § 92.103's surrender-based period and § 92.107's written forwarding-address condition. The Legislature's linked Chapter 92 pages redirected to their index in the retrieval tool, so the official State Law Library was the accessible authority for this scoped check.

These checks are not a comprehensive 50-state legal audit or qualified legal approval. No statement that any customer's prerequisites or bad-faith claim is established is generated.

## Integrity and test evidence

- State-specific timing prose is stored in `STATE_STATUTES`, already part of the template content digest. The generic fallback is in the template body, also hashed. Existing current-review/availability controls remain in force; this release does not approve or enable templates through the admin policy.
- The new `depositDeadlineStatement` is renderer-owned. User overrides are stripped; shared interpolation supplies both interactive preview tokens and physical HTML. Unsupported/missing state still leaves preview placeholders and fails server input validation.
- Added six focused tests covering TX/AZ conditions, all 51 citation/demand variants, generic fallback, missing/unsupported jurisdiction, hostile derived-field overrides, React/token/print parity, and ordinary one-page fit for TX/AZ/IN/CA across all tiers. Added this file to `test:docket`.
- Focused integration run: 49 passed. TypeScript and optimized Next.js build passed. Credential hygiene passed.
- Full `npm test` reached the inherited legacy audit failure: `lib/telemetry-reporting.ts:124`, `PROCESSING_HANDWRYTTEN`, one unclassified match. Reproduced unchanged on clean baseline `8ebe329`. No telemetry or audit exceptions were modified.
- Every remaining package-script suite after that audit was run separately and passed: security, payment-mode, docket, address-intake, Stripe bootstrap, admin auth, go-live, template governance, robustness. Across the package-script runs, 281 TAP tests passed, plus the existing standalone assertion suites. All functional tests used isolated in-memory Firestore, mock payment/postal settings and a transport-denying preload.

## Staging-only release boundary

Candidate is based on current staging `8ebe329`, preserving its five commits beyond production. Read-only hosting preflight confirms `staging` auto-rollout branch and `ENVIRONMENT=staging`, project `docketstamp-staging`, public origin `https://staging.docketstamp.com`, `LOB_ENV=staging_mock_cass`.

Before deployment, staging serves `build-2026-10-29-005`; production serves `build-2026-10-28-006` from `b194386`. Push only the tested candidate to `staging`, without force; never push this review to `main`. Observe the automatic rollout before initiating another build. Record final served commit/build and public preview verification separately after completion to avoid a documentation-only rollout.

Remaining release decisions: review the staged wording, accept the physical founder letter, and explicitly authorize any production promotion or campaign launch. The national campaign remains an offline draft with provisional $150 total / seven days / $3 CPC and no dates.
