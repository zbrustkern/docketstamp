import test from 'node:test';
import assert from 'node:assert/strict';

const NOTICE_ID = 'security-deposit-accounting-request';
const SESSION_KEY = 'docketstamp_telemetry_session_v1';
const ATTRIBUTION_KEY = 'docketstamp_attribution_v1';
const MILESTONES_KEY = 'docketstamp_business_milestones_v1';
const QUEUE_KEY = 'docketstamp_business_events_v1';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

function count(collection: FirebaseFirestore.CollectionReference) {
  return collection.get().then(snapshot => snapshot.size);
}

test('offline browser → collector → verified capture and accepted mail → published report', async () => {
  // The real code paths below run in a process whose network clients are denied by
  // offline-preload.cjs and whose Firestore adapter is memory-only. These are fake
  // provider facts; no payment or mail provider is contacted.
  const oldEnvironment = process.env.ENVIRONMENT;
  const oldStripeKey = process.env.STRIPE_SECRET_KEY;
  const oldClientEnvironment = process.env.NEXT_PUBLIC_ENVIRONMENT;
  process.env.ENVIRONMENT = 'staging';
  process.env.NEXT_PUBLIC_ENVIRONMENT = 'staging';
  process.env.STRIPE_SECRET_KEY = 'sk_live_telemetry_fixture_only';

  const session = new MemoryStorage();
  const local = new MemoryStorage();
  const listeners: Array<() => void> = [];
  const previousFetch = globalThis.fetch;
  const previousGlobals = ['window', 'sessionStorage', 'localStorage', 'navigator', 'document'] as const;
  const descriptors = new Map(previousGlobals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));

  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener: (_name: string, listener: () => void) => listeners.push(listener),
    sessionStorage: session,
    localStorage: local,
  } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, globalPrivacyControl: false } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    addEventListener: () => {},
    visibilityState: 'visible',
  } });

  try {
    const [{ NextRequest }, { firestoreDb }, { POST }, { emitBusinessEvent, flushBusinessEventQueue }, { recordAttributionTouch }] = await Promise.all([
      import('next/server'),
      import('@/lib/firebase-admin'),
      import('@/app/api/telemetry/route'),
      import('@/lib/admin-console/measurement/client'),
      import('@/lib/admin-console/measurement/attribution'),
    ]);
    const [{ recordPaymentAuthority, computeOrderSnapshotHash }, { claimDispatchAttempt, finishDispatchAttempt }, { appendServerBusinessEvent }, { prepareGeneration, publishGeneration, readGeneration, readEvidence }, { calendarScope }] = await Promise.all([
      import('@/lib/admin-console/finance/authority'),
      import('@/lib/admin-console/postal/attempt-store'),
      import('@/lib/admin-console/measurement/server-events'),
      import('@/lib/admin-console/reporting/store'),
      import('@/lib/admin-console/reporting/scope'),
    ]);

    const browserBodies: Array<Record<string, unknown>> = [];
    const collectorResponses: Array<{ eventName: unknown; status: number }> = [];
    let inducedNetworkFailures = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const bodyText = String(init?.body || '{}');
      const body = JSON.parse(bodyText) as Record<string, unknown>;
      browserBodies.push(body);
      if (body.eventName === 'entry_viewed' && inducedNetworkFailures === 0) {
        inducedNetworkFailures++;
        return new Response('', { status: 503 });
      }
      const request = new NextRequest('https://staging.docketstamp.com/api/telemetry', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.42',
          'user-agent': 'Mozilla/5.0 telemetry-integration-fixture',
        },
        body: bodyText,
      });
      const response = await POST(request);
      collectorResponses.push({ eventName: body.eventName, status: response.status });
      return response;
    }) as typeof fetch;

    const visitors = [
      { orderId: 'fixture_customer_campaign_a', sessionId: 'fixture_session_customer_a', journeyId: 'fixture_journey_customer_a', campaignId: 'experiment_a', classification: 'customer' as const, accepted: true },
      { orderId: 'fixture_customer_campaign_b', sessionId: 'fixture_session_customer_b', journeyId: 'fixture_journey_customer_b', campaignId: 'experiment_b', classification: 'customer' as const, accepted: false },
      { orderId: 'fixture_founder_qa', sessionId: 'fixture_session_founder', journeyId: 'fixture_journey_founder', campaignId: 'experiment_a', classification: 'founder' as const, accepted: true },
    ];
    const browserMilestones = ['entry_viewed', 'notice_selected', 'workspace_viewed', 'details_ready', 'signature_adopted'] as const;

    const selectVisitor = (visitor: typeof visitors[number]) => {
      session.setItem(SESSION_KEY, visitor.sessionId);
      session.setItem(`docketstamp_journey_v1:${NOTICE_ID}`, visitor.journeyId);
      session.removeItem(ATTRIBUTION_KEY);
      local.removeItem(ATTRIBUTION_KEY);
      recordAttributionTouch({
        pathname: `/notices/${NOTICE_ID}`,
        source: 'google',
        medium: 'cpc',
        campaign: visitor.campaignId,
      });
    };
    const emit = (visitor: typeof visitors[number], eventName: string, orderId?: string) => {
      selectVisitor(visitor);
      emitBusinessEvent({
        eventName,
        noticeId: NOTICE_ID,
        tier: 'certified',
        entrySurface: 'notice_workspace',
        checkoutAttemptId: `fixture_checkout_${visitor.orderId}`,
        ...(orderId ? { orderId } : {}),
      });
    };
    const waitForClientDrain = async (minimumRequests: number) => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const queue = JSON.parse(session.getItem(QUEUE_KEY) || '[]') as unknown[];
        if (queue.length === 0 && browserBodies.length >= minimumRequests) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      const queue = JSON.parse(session.getItem(QUEUE_KEY) || '[]') as Array<{ envelope?: { eventName?: string }; attempts?: number }>;
      throw new Error(`CLIENT_QUEUE_DID_NOT_DRAIN:${JSON.stringify({ requests: browserBodies.length, queued: queue.map(row => [row.envelope?.eventName, row.attempts]), responses: collectorResponses })}`);
    };

    for (const visitor of visitors) {
      for (const eventName of browserMilestones) emit(visitor, eventName);
    }
    await waitForClientDrain(visitors.length * browserMilestones.length + 1);
    assert.equal(inducedNetworkFailures, 1, 'the client retry path received one synthetic 503');
    assert.equal(browserBodies.length, visitors.length * browserMilestones.length + 1, 'one retry was sent, with every browser milestone delivered');
    await flushBusinessEventQueue();
    const entryReplay = browserBodies.find(row => row.eventName === 'entry_viewed');
    assert.ok(entryReplay, 'a real client-produced entry event reached the collector');
    const duplicateCollectorResponse = await POST(new NextRequest('https://staging.docketstamp.com/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.42', 'user-agent': 'Mozilla/5.0 telemetry-integration-fixture' },
      body: JSON.stringify(entryReplay),
    }));
    assert.equal(duplicateCollectorResponse.status, 200);
    assert.equal((await duplicateCollectorResponse.json()).disposition, 'duplicate', 'replaying the same client event ID is harmless');

    const seededOrders = new Map<string, Record<string, unknown>>();
    for (const visitor of visitors) {
      const order = {
        id: visitor.orderId,
        environment: 'staging',
        status: 'PENDING_PAYMENT',
        amountInCents: 1995,
        finalAmountInCents: 1995,
        paymentMethod: 'STRIPE',
        isFounderTest: visitor.classification === 'founder',
        isComp: false,
        serviceLevel: 'CERTIFIED',
        noticeId: NOTICE_ID,
        sessionId: visitor.sessionId,
        telemetrySessionId: visitor.sessionId,
        telemetryJourneyId: visitor.journeyId,
        checkoutAttemptId: `fixture_checkout_${visitor.orderId}`,
        entrySource: 'direct_notice',
      };
      seededOrders.set(visitor.orderId, order);
      await firestoreDb.collection('orders').doc(visitor.orderId).set(order);
      await firestoreDb.collection('identity_classifications_v1').doc(`fixture_classification_${visitor.orderId}`).set({
        environment: 'staging',
        orderId: visitor.orderId,
        classificationId: `fixture_owner_classification_${visitor.orderId}`,
        primary: visitor.classification,
        policyVersion: 1,
        evidenceRefs: [`orders/${visitor.orderId}`],
        classifiedAt: new Date().toISOString(),
      });
      await firestoreDb.runTransaction(async transaction => {
        appendServerBusinessEvent(transaction, {
          eventId: `fixture_document_locked_${visitor.orderId}`,
          eventName: 'document_locked',
          environment: 'staging',
          sessionId: visitor.sessionId,
          journeyId: visitor.journeyId,
          checkoutAttemptId: `fixture_checkout_${visitor.orderId}`,
          orderId: visitor.orderId,
          noticeId: NOTICE_ID,
          tier: 'certified',
          entrySurface: 'notice_workspace',
          classification: 'unresolved',
          classificationEvidenceRef: `orders/${visitor.orderId}`,
          safeProperties: { result: 'locked' },
        });
      });
    }

    const requestsBeforeCheckoutStages = browserBodies.length;
    for (const visitor of visitors) {
      emit(visitor, 'payment_form_ready', visitor.orderId);
      emit(visitor, 'payment_attempted', visitor.orderId);
    }
    await waitForClientDrain(requestsBeforeCheckoutStages + visitors.length * 2);

    const paymentResults = new Map<string, { paymentFactId?: string; status: string }>();
    for (const visitor of visitors) {
      const paymentIntent = {
        id: `pi_fixture_${visitor.orderId}`,
        amount: 1995,
        amount_received: 1995,
        currency: 'usd',
        status: 'succeeded',
        livemode: true,
        metadata: { orderId: visitor.orderId },
      } as unknown as import('stripe').Stripe.PaymentIntent;
      const context = {
        eventId: `evt_fixture_${visitor.orderId}`,
        eventType: 'payment_intent.succeeded',
        eventLivemode: true,
        occurredAt: Date.now(),
        receivedAt: Date.now(),
      };
      const result = await recordPaymentAuthority(paymentIntent, context);
      assert.equal(result.status, 'accepted');
      assert.ok(result.paymentFactId);
      paymentResults.set(visitor.orderId, { paymentFactId: result.paymentFactId, status: result.status });
      const duplicate = await recordPaymentAuthority(paymentIntent, context);
      assert.equal(duplicate.status, 'duplicate', 'replayed provider capture is idempotent');
      assert.equal(duplicate.paymentFactId, result.paymentFactId);
    }
    assert.equal(await count(firestoreDb.collection('payment_facts_v1')), visitors.length);

    for (const visitor of visitors.filter(row => row.accepted)) {
      const order = seededOrders.get(visitor.orderId)!;
      const paymentFactId = paymentResults.get(visitor.orderId)?.paymentFactId;
      assert.ok(paymentFactId);
      const snapshotHash = computeOrderSnapshotHash(order as never);
      const authority = {
        product: 'docketstamp' as const,
        environment: 'staging' as const,
        orderId: visitor.orderId,
        snapshotHash,
        snapshotVersion: 1,
        tier: 'certified' as const,
        currency: 'USD',
        payableAmountMinor: 1995,
        lobMode: 'live' as const,
        cassMode: 'staging_mock_cass' as const,
        paymentFactId,
      };
      const claim = await claimDispatchAttempt({
        authority,
        actorId: 'fixture:operator',
        requestId: `fixture_request_${visitor.orderId}`,
        evidenceRef: `fixture_evidence_${visitor.orderId}`,
      });
      assert.equal(claim.claimed, true);
      if (!claim.claimed) continue;
      await finishDispatchAttempt({
        attemptId: claim.attempt.attemptId,
        state: 'accepted',
        providerLetterId: `lob_fixture_${visitor.orderId}`,
        nowMs: Date.now(),
      });
      const duplicateClaim = await claimDispatchAttempt({
        authority,
        actorId: 'fixture:operator',
        requestId: `fixture_retry_${visitor.orderId}`,
        evidenceRef: `fixture_evidence_${visitor.orderId}`,
      });
      assert.deepEqual(duplicateClaim, { claimed: false, reason: 'already_accepted' }, 'retry after confirmed acceptance cannot create a second mailing');
    }
    assert.equal(await count(firestoreDb.collection('postal_facts_v1')), visitors.filter(row => row.accepted).length);

    const now = new Date(Date.now() + 3000);
    const scope = calendarScope('staging', now, 'America/Chicago', '7d');
    const asOf = now.toISOString();
    const customerPrepared = await prepareGeneration(scope, asOf);
    const published = await publishGeneration(customerPrepared);
    const readBack = await readGeneration(scope);
    assert.equal(readBack?.generationId, customerPrepared.report.generationId, 'the report generation persisted and can be read back');
    assert.equal(readBack?.metrics.paidOrders.value, 2);
    assert.equal(readBack?.metrics.netCollections.value, 3990);
    assert.deepEqual([readBack?.metrics.conversion.numerator, readBack?.metrics.conversion.denominator], [2, 2]);
    assert.deepEqual([readBack?.metrics.accepted.numerator, readBack?.metrics.accepted.denominator], [1, 2]);
    assert.equal(readBack?.metrics.urgent.value, 1, 'the paid customer order without provider acceptance remains an exception');
    assert.deepEqual(readBack?.quality.excludedByClassification.founder, { paidOrders: 1, sessions: 1 }, 'founder order and entry are both excluded from customer KPIs');
    const journey = new Map((readBack?.journey || []).map((row: { name: string; observedSessions: number }) => [row.name, row.observedSessions]));
    assert.deepEqual({
      eligibleEntry: journey.get('entry_viewed'),
      workspace: journey.get('workspace_viewed'),
      documentLocked: journey.get('document_locked'),
      paymentForm: journey.get('payment_form_ready'),
      paymentAttempted: journey.get('payment_attempted'),
      verifiedPaid: journey.get('payment_verified'),
      lobAccepted: journey.get('fulfillment_accepted'),
    }, { eligibleEntry: 2, workspace: 2, documentLocked: 2, paymentForm: 2, paymentAttempted: 2, verifiedPaid: 2, lobAccepted: 1 });
    assert.deepEqual(published.counts.money, 2, 'private evidence drill-down matches the customer money total');
    assert.equal((await readEvidence(customerPrepared.report.generationId, 'events'))?.total, 2 * (browserMilestones.length + 4) + 1);

    const campaignA = await prepareGeneration({ ...scope, channel: 'google:cpc:experiment_a' }, asOf);
    await publishGeneration(campaignA);
    assert.deepEqual([campaignA.report.metrics.conversion.numerator, campaignA.report.metrics.conversion.denominator], [1, 1]);
    assert.equal(campaignA.report.metrics.paidOrders.value, 1);
    assert.equal(campaignA.report.metrics.netCollections.value, 1995);
    assert.deepEqual([campaignA.report.metrics.accepted.numerator, campaignA.report.metrics.accepted.denominator], [1, 1]);
    assert.equal(campaignA.report.metrics.urgent.value, 0);

    const campaignB = await prepareGeneration({ ...scope, channel: 'google:cpc:experiment_b' }, asOf);
    assert.deepEqual([campaignB.report.metrics.conversion.numerator, campaignB.report.metrics.conversion.denominator], [1, 1]);
    assert.equal(campaignB.report.metrics.paidOrders.value, 1);
    assert.equal(campaignB.report.metrics.netCollections.value, 1995);
    assert.deepEqual([campaignB.report.metrics.accepted.numerator, campaignB.report.metrics.accepted.denominator], [0, 1]);
    assert.equal(campaignB.report.metrics.urgent.value, 1);
    assert.equal((campaignA.report.metrics.conversion.numerator ?? 0) + (campaignB.report.metrics.conversion.numerator ?? 0), readBack?.metrics.conversion.numerator);
    assert.equal((campaignA.report.metrics.conversion.denominator ?? 0) + (campaignB.report.metrics.conversion.denominator ?? 0), readBack?.metrics.conversion.denominator);
    assert.equal(campaignA.report.metrics.paidOrders.value + campaignB.report.metrics.paidOrders.value, readBack?.metrics.paidOrders.value);
    assert.equal(campaignA.report.metrics.netCollections.value! + campaignB.report.metrics.netCollections.value!, readBack?.metrics.netCollections.value);
    assert.equal((campaignA.report.metrics.accepted.numerator ?? 0) + (campaignB.report.metrics.accepted.numerator ?? 0), readBack?.metrics.accepted.numerator);
    assert.equal((campaignA.report.metrics.accepted.denominator ?? 0) + (campaignB.report.metrics.accepted.denominator ?? 0), readBack?.metrics.accepted.denominator);
    assert.equal(await count(firestoreDb.collection('business_events_v1')), visitors.length * (browserMilestones.length + 2) + visitors.length * 2 + visitors.filter(row => row.accepted).length);
    console.log('Vertical fixture passed: client retry + collector dedup + verified fake captures + Lob acceptance + founder exclusion + campaign-filter KPI reconciliation + published report read-back.');
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of previousGlobals) {
      const descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    if (oldEnvironment === undefined) delete process.env.ENVIRONMENT; else process.env.ENVIRONMENT = oldEnvironment;
    if (oldStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldStripeKey;
    if (oldClientEnvironment === undefined) delete process.env.NEXT_PUBLIC_ENVIRONMENT; else process.env.NEXT_PUBLIC_ENVIRONMENT = oldClientEnvironment;
  }
});
