import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  isAuthorityEvent,
  AUTHORITY_EVENTS,
  ALLOWED_BROWSER_EVENT_NAMES,
  sanitizeMetadata,
  FORBIDDEN_METADATA_KEYS,
  sanitizeUrlOrPath,
} from '../lib/telemetry-schema';
import {
  computeDedupeKey,
  isEventDeduplicated,
  markEventDeduplicated,
  resetDeduplicationState,
  computeFunnelConversionReport,
  isTestOrCompOrder,
} from '../lib/telemetry';
import { POST as telemetryPost } from '../app/api/telemetry/route';
import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { recordServerTelemetry } from '../lib/metrics-rollup';
import { TelemetryEvent, Order } from '../lib/types';
import { getOrderById } from '../lib/firebase-admin';

// Enable mock stripe payment mode in test environment
process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';

describe('S6 Funnel Telemetry & Reporting Acceptance Gate', () => {
  beforeEach(() => {
    resetDeduplicationState();
  });

  // ==========================================================================
  // GATE 1: Deduplication & React Re-render Immunity
  // ==========================================================================
  describe('1. Deduplication & React Re-render Immunity', () => {
    it('computes deterministic deduplication key from (sessionId, eventName, noticeSlug, revision/order)', () => {
      const key1 = computeDedupeKey('sess_100', 'landing_view', undefined, undefined);
      assert.equal(key1, 'sess_100:landing_view::');

      const key2 = computeDedupeKey('sess_100', 'product_select', 'security-deposit-return-demand-letter');
      assert.equal(key2, 'sess_100:product_select:security-deposit-return-demand-letter:');

      const key3 = computeDedupeKey('sess_100', 'editor_complete', 'security-deposit-return-demand-letter', 2);
      assert.equal(key3, 'sess_100:editor_complete:security-deposit-return-demand-letter:2');

      const key4 = computeDedupeKey('sess_100', 'payment_submitted', 'security-deposit-return-demand-letter', 'order_abc123');
      assert.equal(key4, 'sess_100:payment_submitted:security-deposit-return-demand-letter:order_abc123');
    });

    it('prevents repeated in-memory and session emissions of the same dedupeKey', () => {
      const dedupeKey = computeDedupeKey('sess_200', 'product_select', 'fcra-credit-bureau-written-dispute-letter');
      assert.equal(isEventDeduplicated(dedupeKey), false);

      markEventDeduplicated(dedupeKey);
      assert.equal(isEventDeduplicated(dedupeKey), true);

      // Re-querying dedupe key remains true (idempotent)
      assert.equal(isEventDeduplicated(dedupeKey), true);
    });

    it('allows a new editor_complete emission when draftRevision increments after editing', () => {
      const rev1Key = computeDedupeKey('sess_300', 'editor_complete', 'security-deposit-return-demand-letter', 1);
      const rev2Key = computeDedupeKey('sess_300', 'editor_complete', 'security-deposit-return-demand-letter', 2);

      markEventDeduplicated(rev1Key);
      assert.equal(isEventDeduplicated(rev1Key), true);
      // New revision is NOT yet deduplicated
      assert.equal(isEventDeduplicated(rev2Key), false);

      markEventDeduplicated(rev2Key);
      assert.equal(isEventDeduplicated(rev2Key), true);
    });

    it('report engine filters duplicate events and reports duplicateEventsFiltered count', () => {
      const baseEvent: TelemetryEvent = {
        id: 'evt_1',
        sessionId: 'sess_dedupe_test',
        eventName: 'landing_view',
        path: '/',
        timestamp: Date.now(),
        createdAt: Date.now(),
        experienceVersion: 'home_v2',
      };

      // 3 duplicate events with identical session and eventName
      const report = computeFunnelConversionReport([baseEvent, { ...baseEvent, id: 'evt_2' }, { ...baseEvent, id: 'evt_3' }]);
      assert.equal(report.homepageSessions, 1);
      assert.equal(report.attributionSummary.duplicateEventsFiltered, 2);
      assert.equal(report.stages[0].uniqueSessions, 1);
    });
  });

  // ==========================================================================
  // GATE 2: Browser Authority Protection & Client Confirmation Gate
  // ==========================================================================
  describe('2. Browser Authority Protection & Client Confirmation Gate', () => {
    it('classifies order_paid_confirmed, order_fulfilled, purchase_verified, and fulfillment_* as authority events', () => {
      assert.equal(isAuthorityEvent('order_paid_confirmed'), true);
      assert.equal(isAuthorityEvent('order_fulfilled'), true);
      assert.equal(isAuthorityEvent('purchase_verified'), true);
      assert.equal(isAuthorityEvent('payment_succeeded'), true);
      assert.equal(isAuthorityEvent('fulfillment_submitted'), true);
      assert.equal(isAuthorityEvent('fulfillment_failed'), true);

      // Non-authority browser events
      assert.equal(isAuthorityEvent('landing_view'), false);
      assert.equal(isAuthorityEvent('product_select'), false);
      assert.equal(isAuthorityEvent('editor_start'), false);
      assert.equal(isAuthorityEvent('editor_complete'), false);
      assert.equal(isAuthorityEvent('checkout_view'), false);
      assert.equal(isAuthorityEvent('payment_submitted'), false);
    });

    it('strictly forbids authority events from ALLOWED_BROWSER_EVENT_NAMES', () => {
      assert.equal(ALLOWED_BROWSER_EVENT_NAMES.has('order_paid_confirmed' as any), false);
      assert.equal(ALLOWED_BROWSER_EVENT_NAMES.has('order_fulfilled' as any), false);
      assert.equal(ALLOWED_BROWSER_EVENT_NAMES.has('purchase_verified' as any), false);
      assert.equal(ALLOWED_BROWSER_EVENT_NAMES.has('payment_succeeded' as any), false);
    });

    it('rejects browser POST of order_paid_confirmed to /api/telemetry with HTTP 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'order_paid_confirmed',
          sessionId: 'sess_spoof_attempt_1',
          orderId: 'order_fake_123',
        }),
      });

      const res = await telemetryPost(req);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Forbidden: Authority events cannot be ingested/i);
    });

    it('rejects browser POST of order_fulfilled to /api/telemetry with HTTP 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'order_fulfilled',
          sessionId: 'sess_spoof_attempt_2',
          orderId: 'order_fake_456',
        }),
      });

      const res = await telemetryPost(req);
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /Forbidden: Authority events cannot be ingested/i);
    });

    it('accepts legitimate browser funnel events (landing_view, product_select, editor_start, etc.)', async () => {
      const validEvents = ['landing_view', 'product_select', 'editor_start', 'editor_complete', 'checkout_view', 'payment_submitted'];

      for (const eventName of validEvents) {
        const req = new NextRequest('http://localhost:3000/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName,
            sessionId: `sess_legit_${eventName}`,
            noticeSlug: 'security-deposit-return-demand-letter',
            experienceVersion: 'home_v2',
            entrySource: 'home_chooser',
          }),
        });

        const res = await telemetryPost(req);
        assert.equal(res.status, 200, `Expected 200 for event ${eventName}`);
        const data = await res.json();
        assert.equal(data.received, true);
        assert.ok(data.eventId);
      }
    });
  });

  // ==========================================================================
  // GATE 3: Strict Privacy Sanitization & PII Stripping
  // ==========================================================================
  describe('3. Strict Privacy Sanitization & PII Stripping', () => {
    it('completely drops all personal data keys from metadata', () => {
      const dirtyMetadata = {
        senderFullName: 'Jane Smith',
        senderAddressLine1: '123 Main St',
        senderCity: 'Los Angeles',
        senderState: 'CA',
        senderZip: '90001',
        recipientFormalName: 'Acme Landlord LLC',
        recipientAddressLine1: '456 Landlord Blvd',
        email: 'tenant@example.com',
        customerEmail: 'tenant@example.com',
        depositAmount: '$2,500.00',
        signatureInput: 'Jane Smith Signature',
        fieldValues: { someField: 'secret' },
        userValues: { anotherField: 'secret' },
        // Safe key
        noticeSlug: 'security-deposit-return-demand-letter',
        entrySource: 'home_chooser',
      };

      const { sanitized } = sanitizeMetadata('product_select', dirtyMetadata);

      assert.equal(sanitized.senderFullName, undefined);
      assert.equal(sanitized.senderAddressLine1, undefined);
      assert.equal(sanitized.recipientFormalName, undefined);
      assert.equal(sanitized.recipientAddressLine1, undefined);
      assert.equal(sanitized.email, undefined);
      assert.equal(sanitized.customerEmail, undefined);
      assert.equal(sanitized.depositAmount, undefined);
      assert.equal(sanitized.signatureInput, undefined);
      assert.equal(sanitized.fieldValues, undefined);
      assert.equal(sanitized.userValues, undefined);

      // Safe keys preserved
      assert.equal(sanitized.noticeSlug, 'security-deposit-return-demand-letter');
      assert.equal(sanitized.entrySource, 'home_chooser');
    });

    it('drops search query text, stage tokens, secrets, and raw error messages', () => {
      const dirtyMetadata = {
        searchQuery: 'landlord kept my deposit',
        query: 'deposit return',
        search: 'Equifax',
        stageId: 'stage_token_1234567890',
        stageToken: 'tok_secret_stage_abc',
        statusAccessToken: 'tok_status_access_xyz',
        viewToken: 'tok_view_token_private',
        token: 'secret_bearer_token',
        secret: 'sk_live_stripe_secret',
        clientSecret: 'pi_3MtwBwLkdCwrmPXv0kX_secret_test',
        rawError: 'StripeCardError: card declined at endpoint',
        error: 'Failed to charge card',
        errorMessage: 'Network timeout',
        tier: 'certified',
      };

      const { sanitized } = sanitizeMetadata('checkout_view', dirtyMetadata);

      assert.equal(sanitized.searchQuery, undefined);
      assert.equal(sanitized.query, undefined);
      assert.equal(sanitized.search, undefined);
      assert.equal(sanitized.stageId, undefined);
      assert.equal(sanitized.stageToken, undefined);
      assert.equal(sanitized.statusAccessToken, undefined);
      assert.equal(sanitized.viewToken, undefined);
      assert.equal(sanitized.token, undefined);
      assert.equal(sanitized.secret, undefined);
      assert.equal(sanitized.clientSecret, undefined);
      assert.equal(sanitized.rawError, undefined);
      assert.equal(sanitized.error, undefined);
      assert.equal(sanitized.errorMessage, undefined);

      assert.equal(sanitized.tier, 'certified');
    });

    it('strips emails, tokens, and query strings from allowed string values', () => {
      const metadata = {
        entrySource: 'home_chooser?utm_source=evil&email=user@test.com',
        noticeSlug: 'security-deposit-return-demand-letter',
      };

      const { sanitized } = sanitizeMetadata('product_select', metadata);
      assert.ok(!String(sanitized.entrySource).includes('user@test.com'));
      assert.ok(!String(sanitized.entrySource).includes('?'));
    });

    it('sanitizeUrlOrPath strips query parameters and hashes completely', () => {
      const clean1 = sanitizeUrlOrPath('/notices/security-deposit?field.depositAmount=$2000&viewToken=SECRET#signature');
      assert.equal(clean1, '/notices/security-deposit');

      const clean2 = sanitizeUrlOrPath('https://docketstamp.com/notices/fcra-dispute?accountNumber=123456');
      assert.equal(clean2, 'https://docketstamp.com/notices/fcra-dispute');
    });
  });

  // ==========================================================================
  // GATE 4: Synthetic Funnel Progression & Attribution Correlation
  // ==========================================================================
  describe('4. Synthetic Funnel Progression & Attribution Correlation', () => {
    it('correlates a 7-stage synthetic session with one authoritative paid order', () => {
      const sessionId = 'sess_synthetic_funnel_1';
      const orderId = 'order_synthetic_100';

      const events: TelemetryEvent[] = [
        {
          id: 'evt_syn_1',
          sessionId,
          eventName: 'landing_view',
          path: '/',
          timestamp: 1000,
          createdAt: 1000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
        {
          id: 'evt_syn_2',
          sessionId,
          eventName: 'product_select',
          noticeSlug: 'security-deposit-return-demand-letter',
          path: '/',
          timestamp: 2000,
          createdAt: 2000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
        {
          id: 'evt_syn_3',
          sessionId,
          eventName: 'editor_start',
          noticeSlug: 'security-deposit-return-demand-letter',
          path: '/notices/security-deposit-return-demand-letter',
          timestamp: 3000,
          createdAt: 3000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
        {
          id: 'evt_syn_4',
          sessionId,
          eventName: 'editor_complete',
          noticeSlug: 'security-deposit-return-demand-letter',
          draftRevision: 1,
          path: '/notices/security-deposit-return-demand-letter',
          timestamp: 4000,
          createdAt: 4000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
        {
          id: 'evt_syn_5',
          sessionId,
          eventName: 'checkout_view',
          noticeSlug: 'security-deposit-return-demand-letter',
          tier: 'certified',
          path: '/notices/security-deposit-return-demand-letter',
          timestamp: 5000,
          createdAt: 5000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
        {
          id: 'evt_syn_6',
          sessionId,
          eventName: 'payment_submitted',
          noticeSlug: 'security-deposit-return-demand-letter',
          tier: 'certified',
          orderId,
          path: '/notices/security-deposit-return-demand-letter',
          timestamp: 6000,
          createdAt: 6000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'desktop',
        },
      ];

      const orders: Order[] = [
        {
          id: orderId,
          customerEmail: 'customer@test.com',
          sessionId,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          amountInCents: 1995,
          finalAmountInCents: 1995,
          status: 'MAILED',
          serviceLevel: 'CERTIFIED',
          recipientAddress: { firstName: 'Landlord', lastName: '', street1: '123 St', city: 'City', state: 'CA', zip: '90001' },
          returnAddress: { firstName: 'Tenant', lastName: '', street1: '456 St', city: 'City', state: 'CA', zip: '90001' },
          createdAt: 7000,
          updatedAt: 7000,
        },
      ];

      const report = computeFunnelConversionReport(events, orders);

      assert.equal(report.homepageSessions, 1);
      assert.equal(report.verifiedPaidOrders, 1);
      assert.equal(report.homepagePaidOrders, 1);
      assert.equal(report.conversionRate, 100);

      // Verify all 7 stages reached
      assert.equal(report.stages.length, 7);
      report.stages.forEach((st) => {
        assert.equal(st.uniqueSessions, 1, `Stage ${st.stageName} must have 1 unique session`);
      });

      assert.equal(report.attributionSummary.attributedPaidOrders, 1);
      assert.equal(report.attributionSummary.unattributedPaidOrders, 0);
    });

    it('assigns orders with no matching telemetry session to explicit unattributed and unknown buckets', () => {
      const events: TelemetryEvent[] = [
        {
          id: 'evt_known',
          sessionId: 'sess_known',
          eventName: 'landing_view',
          path: '/',
          timestamp: 1000,
          createdAt: 1000,
          experienceVersion: 'home_v2',
          entrySource: 'home_chooser',
          deviceType: 'mobile',
        },
      ];

      // Order with orphan / non-telemetry session
      const orders: Order[] = [
        {
          id: 'order_orphan_999',
          customerEmail: 'orphan@test.com',
          sessionId: 'sess_untracked_external',
          amountInCents: 1995,
          status: 'MAILED',
          recipientAddress: { firstName: 'Recipient', lastName: '', street1: '1 St', city: 'City', state: 'CA', zip: '90001' },
          returnAddress: { firstName: 'Sender', lastName: '', street1: '2 St', city: 'City', state: 'CA', zip: '90001' },
          createdAt: 2000,
          updatedAt: 2000,
        },
      ];

      const report = computeFunnelConversionReport(events, orders);

      assert.equal(report.homepageSessions, 1);
      assert.equal(report.verifiedPaidOrders, 1);
      assert.equal(report.homepagePaidOrders, 0, 'Orphan order must NOT be credited as homepage paid order');
      assert.equal(report.conversionRate, 0);

      // Explicit attribution summary accounting
      assert.equal(report.attributionSummary.attributedPaidOrders, 0);
      assert.equal(report.attributionSummary.unattributedPaidOrders, 1);

      // Explicit unknown cohort accounting
      assert.equal(report.bySource['unknown']?.paidOrders, 1);
    });

    it('strictly excludes test mode and comp orders from verified customer paid counts', () => {
      const testOrders: Array<Partial<Order>> = [
        { isTest: true },
        { isComp: true },
        { isFounderTest: true },
        { paymentMode: 'stripe_test' },
        { paymentMode: 'local_mock' },
        { paymentMethod: 'STUDIO_COMP' },
        { customerEmail: 'founder-test@docketstamp.com' },
      ];

      for (const order of testOrders) {
        assert.equal(isTestOrCompOrder(order as Order), true, `Order ${JSON.stringify(order)} should be identified as test`);
      }

      const report = computeFunnelConversionReport(
        [],
        testOrders.map((o, idx) => ({
          id: `order_test_${idx}`,
          customerEmail: 'test@example.com',
          amountInCents: 1995,
          status: 'MAILED',
          recipientAddress: { firstName: 'A', lastName: '', street1: '1', city: 'C', state: 'CA', zip: '90001' },
          returnAddress: { firstName: 'B', lastName: '', street1: '2', city: 'C', state: 'CA', zip: '90001' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...o,
        })) as Order[]
      );

      assert.equal(report.verifiedPaidOrders, 0);
      assert.equal(report.homepagePaidOrders, 0);
      assert.equal(report.attributionSummary.excludedTestOrders, testOrders.length);
    });
  });

  // ==========================================================================
  // GATE 5: Device & Entry Source Breakdown & Stage Drop-off
  // ==========================================================================
  describe('5. Device & Entry Source Breakdown & Stage Drop-off', () => {
    it('computes accurate stage drop-off and breakdown by desktop and mobile device categories', () => {
      const events: TelemetryEvent[] = [
        // Desktop user completes all 3 steps
        {
          id: 'evt_d1',
          sessionId: 'sess_desktop_1',
          eventName: 'landing_view',
          deviceType: 'desktop',
          entrySource: 'home_chooser',
          path: '/',
          timestamp: 1,
          createdAt: 1,
          experienceVersion: 'home_v2',
        },
        {
          id: 'evt_d2',
          sessionId: 'sess_desktop_1',
          eventName: 'product_select',
          deviceType: 'desktop',
          entrySource: 'home_chooser',
          path: '/',
          timestamp: 2,
          createdAt: 2,
          experienceVersion: 'home_v2',
        },
        {
          id: 'evt_d3',
          sessionId: 'sess_desktop_1',
          eventName: 'editor_start',
          deviceType: 'desktop',
          entrySource: 'home_chooser',
          path: '/notices/abc',
          timestamp: 3,
          createdAt: 3,
          experienceVersion: 'home_v2',
        },

        // Mobile user drops off after landing_view
        {
          id: 'evt_m1',
          sessionId: 'sess_mobile_drop',
          eventName: 'landing_view',
          deviceType: 'mobile',
          entrySource: 'home_chooser',
          path: '/',
          timestamp: 4,
          createdAt: 4,
          experienceVersion: 'home_v2',
        },
      ];

      const report = computeFunnelConversionReport(events, []);

      assert.equal(report.homepageSessions, 2);
      assert.equal(report.byDevice.desktop.sessions, 1);
      assert.equal(report.byDevice.mobile.sessions, 1);

      // Mobile user dropped off at landing_view
      assert.equal(report.byDevice.mobile.stageDropOff['landing_view'], 1);
      // Desktop user reached editor_start
      assert.equal(report.byDevice.desktop.stageDropOff['editor_start'], 1);
    });

    it('correctly maps all 5 supported entry sources without falsely claiming AI agent provenance', () => {
      const sources: Array<TelemetryEvent['entrySource']> = [
        'home_chooser',
        'companies_directory',
        'recipient_prefill',
        'staged_draft',
        'direct_notice',
      ];

      const events: TelemetryEvent[] = sources.map((src, idx) => ({
        id: `evt_src_${idx}`,
        sessionId: `sess_src_${idx}`,
        eventName: 'landing_view',
        entrySource: src,
        path: '/',
        timestamp: idx * 10,
        createdAt: idx * 10,
        experienceVersion: 'home_v2',
      }));

      const report = computeFunnelConversionReport(events, []);

      for (const src of sources) {
        assert.ok(report.bySource[src!], `Cohort ${src} must exist in bySource`);
        assert.equal(report.bySource[src!].sessions, 1);
      }
    });
  });

  // ==========================================================================
  // GATE 6: Lock-and-Intent & Order Processor Telemetry Propagation
  // ==========================================================================
  describe('6. Lock-and-Intent & Order Processor Telemetry Propagation', () => {
    it('persists telemetrySessionId, experienceVersion, and entrySource on the order snapshot', async () => {
      const validPayload = {
        slug: 'security-deposit-return-demand-letter',
        userValues: {
          senderFullName: 'Alex Mercer',
          senderAddressLine1: '100 Main St',
          senderCity: 'Los Angeles',
          senderState: 'CA',
          senderZip: '90001',
          recipientFormalName: 'Skyline Management',
          recipientAddressLine1: '200 Wilshire Blvd',
          recipientCity: 'Los Angeles',
          recipientState: 'CA',
          recipientZip: '90012',
          propertyState: 'CA',
          vacatedPremisesAddress: '100 Main St, Los Angeles, CA 90001',
          moveOutDate: '2026-03-31',
          depositAmount: '$2,000.00',
          amountReceivedToDate: '$0.00',
          balanceRequested: '$2,000.00',
          responseDays: '14 calendar days',
        },
        tier: 'first_class',
        customerEmail: 'alex@example.com',
        signatureAdoption: { adopted: true, affirmed: true, signerName: 'Alex Mercer' },
        telemetrySessionId: 'sess_lock_propagation_test',
        experienceVersion: 'home_v2',
        entrySource: 'home_chooser',
      };

      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.orderId);

      const savedOrder = await getOrderById(data.orderId);
      assert.ok(savedOrder);
      assert.equal(savedOrder.sessionId, 'sess_lock_propagation_test');
      assert.equal(savedOrder.telemetrySessionId, 'sess_lock_propagation_test');
      assert.equal(savedOrder.experienceVersion, 'home_v2');
      assert.equal(savedOrder.entrySource, 'home_chooser');
    });

    it('enforces Invariant 1 NAICS 713940 fitness blocker in lock-and-intent', async () => {
      const fitnessPayload = {
        slug: 'security-deposit-return-demand-letter',
        userValues: {
          senderFullName: 'Alex Mercer',
          recipientFormalName: 'Equinox Fitness Club',
          senderAddressLine1: '100 Main St',
          senderCity: 'Los Angeles',
          senderState: 'CA',
          senderZip: '90001',
          recipientAddressLine1: '200 Wilshire Blvd',
          recipientCity: 'Los Angeles',
          recipientState: 'CA',
          recipientZip: '90012',
          propertyState: 'CA',
          vacatedPremisesAddress: '100 Main St, Los Angeles, CA 90001',
          moveOutDate: '2026-03-31',
          depositAmount: '$2,000.00',
          amountReceivedToDate: '$0.00',
          balanceRequested: '$2,000.00',
          responseDays: '14 calendar days',
        },
      };

      const req = new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fitnessPayload),
      });

      const res = await lockAndIntentPost(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'CONFLICT_OF_INTEREST');
      assert.equal(data.category, 'PROHIBITED_NAICS_713940');
    });
  });
});
