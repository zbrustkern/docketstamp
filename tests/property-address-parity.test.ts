import assert from 'node:assert/strict';
import { test } from 'node:test';
import { securityDepositNotice } from '../src/lib/docket/notices';
import { addressVerificationStatusLabel } from '../src/lib/docket/address-verification-status';
import { interpolateNotice } from '../src/lib/docket/renderer/interpolate';
import { composePropertyAddressValues, validateNoticeInput } from '../src/lib/docket/input-validation';

const values = {
  senderFullName: 'Alex Example', recipientFormalName: 'Example Property Office',
  propertyState: 'IL', vacatedPremisesAddress: '300 Elm St', moveOutDate: '2026-09-01',
  depositAmount: '$1,500', amountReceivedToDate: '$0', balanceRequested: '$1,500',
  basisForRequest: 'My records show the deposit has not been returned.', responseDays: '14 calendar days',
  senderAddressLine1: '100 Main St', senderAddressLine2: 'Unit 2', senderCity: 'Chicago', senderState: 'IL', senderZip: '60601-1001',
  recipientAddressLine1: '200 Oak St', recipientAddressLine2: '', recipientCity: 'Chicago', recipientState: 'IL', recipientZip: '60602-1001',
};

test('preview and server-validated freeze use the same property address composition', () => {
  const rawValues = { ...values };
  const previewValues = composePropertyAddressValues(rawValues);
  const result = validateNoticeInput(securityDepositNotice, rawValues);
  assert.equal(result.success, true);
  if (!result.success) return;

  const preview = interpolateNotice({ notice: securityDepositNotice, userValues: previewValues, docketId: 'DS-2026-ABC123' });
  const frozenInput = interpolateNotice({ notice: securityDepositNotice, userValues: result.userValues, docketId: 'DS-2026-ABC123' });
  assert.equal(preview.reLine, 'RE: Demand for Return of Security Deposit — 300 Elm St, IL');
  assert.equal(frozenInput.reLine, preview.reLine);
  assert.deepEqual(frozenInput.rawParagraphs, preview.rawParagraphs);
  assert.equal(composePropertyAddressValues(previewValues).vacatedPremisesAddress, '300 Elm St, IL', 'composition must be idempotent');
});

test('preparation-record wording distinguishes verified live CASS from simulations', () => {
  assert.equal(addressVerificationStatusLabel(['live_cass', 'live_cass']), 'USPS CASS VERIFIED');
  assert.equal(addressVerificationStatusLabel(['staging_mock_cass', 'staging_mock_cass']), 'ADDRESS CHECK SIMULATED (STAGING)');
  assert.equal(addressVerificationStatusLabel(['local_mock', 'local_mock']), 'ADDRESS CHECK SIMULATED (LOCAL)');
  assert.equal(addressVerificationStatusLabel(['live_cass', undefined]), 'ADDRESS VERIFICATION NOT CONFIRMED');
});
