import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutFingerprintDigest,
  clearActiveCheckoutAttempt,
  clearCheckoutRequest,
  getOrCreateCheckoutCapability,
  getOrCreateCheckoutRequest,
  isActiveCheckoutAttemptUnresolved,
  loadActiveCheckoutAttempt,
  saveActiveCheckoutAttempt,
} from '../src/lib/docket/checkout-recovery';

class MemorySessionStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('checkout request identity and docket ID survive reload without storing fingerprint or payment credentials', async () => {
  const storage = new MemorySessionStorage();
  const fingerprint = JSON.stringify({ email: 'private@example.test', address: '123 Private Street' });
  const digest = await checkoutFingerprintDigest(fingerprint);
  const first = getOrCreateCheckoutRequest(storage, {
    draftId: 'draft_opaque_123', draftRevision: 7, identityDigest: digest, docketId: 'DS-2026-ABC123',
  }, () => 'stable-idempotency-key');
  const reloaded = getOrCreateCheckoutRequest(storage, {
    draftId: 'draft_opaque_123', draftRevision: 7, identityDigest: digest, docketId: 'DS-2026-NEW999',
  }, () => 'different-key');
  assert.equal(reloaded.idempotencyKey, first.idempotencyKey);
  assert.equal(reloaded.docketId, first.docketId);
  const stored = [...storage.values.values()].join('\n');
  assert.doesNotMatch(stored, /private@example|Private Street|clientSecret|viewToken/);
});

test('only an unresolved stale attempt disables checkout; exact replay stays available', () => {
  const recovery = { attemptId: 'ca_previous_123', draftId: 'draft_current_123', draftRevision: 2, identityDigest: 'same' };
  assert.equal(isActiveCheckoutAttemptUnresolved({ recovery, currentDraftId: recovery.draftId, currentIdentityDigest: 'same' }), false);
  assert.equal(isActiveCheckoutAttemptUnresolved({ recovery, currentDraftId: recovery.draftId, currentIdentityDigest: 'changed' }), true);
  assert.equal(isActiveCheckoutAttemptUnresolved({ recovery, currentDraftId: 'another_draft_123', currentIdentityDigest: 'same' }), true);
  assert.equal(isActiveCheckoutAttemptUnresolved({ recovery: { ...recovery, identityDigest: undefined }, currentDraftId: recovery.draftId, currentIdentityDigest: 'same', lockedAttemptId: recovery.attemptId, lockedAttemptMatchesCurrent: true }), false);
});

test('active attempt recovery is scoped, minimal, and cleared only for the matching attempt', () => {
  const storage = new MemorySessionStorage();
  const metadata = { attemptId: 'ca_recover_123', draftId: 'draft_opaque_123', draftRevision: 7, docketId: 'DS-2026-ABC123', identityDigest: 'abc123' };
  saveActiveCheckoutAttempt(storage, metadata);
  assert.deepEqual(loadActiveCheckoutAttempt(storage, metadata.draftId), metadata);
  assert.equal(loadActiveCheckoutAttempt(storage, 'another_draft'), null);
  clearActiveCheckoutAttempt(storage, metadata.draftId, 'different_attempt');
  assert.deepEqual(loadActiveCheckoutAttempt(storage, metadata.draftId), metadata);
  clearActiveCheckoutAttempt(storage, metadata.draftId, metadata.attemptId);
  assert.equal(loadActiveCheckoutAttempt(storage, metadata.draftId), null);
});

test('capability, request and active-attempt recovery stay stable when session storage is unavailable', () => {
  const unavailable = {
    getItem() { throw new Error('storage denied'); },
    setItem() { throw new Error('storage denied'); },
    removeItem() { throw new Error('storage denied'); },
  };
  let createdCapabilities = 0;
  const capability = () => `capability-${++createdCapabilities}`;
  assert.equal(getOrCreateCheckoutCapability(unavailable, 'draft_storage_blocked', capability), 'capability-1');
  assert.equal(getOrCreateCheckoutCapability(unavailable, 'draft_storage_blocked', capability), 'capability-1');

  let createdKeys = 0;
  const requestInput = { draftId: 'draft_storage_blocked', draftRevision: 4, identityDigest: 'same-fingerprint', docketId: 'DS-REUSED' };
  const request = getOrCreateCheckoutRequest(unavailable, requestInput, () => `key-${++createdKeys}`);
  assert.equal(getOrCreateCheckoutRequest(unavailable, requestInput, () => `key-${++createdKeys}`).idempotencyKey, request.idempotencyKey);

  const attempt = { attemptId: 'attempt_storage_blocked', draftId: 'draft_storage_blocked', draftRevision: 4 };
  saveActiveCheckoutAttempt(unavailable, attempt);
  assert.deepEqual(loadActiveCheckoutAttempt(unavailable, attempt.draftId), attempt);
  clearActiveCheckoutAttempt(unavailable, attempt.draftId, attempt.attemptId);
  assert.equal(loadActiveCheckoutAttempt(unavailable, attempt.draftId), null);
  clearCheckoutRequest(unavailable, requestInput.draftId, requestInput.identityDigest);
  assert.notEqual(getOrCreateCheckoutRequest(unavailable, requestInput, () => `key-${++createdKeys}`).idempotencyKey, request.idempotencyKey);
});
