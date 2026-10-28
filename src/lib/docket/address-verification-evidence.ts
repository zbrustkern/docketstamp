import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  AddressEvidenceAddress,
  AddressProviderMode,
  AddressVerificationEvidence,
  AddressVerificationEvidencePayload,
  VerifiedAddressRole,
} from './address-verification-client';
export type {
  AddressEvidenceAddress,
  AddressProviderMode,
  AddressVerificationEvidence,
  AddressVerificationEvidencePayload,
  VerifiedAddressRole,
} from './address-verification-client';
export { isAddressEvidenceCurrent, isCurrentAddressVerificationResponse } from './address-verification-client';

function evidenceSecret(): string {
  const secret = process.env.ADDRESS_VERIFICATION_EVIDENCE_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
  if (secret.length < 32) throw new Error('Address verification evidence signing key is not configured.');
  return secret;
}

function canonicalAddress(address: AddressEvidenceAddress): string {
  const values = [address.name, address.company, address.addressLine1, address.addressLine2, address.city, address.state, address.zip];
  return values.map((value) => (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US')).join('\n');
}

export function getAddressDigest(address: AddressEvidenceAddress): string {
  return createHmac('sha256', evidenceSecret()).update(`docketstamp-address-v1\n${canonicalAddress(address)}`).digest('hex');
}

function signature(encodedPayload: string): Buffer {
  return createHmac('sha256', evidenceSecret()).update(`docketstamp-address-evidence-v1.${encodedPayload}`).digest();
}

export function createAddressVerificationEvidence(input: Omit<AddressVerificationEvidencePayload, 'version' | 'addressDigest' | 'verifiedAt' | 'expiresAt'> & {
  address: AddressEvidenceAddress;
  providerMode: AddressProviderMode;
  now?: number;
  ttlMs?: number;
}): AddressVerificationEvidence {
  if (!input.draftId || !Number.isSafeInteger(input.draftRevision) || input.draftRevision < 0) {
    throw new Error('Address evidence requires a draft identity and revision.');
  }
  const now = input.now ?? Date.now();
  const payload: AddressVerificationEvidencePayload = {
    version: 1,
    role: input.role,
    draftId: input.draftId,
    draftRevision: input.draftRevision,
    addressDigest: getAddressDigest(input.address),
    providerMode: input.providerMode,
    verifiedAt: new Date(now).toISOString(),
    expiresAt: now + (input.ttlMs ?? 30 * 60 * 1000),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${encoded}.${signature(encoded).toString('base64url')}`, payload };
}

export function verifyAddressVerificationEvidence(input: {
  evidence: AddressVerificationEvidence | string;
  role: VerifiedAddressRole;
  draftId: string;
  draftRevision: number;
  address: AddressEvidenceAddress;
  now?: number;
  allowedProviderModes?: AddressProviderMode[];
}): AddressVerificationEvidencePayload | null {
  try {
    const token = typeof input.evidence === 'string' ? input.evidence : input.evidence.token;
    const [encoded, suppliedSignature, extra] = token.split('.');
    if (!encoded || !suppliedSignature || extra) return null;
    const expected = signature(encoded);
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AddressVerificationEvidencePayload;
    if (payload.version !== 1 || payload.role !== input.role || payload.draftId !== input.draftId || payload.draftRevision !== input.draftRevision) return null;
    if (payload.addressDigest !== getAddressDigest(input.address)) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < (input.now ?? Date.now())) return null;
    if (input.allowedProviderModes && !input.allowedProviderModes.includes(payload.providerMode)) return null;
    return payload;
  } catch {
    return null;
  }
}
