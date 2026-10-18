# Sprint S6: Measurement, Telemetry & Funnel Reporting Specification

**Date:** October 18, 2026  
**Status:** Implemented & Verified (Sprint S6 Acceptance Gate)  
**Authority:** [DocketStamp Master Build Spec](../../DOCKETSTAMP_MASTER_BUILD_SPEC.md) · [Homepage Conversion Design Spec (v2)](../../DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md) · [Home Redesign Sprints](../../DOCKETSTAMP_HOME_REDESIGN_SPRINTS.md)

---

## 1. Executive Summary & Measurement Model

Sprint S6 instruments the end-to-end customer journey from initial discovery to server-verified payment fulfillment without collecting personal document values, raw query strings, search text, or payment secrets.

Conversion uplift is a hypothesis to be measured truthfully against historical baselines, not an invented outcome claim. Telemetry architecture enforces strict separation between client-side user intent events and server-side financial/fulfillment authority events.

### Primary Outcome Metric
- **Verified Paid Orders per Homepage Session**: Calculated as `homepagePaidOrders / homepageSessions * 100`, where:
  - `homepageSessions` are unique visitor sessions that viewed the homepage (`landing_view` with `experienceVersion: 'home_v2'`).
  - `homepagePaidOrders` are server-verified non-test orders (`status: 'PAYMENT_RECEIVED' | 'PROCESSING_DISPATCH' | 'MAILED'`, `isTest !== true`) correlated directly to that visitor's session ID.

### Supporting Outcome Metrics
- Stage-by-stage conversion and leak rates across the 7-stage micro-funnel.
- Device category distribution and drop-off (`desktop` vs `mobile` vs `tablet`).
- Entry source attribution (`home_chooser`, `companies_directory`, `recipient_prefill`, `staged_draft`, `direct_notice`, and explicit `unknown`).

---

## 2. Event Registry & Backward-Compatible Mapping

All events are ingested via `/api/telemetry` (browser events) or `recordServerTelemetry` (backend authority events). The table below documents every funnel event, exact trigger, emitter, allowlisted metadata, deduplication rule, meaning, and mapping to existing historical telemetry events:

| Stage # | Funnel Event Name | Equivalent Legacy Event | Trigger | Emitter | Safe Allowlisted Metadata | Client & Server Deduplication Rule | Semantic Meaning |
|---|---|---|---|---|---|---|---|
| **1** | `landing_view` | `landing_viewed`, `session_start` | `InteractiveHomeWorkbench` component mount on `/` | Client (Browser) | `experienceVersion`, `entrySource`, `entryRoute`, `deviceCategory` | Deduplicated per `(sessionId, 'landing_view', '', '')` | Visitor arrived on homepage v2 letter chooser |
| **2** | `product_select` | `cover_preset_selected`, `letter_select` | User clicks a letter cartridge or clicks `Continue` in `HomeLetterChooser` | Client (Browser) | `noticeSlug`, `recipientId`, `experienceVersion`, `entrySource` | Deduplicated per `(sessionId, 'product_select', noticeSlug, '')` | Visitor selected a statutory letter cartridge or continued with recipient |
| **3** | `editor_start` | `builder_started` | `/notices/[slug]` workspace mounts | Client (Browser) | `noticeSlug`, `recipientId`, `tier`, `experienceVersion`, `entrySource` | Deduplicated per `(sessionId, 'editor_start', noticeSlug, '')` | Visitor entered document workspace to fill details |
| **4** | `editor_complete` | `card_completed`, `note_completed` | All required fields valid AND signature confirmed | Client (Browser) | `noticeSlug`, `draftRevision`, `tier`, `experienceVersion`, `entrySource` | Deduplicated per `(sessionId, 'editor_complete', noticeSlug, draftRevision)` | Visitor verified all required inputs and signed the document |
| **5** | `checkout_view` | `checkout_initiated`, `payment_viewed` | `CheckoutModal` opens / tier selected | Client (Browser) | `noticeSlug`, `tier`, `amountInCents`, `experienceVersion`, `entrySource` | Deduplicated per `(sessionId, 'checkout_view', noticeSlug, '')` | Visitor initiated delivery tier review and checkout session |
| **6** | `payment_submitted` | `payment_attempted` | User advances to Step 2 card entry / submits payment | Client (Browser) | `noticeSlug`, `tier`, `orderId`, `amountInCents`, `experienceVersion`, `entrySource` | Deduplicated per `(sessionId, 'payment_submitted', noticeSlug, orderId)` | Visitor entered payment details and authorized charge |
| **7** | `order_paid_confirmed` | `purchase_verified`, `payment_succeeded` | Authoritative Stripe PaymentIntent verification in `lib/order-processor.ts` | **Server Only** | `orderId`, `paymentIntentId`, `amountInCents`, `isTest`, `paymentMode`, `noticeSlug`, `tier`, `entrySource`, `experienceVersion` | Deduplicated per `orderId` in durable `summary.paidOrderIds` | Financial transaction confirmed by Stripe processor; snapshot locked for dispatch |
| **—** | `order_fulfilled` | `fulfillment_submitted` | Lob USPS physical dispatch API confirms intake and returns tracking identifier | **Server Only** | `orderId`, `lobLetterId`, `serviceLevel` | Deduplicated per `orderId` in dispatch idempotency lock | Physical notice printed and submitted to USPS mailstream |

---

## 3. Client Authority Safeguards

To prevent telemetry poisoning, fraudulent attribution, and fabricated conversion claims:

1. **Strict Rejection of Authority Events**:
   - `isAuthorityEvent(eventName)` strictly checks for `order_paid_confirmed`, `order_fulfilled`, `purchase_verified`, `fulfillment_submitted`, and `fulfillment_failed`.
   - Any attempt to POST an authority event to the public `/api/telemetry` endpoint is immediately rejected with `HTTP 403 Forbidden` (`{ error: "Forbidden: Authority events cannot be ingested via browser telemetry" }`).
   - `ALLOWED_BROWSER_EVENT_NAMES` does not contain authority events.
2. **Client Confirmation Screen Immunity**:
   - Neither the post-payment modal confirmation screen (Step 3 in `CheckoutModal.tsx`) nor the permanent tracking page (`app/docket/[docketId]/page.tsx`) emit purchase authority events.
   - Authoritative purchase and fulfillment events are triggered strictly by backend server code (`lib/order-processor.ts`) inside Firestore atomic transactions after Stripe API verification.

---

## 4. Privacy & Sanitization Enforcement

All telemetry payloads pass through `sanitizeMetadata` (`lib/telemetry-schema.ts`):

1. **Explicit Forbidden Key Blocklist (`FORBIDDEN_METADATA_KEYS`)**:
   - Personal values (`senderFullName`, `senderAddressLine1`, `senderAddressLine2`, `senderCity`, `senderState`, `senderZip`, `recipientFormalName`, `recipientAddressLine1`, `recipientAddressLine2`, `recipientCity`, `recipientState`, `recipientZip`, `depositAmount`, `balanceRequested`, `signatureInput`, `fieldValues`, `userValues`).
   - Email addresses (`email`, `customerEmail`).
   - User query text (`searchQuery`, `query`, `search`).
   - Stage tokens and secrets (`stageId`, `stageToken`, `statusAccessToken`, `viewToken`, `token`, `secret`, `clientSecret`).
   - Raw exceptions and error messages (`rawError`, `error`, `errorMessage`).
   - Any key in `FORBIDDEN_METADATA_KEYS` is dropped unconditionally.
2. **Strict Allowlist Schema**:
   - Only primitive fields (`string`, `number`, `boolean`) defined in `COMMON_METADATA_RULES` or per-event schemas are preserved.
   - Nested objects and arrays are rejected/dropped.
3. **URL & Query String Hygiene**:
   - `path`, `referrer`, and `landingPath` are stripped of all query strings (`?...`) and hashes (`#...`) via `sanitizeUrlOrPath()`.
   - String values containing query parameters or hashes are stripped to origin/pathname.
   - Email patterns inside string values are stripped via regex.
   - Any string matching token prefixes (`tok_`, `pi_`, `cs_`, `sec_`) is redacted.

---

## 5. Deduplication Model

React 19 concurrent re-renders, client routing transitions, and browser Back/Forward navigation must not artificially inflate funnel counts:

### Client-Side Deduplication (`lib/telemetry.ts`)
- Every funnel emission computes a deterministic key:
  $$\text{dedupeKey} = \text{sessionId} : \text{eventName} : \text{noticeSlug} : \text{revisionOrOrderId}$$
- Keys are cached in an in-memory `Set<string>` and synchronized with `sessionStorage` (`docket_emitted_telemetry_keys`).
- If `isEventDeduplicated(dedupeKey)` is true, `trackFunnelEvent()` returns immediately without dispatching network requests.
- Editing draft values increments `draftRevisionRef.current`, allowing a new `editor_complete` event only after material edits are re-signed.

### Reporting-Level Deduplication (`lib/telemetry-reporting.ts`)
- `computeFunnelConversionReport()` deduplicates incoming telemetry events by `dedupeKey`, incrementing `duplicateEventsFiltered`.
- Orders are deduplicated by `order.id`, incrementing `duplicateOrdersFiltered`.

---

## 6. Reproducible Query & Reporting Recipe

The following query recipe extracts and computes the funnel conversion report from production Firestore storage:

### Query Recipe (Node.js / Cloud Function / Admin CLI)

```typescript
import { firestoreDb } from '@/lib/firebase-admin';
import { computeFunnelConversionReport } from '@/lib/telemetry';
import { TelemetryEvent, Order } from '@/lib/types';

export async function runFunnelConversionAudit(timeWindowMs: number = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - timeWindowMs;

  // 1. Fetch raw telemetry events within audit window
  const eventSnapshots = await firestoreDb
    .collection('telemetry_events')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'asc')
    .get();

  const events: TelemetryEvent[] = eventSnapshots.docs.map(
    (doc) => doc.data() as TelemetryEvent
  );

  // 2. Fetch authoritative orders within audit window
  const orderSnapshots = await firestoreDb
    .collection('orders')
    .where('createdAt', '>=', cutoff)
    .orderBy('createdAt', 'asc')
    .get();

  const orders: Order[] = orderSnapshots.docs.map(
    (doc) => doc.data() as Order
  );

  // 3. Compute deterministic funnel conversion report
  const report = computeFunnelConversionReport(events, orders, {
    experienceVersion: 'home_v2',
    excludeTestOrders: true,
  });

  console.log('=== DOCKETSTAMP HOME V2 FUNNEL CONVERSION REPORT ===');
  console.log(`Eligible Homepage Sessions: ${report.homepageSessions}`);
  console.log(`Verified Customer Paid Orders: ${report.verifiedPaidOrders}`);
  console.log(`Attributed Homepage Paid Orders: ${report.homepagePaidOrders}`);
  console.log(`Conversion Rate: ${report.conversionRate.toFixed(1)}%`);
  console.log(`Unattributed (Unknown) Paid Orders: ${report.attributionSummary.unattributedPaidOrders}`);
  console.log(`Excluded Test/Comp Orders: ${report.attributionSummary.excludedTestOrders}`);
  console.log(`Duplicate Events Filtered: ${report.attributionSummary.duplicateEventsFiltered}`);

  console.log('\n--- Stage-by-Stage Funnel Progression ---');
  report.stages.forEach((st) => {
    console.log(
      `Stage ${st.stageNumber} [${st.stageName}]: ${st.uniqueSessions} sessions ` +
      `(${st.conversionFromPrior}% from prior, drop-off: ${st.dropOffCount} / ${st.dropOffToNext}%)`
    );
  });

  console.log('\n--- Breakdown by Device Category ---');
  Object.entries(report.byDevice).forEach(([device, cohort]) => {
    console.log(
      `${device}: ${cohort.sessions} sessions, ${cohort.paidOrders} paid ` +
      `(${cohort.conversionRate.toFixed(1)}% conversion)`
    );
  });

  console.log('\n--- Breakdown by Entry Source ---');
  Object.entries(report.bySource).forEach(([source, cohort]) => {
    console.log(
      `${source}: ${cohort.sessions} sessions, ${cohort.paidOrders} paid ` +
      `(${cohort.conversionRate.toFixed(1)}% conversion)`
    );
  });

  return report;
}
```

### Attribution Gap Policy
1. **No Fabricated Uplift**: An order is only attributed to the homepage v2 cohort if its `sessionId` matches an active homepage session record.
2. **Explicit Unknown Bucket**: Orders originating from external API consumers, direct payment links, or sessions cleared by strict browser privacy settings are aggregated under `bySource['unknown']` and `unattributedPaidOrders`.
3. **Cohort Exclusions**: `isTest === true`, `paymentMode === 'stripe_test'`, `paymentMode === 'local_mock'`, and founder comp orders are excluded from customer conversion rates.

---

## 7. Automated Acceptance Checks & Evidence

All acceptance criteria are validated via automated tests in `tests/s6-funnel-and-reporting.test.ts`:

- **AC1: React Re-Render & Navigation Deduplication**:
  Verified: `computeDedupeKey` produces identical keys for identical state; `isEventDeduplicated` blocks re-emission; incrementing `draftRevision` enables new `editor_complete` tracking; `computeFunnelConversionReport` filters duplicate records.
- **AC2: Client Authority Protection**:
  Verified: `order_paid_confirmed` and `order_fulfilled` return `HTTP 403 Forbidden` if POSTed to `/api/telemetry`; authority events are excluded from `ALLOWED_BROWSER_EVENT_NAMES`.
- **AC3: Privacy Sanitization**:
  Verified: PII keys, search query text, stage tokens, secrets, and raw error messages are stripped; email patterns in strings are sanitized; query strings and hashes in URLs are stripped.
- **AC4: Synthetic Attribution & Explicit Unknown Bucket**:
  Verified: Full 7-stage synthetic session converts at 100% with correlated paid order; orphan orders land in `unattributedPaidOrders` and `bySource['unknown']`; test mode orders are excluded.
- **AC5: Device & Source Drop-Off Breakdown**:
  Verified: Desktop vs mobile cohorts accurately aggregate sessions and drop-offs across stages; all 5 entry sources are categorized without claiming false AI provenance.
- **AC6: System Invariants**:
  Verified: `NAICS 713940` blocker verified in `lock-and-intent`; freeze-before-pay snapshot persists `telemetrySessionId`, `experienceVersion`, and `entrySource`.
