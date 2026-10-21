import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';

test('a frozen order survives a later pause while a new lock is denied before payment', async () => {
  Object.assign(process.env, { NODE_ENV: 'test', USE_MOCK_FIRESTORE: 'true', ENVIRONMENT: 'local', ALLOW_LOCAL_MOCK_PAYMENTS: 'true' });
  const [{ firestoreDb }, policy, lockModule] = await Promise.all([
    import('../lib/firebase-admin'),
    import('../lib/template-policy-store'),
    import('../app/api/docket/lock-and-intent/route'),
  ]);
  const policyRef = firestoreDb.collection('template_availability_v1').doc('policy_local');
  await policyRef.delete();
  const runId = Date.now();
  const userValues = {
    senderFullName: 'Taylor Morgan', senderAddressLine1: '77 Lake Street, Unit 5', senderCity: 'Chicago', senderState: 'IL', senderZip: '60601',
    recipientFormalName: 'Carmel Property Group', recipientAddressLine1: '18 Main Street', recipientCity: 'Carmel', recipientState: 'IN', recipientZip: '46032',
    propertyState: 'IN', basisForRequest: 'My records show no refund received.', rentalPropertyCity: 'Carmel', rentalPropertyZip: '46032', vacatedPremisesAddress: '77 Lake Street, Unit 5, Chicago, IL 60601', moveOutDate: '2026-09-01',
    depositAmount: '$1,500.00', amountReceivedToDate: '$0.00', balanceRequested: '$1,500.00', responseDays: '14 calendar days',
  };
  const makeRequest = (customerEmail: string) => new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      slug: 'security-deposit-accounting-request', tier: 'certified', customerEmail, userValues,
      signatureAdoption: { adopted: true, affirmed: true, signerName: 'Taylor Morgan' },
    }),
  });
  const originalLog = console.log;
  let mockPaymentStarts = 0;
  console.log = (...args: unknown[]) => { if (String(args[0]).includes('[MOCK Stripe]')) mockPaymentStarts += 1; };
  try {
    const firstEmail = `grandfathered-${runId}@example.test`;
    const firstResponse = await lockModule.POST(makeRequest(firstEmail));
    assert.equal(firstResponse.status, 200);
    const firstResult = await firstResponse.json();
    const firstOrderRef = firestoreDb.collection('orders').doc(firstResult.orderId);
    const frozenBeforePause = (await firstOrderRef.get()).data();
    assert.ok(frozenBeforePause?.documentHtml);
    assert.equal(frozenBeforePause?.templatePolicyRevision, 0);
    const frozenHtml = frozenBeforePause.documentHtml;

    const paused = await policy.commitTemplateMutation('test-owner', {
      action: 'set_global', requestId: `lock-gate-${runId}`, reason: 'Test pause cutoff after a frozen order.', expectedRevision: 0,
      global: { enabled: false, requireCurrentReview: false, residence: { mode: 'all', states: [] }, property: { mode: 'all', states: [] } },
    });
    assert.equal(paused.revision, 1);

    const secondEmail = `paused-${runId}@example.test`;
    const secondResponse = await lockModule.POST(makeRequest(secondEmail));
    assert.equal(secondResponse.status, 403);
    assert.equal((await secondResponse.json()).code, 'TEMPLATE_UNAVAILABLE');
    assert.equal((await firestoreDb.collection('orders').where('customerEmail', '==', secondEmail).get()).size, 0);
    assert.equal(mockPaymentStarts, 1);

    const frozenAfterPause = (await firstOrderRef.get()).data();
    assert.equal(frozenAfterPause?.documentHtml, frozenHtml);
    assert.equal(frozenAfterPause?.templatePolicyRevision, 0);
    assert.equal(frozenAfterPause?.status, 'PENDING_PAYMENT');
  } finally {
    console.log = originalLog;
    await policyRef.delete();
  }
});
