/**
 * Pre-Verified Corporate & Agency Recipient Registry
 *
 * Unified canonical verified recipients dataset re-exported from src/lib/docket/data/verified-recipients.ts
 * and guardrails from src/lib/docket/guardrails.ts.
 */

export * from '@/src/lib/docket/data/verified-recipients';
export {
  FORBIDDEN_FITNESS_NAICS,
  assertNonFitnessEntity,
  assertNotFitnessEntity,
  ConflictOfInterestError,
  FitnessEntityProhibitedError,
} from '@/src/lib/docket/guardrails';

export type VerifiedRecipient = import('@/src/lib/docket/types').VerifiedRecipientEntry;
export type RecipientCategory = import('@/src/lib/docket/types').RecipientCategory;
