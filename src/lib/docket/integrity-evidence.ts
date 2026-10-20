import { createHash } from 'node:crypto';
import type { DocumentIntegrityEvidence } from '@/lib/types';

export const SIGNATURE_AFFIRMATION_VERSION = 'self-represented-mail-dispatch-v1';

export function createDocumentIntegrityEvidence(
  frozenHtmlPayload: string,
  signerName: string,
  adoptedAt: number,
  lockedAt: number
): DocumentIntegrityEvidence {
  const digest = createHash('sha256')
    .update(Buffer.from(frozenHtmlPayload, 'utf8'))
    .digest('hex');

  return {
    schemaVersion: 1,
    algorithm: 'sha256',
    digest,
    lockedAt,
    signatureAdoption: {
      signerName,
      adoptedAt,
      affirmationVersion: SIGNATURE_AFFIRMATION_VERSION,
    },
  };
}
