import crypto from 'node:crypto';
import { createAddressVerificationEvidence } from '../../src/lib/docket/address-verification-evidence';

/** Test-only proof for the existing synthetic address fixtures. No provider request. */
export function withVerifiedLockFixture<T extends Record<string, any>>(body: T) {
  if (!process.env.ADDRESS_VERIFICATION_EVIDENCE_SECRET) {
    process.env.ADDRESS_VERIFICATION_EVIDENCE_SECRET = 'offline_fixture_only_address_evidence_signing_key';
  }
  const values = body.userValues || {};
  const draftId = body.draftId || `fixture_${crypto.randomUUID()}`;
  const draftRevision = body.draftRevision ?? 1;
  const sender = body.senderAddress || {
    name: values.senderFullName,
    addressLine1: values.senderAddressLine1,
    addressLine2: values.senderAddressLine2,
    city: values.senderCity, state: values.senderState, zip: values.senderZip,
  };
  const recipient = body.recipientAddress || {
    name: values.recipientFormalName,
    addressLine1: values.recipientAddressLine1,
    addressLine2: values.recipientAddressLine2,
    city: values.recipientCity, state: values.recipientState, zip: values.recipientZip,
  };
  return {
    ...body, draftId, draftRevision,
    verificationEvidence: {
      sender: createAddressVerificationEvidence({ role: 'sender', draftId, draftRevision, address: sender, providerMode: 'staging_mock_cass' }),
      recipient: createAddressVerificationEvidence({ role: 'recipient', draftId, draftRevision, address: recipient, providerMode: 'staging_mock_cass' }),
    },
  };
}
