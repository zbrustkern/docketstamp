# Luna Read-Only Review — Frozen Document Integrity Evidence

## Verdict

**Conditional pass for a staging-only operational-provenance feature; do not describe the signature-adoption record as independently verified evidence of a customer interaction.** The implementation correctly hashes and stores the frozen Lob HTML and its ordinary payment/status update path retains the snapshot. The important limit is that the server receives client-controlled adoption and affirmation booleans. It can record that the request asserted adoption, but it cannot establish from this implementation that a person actually clicked the controls. The digest is also stored beside the document it hashes, so it detects accidental/content changes when compared against a trusted copy, but does not independently protect against a privileged rewrite of both fields.

No legal conclusion is made in this review.

## Findings

### Medium — Adoption record is a client assertion, not proof of the UI action

`app/api/docket/lock-and-intent/route.ts:110-124` accepts `adopted: true` and `affirmed: true` from the request body. At `:178-185`, it assigns the current server time to `adoptedAt` after receiving those booleans. The client sends them at `src/components/docket/CheckoutModal.tsx:276-280`; the UI does gate the normal path on its local adoption/affirmation state (`src/components/docket/GuidedFieldDrawer.tsx:806-835`). However, any direct caller can submit the same fields without loading that UI. The tests reject missing/false values and signer mismatch (`tests/sprint-0003-integrity-evidence.test.ts:96-108`) but do not test or prevent a forged true assertion.

The saved time therefore means “the server received a lock request carrying an affirmative assertion,” not “the server observed the user click adopt at this exact time.” Keep customer-facing wording and any future evidence view at that level, or add a server-verifiable interaction/session mechanism before presenting the record as verified adoption. This is a limitation rather than a defect in digest computation.

### Low — Digest and HTML share the same mutable order record

`src/lib/docket/integrity-evidence.ts:12-25` correctly computes lowercase SHA-256 over UTF-8 HTML. The route saves the digest and HTML together in one `Order` (`app/api/docket/lock-and-intent/route.ts:249-250`). Normal status updates only patch fields (`lib/firebase-admin.ts:579-587`), and the focused regression test checks retention after a status update (`tests/sprint-0003-integrity-evidence.test.ts:89-94`). But the persistence layer has no write-once rule for these fields: `saveOrder` uses a full-document `.set()` (`lib/firebase-admin.ts:545-555`), and a privileged writer could replace both HTML and digest. Thus this is a content digest useful for later comparison, not an independently anchored tamper-proof record. The current copy (`src/components/docket/CheckoutModal.tsx:600-602`) is narrowly worded as an “integrity digest” and says it does not assess validity; avoid stronger “immutable” or “tamper-proof” claims unless the digest is protected/anchored separately.

### Low — Implementation report is absent from the run directory

The run index lists `.delivery/runs/2026-10-19-integrity-evidence/implementation-result.md`, and the review handoff asks to inspect it, but that file was not present in the inspected run files. This review therefore cannot corroborate the implementer's claimed command results. The source and tests were inspected directly; no deployment claim is assessed here.

## Verified from source

- The SHA-256 input is `Buffer.from(frozenHtmlPayload, 'utf8')`, and the same `frozenHtmlPayload` is assigned to `documentHtml` before payment initialization (`src/lib/docket/integrity-evidence.ts:12-14`, `app/api/docket/lock-and-intent/route.ts:170-185, 249-250, 284-304`).
- The signer string must match the deterministic rendered signer (`app/api/docket/lock-and-intent/route.ts:171-176`). The browser invalidates adoption and affirmation on content edits (`src/components/docket/DocumentWorkspace.tsx:282-296`).
- The new test recomputes the digest from stored HTML, checks change sensitivity, timestamp/version fields, rejection cases, and retention through a status update (`tests/sprint-0003-integrity-evidence.test.ts:68-114`). Existing WP-2/WP-4 tests exercise renderer parity, frozen snapshot, and fulfillment compatibility; the changed requests now include the adoption fields.
- The customer copy describes the digest and date record and explicitly says it does not assess legal validity (`src/components/docket/CheckoutModal.tsx:600-602`).

## Commands inspected

- `pwd && git status --short && git diff --`
- `sed -n '1,240p' AGENTS.md; sed -n '1,240p' docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md; sed -n '1,240p' docs/DOCKETSTAMP_AGENTIC_EXPANSION.md; sed -n '1,280p' docs/sprints/SPRINT-0003.md; sed -n '1,240p' .delivery/runs/2026-10-19-integrity-evidence/handoff-luna-review.md`
- `rg --files .delivery/runs/2026-10-19-integrity-evidence tests src/lib/docket | sort`
- `nl -ba src/lib/docket/integrity-evidence.ts`
- `nl -ba app/api/docket/lock-and-intent/route.ts | sed -n '1,310p'`
- `nl -ba tests/sprint-0003-integrity-evidence.test.ts | sed -n '1,360p'`
- `sed -n '1,240p' .delivery/runs/2026-10-19-integrity-evidence/handoff-luna-implementation.md`
- `nl -ba src/components/docket/DocumentWorkspace.tsx | sed -n '270,385p'`
- `nl -ba src/components/docket/GuidedFieldDrawer.tsx | sed -n '790,835p'`
- `nl -ba src/components/docket/CheckoutModal.tsx | sed -n '245,330p;580,610p'`
- `rg -n "saveOrder|updateOrderStatus|documentHtml|documentIntegrityEvidence" lib/firebase-admin.ts app src --glob '*.ts' --glob '*.tsx'`
- `sed -n '520,620p' lib/firebase-admin.ts`
- `sed -n '1,140p' tests/s5-delivery-and-payment.test.ts`
- `sed -n '1,280p' tests/wp4-verification.test.ts`
- `sed -n '1,220p' tests/wp2-verification.test.ts`
- `sed -n '1,180p' .delivery/runs/2026-10-19-integrity-evidence/INDEX.md; sed -n '1,180p' .delivery/runs/2026-10-19-integrity-evidence/intent.md; sed -n '1,180p' .delivery/runs/2026-10-19-integrity-evidence/state.json`
- `wc -l docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md docs/DOCKETSTAMP_AGENTIC_EXPANSION.md docs/sprints/SPRINT-0003.md`
- `sed -n '241,520p' docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md; sed -n '241,520p' docs/DOCKETSTAMP_AGENTIC_EXPANSION.md`
- `git diff --stat`
- `git diff -- src/lib/docket/integrity-evidence.ts lib/types.ts tests/sprint-0003-integrity-evidence.test.ts tests/wp2-verification.test.ts tests/wp4-verification.test.ts tests/s5-delivery-and-payment.test.ts tests/s6-funnel-and-reporting.test.ts tests/s7-release-candidate.test.ts`
- `sed -n '521,620p' docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md; sed -n '100,150p' docs/DOCKETSTAMP_AGENTIC_EXPANSION.md`

The focused route tests were **not run** during this read-only review: they create and update order records through the configured Firebase adapter. No external database or provider write was attempted.
