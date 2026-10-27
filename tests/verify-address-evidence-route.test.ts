import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/docket/verify-address/route';
import { verifyAddressVerificationEvidence } from '../src/lib/docket/address-verification-evidence';

Object.assign(process.env, {
  LOB_ENV: 'staging_mock_cass',
  ADDRESS_VERIFICATION_EVIDENCE_SECRET: 'test-only-address-evidence-secret-with-entropy',
});

test('address verifier returns revision-bound staging evidence without silently changing the submitted address', async () => {
  const address = { name: 'A. Customer', addressLine1: '123 Main Street', addressLine2: 'Apt 4', city: 'Chicago', state: 'IL', zip: '60601' };
  const request = new NextRequest('http://localhost/api/docket/verify-address', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.44' },
    body: JSON.stringify({ address, role: 'sender', draftId: 'draft_opaque_123', draftRevision: 5 }),
  });
  const response = await POST(request);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.valid, true);
  assert.equal(result.providerMode, 'staging_mock_cass');
  assert.equal(result.standardizedAddress.primary_line, '123 MAIN STREET');
  assert.equal(verifyAddressVerificationEvidence({
    evidence: result.evidence, role: 'sender', draftId: 'draft_opaque_123', draftRevision: 5, address,
    allowedProviderModes: ['staging_mock_cass'],
  })?.providerMode, 'staging_mock_cass');
  assert.equal(verifyAddressVerificationEvidence({
    evidence: result.evidence, role: 'sender', draftId: 'draft_opaque_123', draftRevision: 6, address,
  }), null);
});
