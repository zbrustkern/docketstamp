# Sprint 0003 — Frozen Document Integrity Evidence

**Status:** Complete — deployed to staging  
**Run:** `2026-10-19-integrity-evidence`  
**Source revision:** `17ad41d4020ce1b136eb93181c4c70a822be3c31`  
**Participants:** Codex coordinator; Luna implementation and read-only review

## Pyramid index

1. Objective and product boundary
2. Evidence model and write path
3. Customer interaction and truthful copy
4. Tests, release gates, and risks

## Objective

Make DocketStamp's already frozen pre-payment Lob payload tamper-evident and
associate it with a narrow record of the customer's typed-name/affirmation
adoption. The result is an operational record of preparation and dispatch,
not legal advice, a determination of enforceability, or an e-signature service.

## Source context

- `AGENTS.md` and `docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md`, invariant 5,
  require immutable freeze-before-pay HTML and fulfillment from that snapshot.
- `lock-and-intent` stores the frozen payload before Stripe intent creation,
  but today has no digest or persisted signature-adoption facts.
- The UI prevents adoption without typed name and affirmation, but only local
  state holds that fact today.
- Lob/USPS outcomes remain external evidence represented by existing Lob ID,
  tracking, mailed, event, and return-receipt fields.

## Scope and non-goals

Included: server-calculated SHA-256 integrity fields, server timestamped
signature/affirmation assertion, order type contract, client request plumbing,
truthful copy, focused tests, and staging rollout.

Excluded: hand-drawn or image signatures, DocuSign/notary features, public
evidence downloads, retention/backfill policy changes, production rollout, and
any live postal/payment test.

## Design decisions

| Decision | Rationale |
| --- | --- |
| Hash the final `renderLobHtmlPayload()` string as UTF-8 on the server | Binds the digest to precisely what the fulfillment path receives. |
| Store `sha256`, algorithm name, and schema version | Allows later verification without claiming more than a content digest. |
| Store server-generated lock/adoption timestamp | A browser time is not authoritative. |
| Store typed name and stable affirmation version, not raw prose | Provides audit context while avoiding duplicate content and uncontrolled PII expansion. |
| Validate adoption assertion at the route | UI guards alone do not make an operational record trustworthy. |
| Preserve existing Lob identifiers/evidence fields | The digest proves payload identity; Lob/USPS evidence proves provider events. |

## Ordered tasks and dependencies

1. **Evidence contract** — Add a narrowly typed immutable integrity structure to
   `Order`, including digest, algorithm, evidence schema/version, lock time,
   typed signer, adoption timestamp, and affirmation version. Define a small
   server-only integrity helper if useful. Depends on none.
2. **Authoritative lock** — In `lock-and-intent`, validate an explicit adoption
   assertion, match its typed signer to the deterministic document signer,
   render the final HTML, hash its UTF-8 bytes with SHA-256, and persist all
   integrity fields with the initial order before creating a payment intent.
   Never accept a browser hash or browser timestamp. Depends on task 1.
3. **Client assertion** — Carry `isSignatureAdopted`, the affirmation state, and
   typed signer through the existing adoption flow to checkout. Do not weaken
   re-review invalidation on edits. Depends on task 2's route contract.
4. **Truthful copy** — Replace the current unsupported SHA-256 statement with
   narrow copy that reflects the implemented record and makes no legal claim.
   Depends on task 2.
5. **Regression tests** — Test successful creation; recomputing stored digest
   from stored HTML; digest sensitivity; missing/false adoption; signer
   mismatch; required server timestamp/version; and that expected Lob fields
   remain compatible. Run existing safety suites. Depends on tasks 1–4.
6. **Review and release** — Luna read-only review, coordinator diff/test review,
   commit, push `HEAD:staging`, trigger Firebase staging rollout for exact SHA,
   and record deployment evidence. Depends on task 5.

## Acceptance criteria

1. The persisted `Order` contains a SHA-256 digest of exactly the frozen HTML,
   an explicit algorithm, and a versioned integrity schema.
2. The route only creates this record after a true adoption/affirmation
   assertion and a matching typed signer; it stamps adoption/lock time itself.
3. No normal update path overwrites frozen HTML or integrity fields; payment and
   Lob status updates retain them.
4. The customer sees no legal-validity, DocuSign, notary, or recipient-acceptance
   claim. SHA-256 language becomes accurate only after it exists.
5. Existing deterministic interpolation, document geometry, UPL footer, NAICS
   blocker, and staging/production Lob key separation are unchanged.
6. Focused tests and applicable `test:security`, `test:payment-mode`, and
   docket verification pass. Full build/type failures are reported accurately,
   not waived or hidden.
7. Only `origin/staging` and Firebase `docketstamp-staging` are changed;
   `origin/main` remains untouched.

## Validation plan

- Unit/route test with a complete valid security-deposit notice and mock payment
  mode; recompute SHA-256 from `order.documentHtml` and compare exactly.
- Repeat with altered snapshot input and prove a different hash.
- Assert missing/false adoption and signer mismatch receive a 400 response
  before persistence/payment initialization.
- Run focused new test plus `npm run test:security`, `npm run test:payment-mode`,
  and `npm run test:docket`; run build if feasible and record exact result.
- Inspect `git diff`, staging ref, Firebase rollout source SHA, and non-prod
  endpoint availability without submitting payment or mail.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A hash is mistaken for legal proof | Copy and docs call it an integrity/provenance record only. |
| Client lies about adoption | Server validates its assertion, matches signer to rendered content, and owns timestamp/hash. |
| Future status update modifies the snapshot | Keep integrity fields out of ordinary updates; regression test retention. |
| Digest mismatch due to encoding | Hash `Buffer.from(frozenHtmlPayload, 'utf8')` and test that exact operation. |
| Sensitive audit expansion | Store minimal facts; no IP/device fingerprint or raw repeated affirmation prose. |
| Release affects production | Push/ref/rollout commands explicitly target staging only. |

## Review provenance

Planning is local Codex synthesis from repository code and governing
specifications. Luna will implement and then perform a separate read-only review
of the completed diff; coordinator verification remains independent and is
recorded in the run evidence. No legal validation is part of this sprint.

## Completion and release evidence

- Commit `61271f2ba6eac0937f9e8aa28e8e52aa93b2293d` passed the focused integrity
  suite (4/4), WP-2/WP-4 parity and fulfillment suites, security (10/10),
  payment-mode (26/26), telemetry, and `npm run build`.
- `npm run test:docket` retains one unrelated historical CASS HTML assertion
  failure (`tests/docket-engine.test.ts:481`; 22/23 pass). `npx tsc --noEmit`
  retains existing repository-wide missing-module/test-contract failures.
- The commit was pushed directly from `HEAD` to `origin/staging`; remote main
  remained at `b97551226aec144d469ca18b01ebc139df66f95c`.
- Firebase App Hosting accepted a rollout for the exact commit to backend
  `docketstamp` in `docketstamp-staging`, `us-central1`, environment `staging`.
  Backend metadata later reported `reconciling: false`, and
  `https://staging.docketstamp.com` returned HTTP 200.
- No production ref, environment, secret, live payment, or live postal
  dispatch was changed.
