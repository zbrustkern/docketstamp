/** Browser-safe types and freshness checks for server-issued CASS evidence. */
export type VerifiedAddressRole = 'sender' | 'recipient';
export type AddressProviderMode = 'staging_mock_cass' | 'live_cass' | 'local_mock';

export interface AddressEvidenceAddress {
  name?: string;
  company?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface AddressVerificationEvidencePayload {
  version: 1;
  role: VerifiedAddressRole;
  draftId: string;
  draftRevision: number;
  addressDigest: string;
  providerMode: AddressProviderMode;
  verifiedAt: string;
  expiresAt: number;
}

export interface AddressVerificationEvidence {
  token: string;
  payload: AddressVerificationEvidencePayload;
}

export function isCurrentAddressVerificationResponse(input: {
  requestId: number;
  currentRequestId: number;
  responseRevision: number;
  currentRevision: number;
}): boolean {
  return input.requestId === input.currentRequestId && input.responseRevision === input.currentRevision;
}

export function isAddressEvidenceCurrent(input: {
  evidence: AddressVerificationEvidence | undefined;
  draftId: string;
  draftRevision: number;
  now?: number;
}): boolean {
  return Boolean(input.evidence && input.evidence.payload.draftId === input.draftId &&
    input.evidence.payload.draftRevision === input.draftRevision &&
    input.evidence.payload.expiresAt >= (input.now ?? Date.now()));
}
