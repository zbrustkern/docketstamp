import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createAddressVerificationEvidence, verifyAddressVerificationEvidence } from '../src/lib/docket/address-verification-evidence';

Object.assign(process.env, {
  LOB_ENV: 'staging_mock_cass',
  ADDRESS_VERIFICATION_EVIDENCE_SECRET: 'test-only-address-evidence-secret-with-entropy',
});

test('iOS Safari empty date input CSS avoids display: inline-flex shrinkage and pins full width', () => {
  const cssPath = path.resolve(process.cwd(), 'app/globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verify that input[type="date"]::-webkit-date-and-time-value does not have display: inline-flex
  const pseudoMatch = cssContent.match(/input\[type="date"\]::-webkit-date-and-time-value\s*\{([^}]+)\}/);
  assert.ok(pseudoMatch, '::-webkit-date-and-time-value block must exist');

  const block = pseudoMatch[1];
  assert.ok(!block.includes('inline-flex'), 'must not use display: inline-flex which causes width collapse on iOS Safari when empty');
  assert.ok(block.includes('width: 100%'), 'must specify width: 100% for full touch target');
  assert.ok(block.includes('min-height: 1.5rem'), 'must specify min-height: 1.5rem to prevent vertical collapse');
  assert.ok(block.includes('text-align: left'), 'must specify text-align: left');
});

test('multi-address CASS: address verified at revision N binds cleanly at N+1 when second address accepts suggestion', async () => {
  const draftId = 'draft_multi_cass_test';
  const initialRevision = 5;

  const senderAddress = {
    name: 'Alice Sender',
    addressLine1: '100 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
  };

  const recipientAddress = {
    name: 'Acme Corp',
    addressLine1: '500 Market St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
  };

  // 1. Sender verified in drawer at draftRevision = 5
  const senderEvidenceRev5 = createAddressVerificationEvidence({
    role: 'sender',
    draftId,
    draftRevision: initialRevision,
    address: senderAddress,
    providerMode: 'staging_mock_cass',
  });

  assert.ok(senderEvidenceRev5);
  assert.equal(senderEvidenceRev5.payload.draftRevision, 5);

  // 2. In checkout, recipient suggestion is accepted, bumping draftRevision to 6
  const nextRev = initialRevision + 1;

  // Recipient standardized evidence is generated at nextRev (6)
  const recipientStandardizedEvidence = createAddressVerificationEvidence({
    role: 'recipient',
    draftId,
    draftRevision: nextRev,
    address: {
      ...recipientAddress,
      addressLine1: '500 MARKET ST',
    },
    providerMode: 'staging_mock_cass',
  });

  assert.equal(recipientStandardizedEvidence.payload.draftRevision, 6);

  // 3. Sender re-verified at nextRev (6) to bind fresh evidence token without re-prompting
  const senderEvidenceRev6 = createAddressVerificationEvidence({
    role: 'sender',
    draftId,
    draftRevision: nextRev,
    address: senderAddress,
    providerMode: 'staging_mock_cass',
  });

  // 4. Verify both tokens at revision 6
  const verifiedSender = verifyAddressVerificationEvidence({
    evidence: senderEvidenceRev6,
    role: 'sender',
    draftId,
    draftRevision: nextRev,
    address: senderAddress,
    allowedProviderModes: ['staging_mock_cass'],
  });
  assert.ok(verifiedSender, 'sender evidence must be valid at draftRevision 6');
  assert.equal(verifiedSender?.draftRevision, 6);

  const verifiedRecipient = verifyAddressVerificationEvidence({
    evidence: recipientStandardizedEvidence,
    role: 'recipient',
    draftId,
    draftRevision: nextRev,
    address: {
      ...recipientAddress,
      addressLine1: '500 MARKET ST',
    },
    allowedProviderModes: ['staging_mock_cass'],
  });
  assert.ok(verifiedRecipient, 'recipient evidence must be valid at draftRevision 6');
  assert.equal(verifiedRecipient?.draftRevision, 6);
});
