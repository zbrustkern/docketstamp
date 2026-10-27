import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAddressVerificationEvidence,
  verifyAddressVerificationEvidence,
  isAddressEvidenceCurrent,
  isCurrentAddressVerificationResponse,
} from '../src/lib/docket/address-verification-evidence';

process.env.ADDRESS_VERIFICATION_EVIDENCE_SECRET = 'test-only-address-evidence-secret-with-entropy';

const address = {
  name: 'A. Customer',
  addressLine1: '123 Main Street',
  addressLine2: 'Apt 4',
  city: 'Chicago',
  state: 'IL',
  zip: '60601',
};
const evidence = createAddressVerificationEvidence({
  role: 'sender', draftId: 'draft-opaque', draftRevision: 7, address,
  providerMode: 'staging_mock_cass', now: 1_800_000_000_000,
});

test('address evidence is signed, short lived, and tied to role, draft revision, and exact address', () => {
  const valid = (overrides: Partial<Parameters<typeof verifyAddressVerificationEvidence>[0]> = {}) => verifyAddressVerificationEvidence({
    evidence, role: 'sender', draftId: 'draft-opaque', draftRevision: 7, address,
    now: 1_800_000_100_000, ...overrides,
  });
  assert.equal(valid()?.providerMode, 'staging_mock_cass');
  assert.equal(isAddressEvidenceCurrent({ evidence, draftId: 'draft-opaque', draftRevision: 7 }), true);
  assert.equal(isAddressEvidenceCurrent({ evidence, draftId: 'draft-opaque', draftRevision: 8 }), false);
  assert.equal(isCurrentAddressVerificationResponse({ requestId: 2, currentRequestId: 2, responseRevision: 7, currentRevision: 7 }), true);
  assert.equal(isCurrentAddressVerificationResponse({ requestId: 1, currentRequestId: 2, responseRevision: 7, currentRevision: 7 }), false);
  assert.equal(isCurrentAddressVerificationResponse({ requestId: 2, currentRequestId: 2, responseRevision: 6, currentRevision: 7 }), false);
  assert.equal(valid({ draftRevision: 8 }), null);
  assert.equal(valid({ role: 'recipient' }), null);
  assert.equal(valid({ address: { ...address, addressLine2: 'Unit 4' } }), null);
  assert.equal(valid({ now: 1_800_002_000_000 }), null);
  assert.equal(valid({ allowedProviderModes: ['live_cass'] }), null);
  assert.equal(verifyAddressVerificationEvidence({
    evidence: `${evidence.token.slice(0, -1)}x`, role: 'sender', draftId: 'draft-opaque', draftRevision: 7, address,
  }), null);
});
