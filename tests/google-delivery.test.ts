import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverGoogleConversion, interpretGoogleProcessing, nextGoogleDeliveryState } from '@/lib/admin-console/advertising/delivery';
import type { GoogleAdsDestination } from '@/lib/admin-console/advertising/destination';

const destination: GoogleAdsDestination = {
  key: 'offline-test', accountId: '1234567890', loginAccountId: '1234567890',
  conversionActionId: '987654321', conversionName: 'DocketStamp Paid Order', approved: true,
};

test('delivery state transitions keep ambiguous outcomes closed and bound retries', () => {
  const now = Date.parse('2026-11-10T18:00:00.000Z');
  const expires = now + 24 * 60 * 60 * 1000;
  assert.deepEqual(nextGoogleDeliveryState({ status: 'submitted', requestId: 'req_12345678' }, 1, now, expires), { status: 'submitted', nextAttemptAt: null });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'submitted' }, 1, now, expires), { status: 'unknown', nextAttemptAt: null, diagnosticCode: 'SUBMISSION_RECEIPT_MISSING' });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'unknown' }, 1, now, expires), { status: 'unknown', nextAttemptAt: null });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'disabled' }, 1, now, expires), { status: 'held', nextAttemptAt: null });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'retryable_failure' }, 1, now, expires), { status: 'retry_due', nextAttemptAt: new Date(now + 60_000).toISOString() });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'retryable_failure' }, 5, now, expires), { status: 'failed', nextAttemptAt: null });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'retryable_failure' }, 1, now, now + 60_000), { status: 'failed', nextAttemptAt: null });
  assert.deepEqual(nextGoogleDeliveryState({ status: 'permanent_failure' }, 1, now, expires), { status: 'failed', nextAttemptAt: null });
});

test('processing response interpretation requires the exact destination and never reports attribution', () => {
  const response = (requestStatus: string, overrides: Record<string, unknown> = {}) => ({
    requestStatusPerDestination: [{
      destination: { operatingAccount: { accountId: destination.accountId }, productDestinationId: destination.conversionActionId },
      requestStatus,
      ...overrides,
    }],
  });
  assert.equal(interpretGoogleProcessing(response('SUCCESS'), destination), 'accepted');
  assert.equal(interpretGoogleProcessing(response('PROCESSING'), destination), 'processing');
  assert.equal(interpretGoogleProcessing(response('FAILED'), destination), 'rejected');
  assert.equal(interpretGoogleProcessing(response('SUCCESS', { errorInfo: { errorCounts: [{ count: 1 }] } }), destination), 'unknown');
  assert.equal(interpretGoogleProcessing(response('SUCCESS', { destination: { operatingAccount: { accountId: 'other' }, productDestinationId: destination.conversionActionId } }), destination), 'unknown');
  assert.equal(interpretGoogleProcessing({ requestStatusPerDestination: [response('SUCCESS').requestStatusPerDestination[0], response('SUCCESS').requestStatusPerDestination[0]] }, destination), 'unknown');
  assert.equal(interpretGoogleProcessing(null, destination), 'unknown');
});

test('delivery remains disabled outside the exact approved production gate and makes no provider call', async () => {
  const prior = {
    environment: process.env.ENVIRONMENT,
    destinationKey: process.env.GOOGLE_ADS_DESTINATION_KEY,
    exportEnabled: process.env.GOOGLE_ADS_OFFLINE_EXPORT_ENABLED,
    apiEnabled: process.env.GOOGLE_ADS_OFFLINE_API_ENABLED,
  };
  let providerCalled = false;
  try {
    delete process.env.ENVIRONMENT;
    process.env.GOOGLE_ADS_DESTINATION_KEY = destination.key;
    process.env.GOOGLE_ADS_OFFLINE_EXPORT_ENABLED = 'true';
    process.env.GOOGLE_ADS_OFFLINE_API_ENABLED = 'true';
    const result = await deliverGoogleConversion('a'.repeat(64), async () => {
      providerCalled = true;
      return { status: 'submitted', requestId: 'should_not_send' };
    });
    assert.deepEqual(result, { status: 'disabled' });
    assert.equal(providerCalled, false);
  } finally {
    if (prior.environment === undefined) delete process.env.ENVIRONMENT; else process.env.ENVIRONMENT = prior.environment;
    if (prior.destinationKey === undefined) delete process.env.GOOGLE_ADS_DESTINATION_KEY; else process.env.GOOGLE_ADS_DESTINATION_KEY = prior.destinationKey;
    if (prior.exportEnabled === undefined) delete process.env.GOOGLE_ADS_OFFLINE_EXPORT_ENABLED; else process.env.GOOGLE_ADS_OFFLINE_EXPORT_ENABLED = prior.exportEnabled;
    if (prior.apiEnabled === undefined) delete process.env.GOOGLE_ADS_OFFLINE_API_ENABLED; else process.env.GOOGLE_ADS_OFFLINE_API_ENABLED = prior.apiEnabled;
  }
});
