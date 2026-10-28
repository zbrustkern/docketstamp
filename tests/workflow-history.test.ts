import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWorkflowStep,
  workflowHistoryState,
  workflowStepFromHistoryState,
  resolveHistoryNavigation,
  safeWorkflowUrl,
  writeWorkflowHistory,
  resolveHydratedStageId,
} from '../src/lib/docket/workflow-history';

test('workflow history encodes only a meaningful step and rejects unrelated history state', () => {
  assert.equal(parseWorkflowStep('review'), 'review');
  assert.equal(parseWorkflowStep('payment'), 'payment');
  assert.equal(parseWorkflowStep('customer@example.test'), null);
  assert.equal(workflowStepFromHistoryState(workflowHistoryState('delivery')), 'delivery');
  assert.equal(workflowStepFromHistoryState({ docketstampWorkflow: 'payment', userValues: { name: 'sensitive' } }), 'payment');
  assert.equal(workflowStepFromHistoryState({ docketstampWorkflow: 'https://bad.example/?token=secret' }), null);
  assert.equal(workflowStepFromHistoryState(null), null);
  assert.equal(resolveHistoryNavigation('payment', { checkoutReady: false, paymentReady: false }), 'review');
  assert.equal(resolveHistoryNavigation('payment', { checkoutReady: true, paymentReady: false }), 'delivery');
  assert.equal(resolveHistoryNavigation('payment', { checkoutReady: true, paymentReady: true }), 'payment');
  assert.equal(resolveHistoryNavigation('delivery', { checkoutReady: false, paymentReady: true }), 'review');
  assert.equal(resolveHydratedStageId(null, 'stage-bearer-secret', false), 'stage-bearer-secret');
  assert.equal(resolveHydratedStageId(null, 'stage-bearer-secret', true), null);
});

test('workflow URL retains safe routing context, strips prefill PII and stage tokens, and merges Next history state', () => {
  const unsafe = 'https://docketstamp.test/docket/security-deposit-return-demand-letter?field.senderFullName=Taylor%20Morgan&senderZip=46204&stage=stage-bearer-secret&recipientId=company_123&tier=certified&focus=balanceRequested&source=companies_directory&workflow=payment#token';
  assert.equal(
    safeWorkflowUrl(unsafe, 'delivery'),
    '/docket/security-deposit-return-demand-letter?recipientId=company_123&tier=certified&focus=balanceRequested&source=companies_directory&workflow=delivery',
  );

  const priorWindow = (globalThis as any).window;
  const captured: { state?: Record<string, unknown>; url: string } = { url: '' };
  const fakeWindow = {
    location: { href: unsafe },
    history: {
      state: { __N: true, tree: ['router-state'] },
      pushState(state: Record<string, unknown>, _title: string, url: string) { captured.state = state; captured.url = url; },
      replaceState(state: Record<string, unknown>, _title: string, url: string) { captured.state = state; captured.url = url; },
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    writeWorkflowHistory('review');
    assert.equal(captured.url, '/docket/security-deposit-return-demand-letter?recipientId=company_123&tier=certified&focus=balanceRequested&source=companies_directory&workflow=review');
    assert.equal(captured.state?.__N, true);
    assert.deepEqual(captured.state?.tree, ['router-state']);
    assert.equal(captured.state?.docketstampWorkflow, 'review');
  } finally {
    if (priorWindow === undefined) delete (globalThis as any).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: priorWindow });
  }
});
