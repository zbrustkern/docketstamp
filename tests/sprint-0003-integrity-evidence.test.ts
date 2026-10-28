import { withVerifiedLockFixture } from './helpers/verified-lock-fixture';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test, { before, after } from 'node:test';
import { NextRequest } from 'next/server';
import { POST as lockAndIntentPost } from '../app/api/docket/lock-and-intent/route';
import { getOrderById, updateOrderStatus } from '../lib/firebase-admin';
import {
  createDocumentIntegrityEvidence,
  SIGNATURE_AFFIRMATION_VERSION,
} from '../src/lib/docket/integrity-evidence';

const originalEnv = { ...process.env };

before(() => {
  process.env.ALLOW_LOCAL_MOCK_PAYMENTS = 'true';
  process.env.LOB_ENV = 'staging_mock_cass';
});

after(() => {
  process.env = originalEnv;
});

const userValues = {
  senderFullName: 'Taylor Morgan',
  senderAddressLine1: '77 Lake Street, Unit 5',
  senderCity: 'Chicago',
  senderState: 'IL',
  senderZip: '60601',
  recipientFormalName: 'Carmel Property Group',
  recipientAddressLine1: '18 Main Street',
  recipientCity: 'Carmel',
  recipientState: 'IN',
  recipientZip: '46032',
  propertyState: 'IN',
  vacatedPremisesAddress: '77 Lake Street, Unit 5, Chicago, IL 60601',
  moveOutDate: '2026-09-01',
  depositAmount: '$1,500.00',
  amountReceivedToDate: '$0.00',
  balanceRequested: '$1,500.00',
  basisForRequest: 'My records show I paid the deposit and have received no refund.',
  responseDays: '14 calendar days',
};

function request(
  signatureAdoption: unknown,
  values: Record<string, string> = userValues
) {
  return new NextRequest('http://localhost:3000/api/docket/lock-and-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withVerifiedLockFixture({
      slug: 'security-deposit-return-demand-letter',
      tier: 'certified_return_receipt',
      customerEmail: 'integrity-evidence@example.com',
      userValues: values,
      signatureAdoption,
    })),
  });
}

const adoptedAssertion = {
  adopted: true,
  affirmed: true,
  signerName: 'Taylor Morgan',
  adoptedAt: 1,
};

test('locks exact Lob HTML with server-generated SHA-256 and adoption evidence', async () => {
  const response = await lockAndIntentPost(request(adoptedAssertion));
  assert.equal(response.status, 200);
  const result = await response.json();
  const order = await getOrderById(result.orderId);

  assert.ok(order?.documentHtml);
  assert.equal(Number.isInteger(order?.templatePolicyRevision), true);
  assert.match(order?.templateContentDigest || '', /^[a-f0-9]{64}$/);
  assert.deepEqual(order?.policyNexus, { propertyState: 'IN' });
  assert.equal(Number.isFinite(Date.parse(order?.policyDecisionAt || '')), true);
  assert.ok(order.documentIntegrityEvidence);
  const evidence = order.documentIntegrityEvidence;
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.algorithm, 'sha256');
  assert.equal(
    evidence.digest,
    createHash('sha256').update(Buffer.from(order.documentHtml, 'utf8')).digest('hex')
  );
  assert.equal(evidence.signatureAdoption.signerName, 'Taylor Morgan');
  assert.equal(evidence.signatureAdoption.affirmationVersion, SIGNATURE_AFFIRMATION_VERSION);
  assert.ok(evidence.signatureAdoption.adoptedAt > 1);
  assert.ok(evidence.lockedAt > 1);
  assert.ok(order.documentHtml.includes('/s/ Taylor Morgan'));

  const originalEvidence = structuredClone(evidence);
  await updateOrderStatus(order.id, { status: 'PAYMENT_RECEIVED' });
  const updatedOrder = await getOrderById(order.id);
  assert.deepEqual(updatedOrder?.documentIntegrityEvidence, originalEvidence);
  assert.equal(updatedOrder?.documentHtml, order.documentHtml);
});

test('requires affirmative adoption and a signer matching the rendered document', async () => {
  const missing = await lockAndIntentPost(request(undefined));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, 'SIGNATURE_ADOPTION_REQUIRED');

  const unchecked = await lockAndIntentPost(request({ ...adoptedAssertion, affirmed: false }));
  assert.equal(unchecked.status, 400);
  assert.equal((await unchecked.json()).code, 'SIGNATURE_ADOPTION_REQUIRED');

  const mismatch = await lockAndIntentPost(request({ ...adoptedAssertion, signerName: 'Another Person' }));
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).code, 'SIGNER_MISMATCH');
});

test('digest changes when the frozen document content changes', () => {
  const first = createDocumentIntegrityEvidence('<html>First</html>', 'Taylor Morgan', 10, 11);
  const second = createDocumentIntegrityEvidence('<html>Second</html>', 'Taylor Morgan', 10, 11);
  assert.notEqual(first.digest, second.digest);
});

test('checkout sends the user assertion and describes the digest without legal-validity claims', () => {
  const checkoutSource = readFileSync('src/components/docket/CheckoutModal.tsx', 'utf8');
  const workspaceSource = readFileSync('src/components/docket/DocumentWorkspace.tsx', 'utf8');

  assert.ok(checkoutSource.includes('signatureAdoption:'));
  assert.ok(checkoutSource.includes('adopted: isSignatureAdopted'));
  assert.ok(checkoutSource.includes('affirmed: isAffirmed'));
  assert.ok(workspaceSource.includes('onAffirmationChange={handleAffirmationChange}'));
  assert.ok(checkoutSource.includes('SHA-256 integrity digest'));
  assert.ok(checkoutSource.includes('does not assess legal validity'));
  assert.ok(!checkoutSource.includes('SHA-256 integrity preserved'));
});
