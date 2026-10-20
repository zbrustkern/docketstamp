/**
 * Master document template registry and postal service metadata
 *
 * Exports deterministic document templates and three USPS mailing service options.
 */

import { NoticeTemplateDefinition, MailTierId, PricingTierMetadata } from '../types';
import { intentToVacateNotice } from './01-intent-to-vacate';
import { securityDepositNotice } from './02-security-deposit-return';
import { tenantRepairNotice } from './03-tenant-repair-request';
import { creditBureauDisputeNotice } from './04-credit-bureau-dispute';
import { debtValidationNotice } from './05-debt-validation-request';
import { serviceCancellationNotice } from './06-service-policy-cancellation';
import { preArbitrationDisputeNotice } from './07-pre-arbitration-dispute';
import { arbitrationOptOutNotice } from './08-arbitration-opt-out';
import { biometricPrivacyDeletionNotice } from './09-biometric-privacy-deletion';

export {
  intentToVacateNotice,
  securityDepositNotice,
  tenantRepairNotice,
  creditBureauDisputeNotice,
  debtValidationNotice,
  serviceCancellationNotice,
  preArbitrationDisputeNotice,
  arbitrationOptOutNotice,
  biometricPrivacyDeletionNotice,
};

export const ALL_NOTICE_CARTRIDGES: NoticeTemplateDefinition[] = [
  intentToVacateNotice,
  securityDepositNotice,
  tenantRepairNotice,
  creditBureauDisputeNotice,
  debtValidationNotice,
  serviceCancellationNotice,
  preArbitrationDisputeNotice,
  arbitrationOptOutNotice,
  biometricPrivacyDeletionNotice,
];

export const NOTICE_REGISTRY: Record<string, NoticeTemplateDefinition> = {
  [intentToVacateNotice.slug]: intentToVacateNotice,
  [securityDepositNotice.slug]: securityDepositNotice,
  [tenantRepairNotice.slug]: tenantRepairNotice,
  [creditBureauDisputeNotice.slug]: creditBureauDisputeNotice,
  [debtValidationNotice.slug]: debtValidationNotice,
  [serviceCancellationNotice.slug]: serviceCancellationNotice,
  [preArbitrationDisputeNotice.slug]: preArbitrationDisputeNotice,
  [arbitrationOptOutNotice.slug]: arbitrationOptOutNotice,
  [biometricPrivacyDeletionNotice.slug]: biometricPrivacyDeletionNotice,
};

// Internal lookup maps supporting canonical slugs, IDs, and aliases
const NOTICES_BY_SLUG = new Map<string, NoticeTemplateDefinition>();
const NOTICES_BY_ID = new Map<string, NoticeTemplateDefinition>();

for (const notice of ALL_NOTICE_CARTRIDGES) {
  NOTICES_BY_SLUG.set(notice.slug, notice);
  NOTICES_BY_ID.set(notice.id, notice);

  if (notice.aliases) {
    for (const alias of notice.aliases) {
      NOTICES_BY_SLUG.set(alias, notice);
      NOTICES_BY_ID.set(alias, notice);
    }
  }
}

/**
 * Returns all active notice cartridges.
 */
export function getAllNotices(): NoticeTemplateDefinition[] {
  return ALL_NOTICE_CARTRIDGES;
}

/**
 * Resolves a notice cartridge by canonical slug or alias.
 */
export function getNoticeBySlug(slug: string): NoticeTemplateDefinition | undefined {
  if (!slug) return undefined;
  return NOTICES_BY_SLUG.get(slug.trim());
}

/**
 * Resolves a notice cartridge by internal ID or alias.
 */
export function getNoticeById(id: string): NoticeTemplateDefinition | undefined {
  if (!id) return undefined;
  return NOTICES_BY_ID.get(id.trim());
}

/**
 * Returns notices belonging to a specific category.
 */
export function getNoticesByCategory(
  category: NoticeTemplateDefinition['category']
): NoticeTemplateDefinition[] {
  return ALL_NOTICE_CARTRIDGES.filter((n) => n.category === category);
}

/**
 * USPS mailing service options and pricing.
 */
export const DOCKET_PRICING_TIERS: Record<MailTierId, PricingTierMetadata> = {
  first_class: {
    id: 'first_class',
    name: 'Standard First-Class Mail',
    priceCents: 1295,
    formattedPrice: '$12.95',
    lobExtraService: undefined,
    description: 'Standard USPS First-Class Mail. Tracking information may be limited.',
    features: [
      'DocketStamp record of the prepared notice',
      'USPS address standardization when available',
      'Mailing status and tracking details when provided',
      'Copy of the prepared notice',
    ],
  },
  certified: {
    id: 'certified',
    name: 'USPS Certified Mail®',
    priceCents: 1995,
    formattedPrice: '$19.95',
    lobExtraService: 'certified',
    description: 'USPS Certified Mail with tracking and status records from USPS as available.',
    features: [
      'DocketStamp record of the prepared notice',
      'USPS Certified Mail® service and tracking number',
      'USPS acceptance and delivery records when available',
      'USPS address standardization when available',
      'Copies of the prepared notice and available status records',
    ],
  },
  certified_return_receipt: {
    id: 'certified_return_receipt',
    name: 'USPS Certified Mail® + Return Receipt',
    priceCents: 2795,
    formattedPrice: '$27.95',
    lobExtraService: 'certified_return_receipt',
    description: 'USPS Certified Mail with an Electronic Return Receipt request; USPS records are shown when available.',
    features: [
      'Everything in USPS Certified Mail®',
      'Electronic Return Receipt request',
      'Return-receipt record if provided by USPS',
      'Separate records for available acceptance, tracking, and delivery events',
    ],
  },
};
