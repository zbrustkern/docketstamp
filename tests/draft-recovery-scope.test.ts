import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearNoticeDraft,
  getDraftStorageKey,
  getOrCreateDraftIdentity,
  loadNoticeDraft,
  saveNoticeDraft,
  isDraftStorageScopeCurrent,
} from '../src/lib/docket/draft-recovery';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: storage } });

test('tab recovery scopes drafts and identity by notice and account, without restoring authority state', () => {
  const guest = getOrCreateDraftIdentity('debt-validation-request');
  const accountA = getOrCreateDraftIdentity('debt-validation-request', 'account-a');
  const accountB = getOrCreateDraftIdentity('debt-validation-request', 'account-b');
  assert.notEqual(guest.draftId, accountA.draftId);
  assert.notEqual(accountA.draftId, accountB.draftId);
  assert.equal(isDraftStorageScopeCurrent(null, 'account-a'), false);
  assert.equal(isDraftStorageScopeCurrent('account-a', 'account-a'), true);

  saveNoticeDraft('debt-validation-request', {
    userValues: { senderFullName: 'A. User', accountNumberLast4: '4321' },
    selectedTier: 'certified', draftId: accountA.draftId, draftRevision: 4,
  }, 'account-a');
  assert.equal(loadNoticeDraft('debt-validation-request', 'account-b'), null);
  const recovered = loadNoticeDraft('debt-validation-request', 'account-a');
  assert.equal(recovered?.draftId, accountA.draftId);
  assert.equal(recovered?.draftRevision, 4);
  assert.equal((recovered as any)?.isSignatureAdopted, undefined);
  assert.equal((recovered as any)?.addressVerificationEvidence, undefined);
  assert.match(getDraftStorageKey('debt-validation-request', 'account-a'), /account-a/);

  clearNoticeDraft('debt-validation-request', 'account-a');
  assert.equal(loadNoticeDraft('debt-validation-request', 'account-a'), null);
});

test.after(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete (globalThis as any).window;
});
