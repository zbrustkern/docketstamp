/**
 * Master document template registry and postal service metadata
 *
 * Exports standardized document templates and three USPS mailing service options.
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

export const ALL_DOCUMENT_TEMPLATES: NoticeTemplateDefinition[] = [
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

// Backward-compatibility alias
export const ALL_NOTICE_CARTRIDGES = ALL_DOCUMENT_TEMPLATES;

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

// Also populate aliases into NOTICE_REGISTRY for seamless lookup across both canonical slugs and aliases
for (const notice of ALL_DOCUMENT_TEMPLATES) {
  if (notice.aliases) {
    for (const alias of notice.aliases) {
      if (!NOTICE_REGISTRY[alias]) {
        NOTICE_REGISTRY[alias] = notice;
      }
    }
  }
}

// Internal lookup maps supporting canonical slugs, IDs, and aliases
const NOTICES_BY_SLUG = new Map<string, NoticeTemplateDefinition>();
const NOTICES_BY_ID = new Map<string, NoticeTemplateDefinition>();

for (const notice of ALL_DOCUMENT_TEMPLATES) {
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
 * Returns all active document templates.
 */
export function getAllNotices(): NoticeTemplateDefinition[] {
  return ALL_DOCUMENT_TEMPLATES;
}

export const getAllDocumentTemplates = getAllNotices;

/**
 * Resolves a document template by canonical slug or alias.
 */
export function getNoticeBySlug(slug: string): NoticeTemplateDefinition | undefined {
  if (!slug) return undefined;
  return NOTICES_BY_SLUG.get(slug.trim());
}

export const getDocumentTemplateBySlug = getNoticeBySlug;

/**
 * Resolves a document template by internal ID or alias.
 */
export function getNoticeById(id: string): NoticeTemplateDefinition | undefined {
  if (!id) return undefined;
  return NOTICES_BY_ID.get(id.trim());
}

export const getDocumentTemplateById = getNoticeById;

/**
 * Returns document templates belonging to a specific category.
 */
export function getNoticesByCategory(
  category: NoticeTemplateDefinition['category']
): NoticeTemplateDefinition[] {
  return ALL_DOCUMENT_TEMPLATES.filter((n) => n.category === category);
}

export const getDocumentTemplatesByCategory = getNoticesByCategory;

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
    description: 'Direct induction into the USPS First-Class postal stream with full DocketStamp certification record and PDF proof archive.',
    features: [
      'Official DocketStamp certification record',
      'CASS-certified USPS address standardization',
      'Full PDF proof archive and dispatch certificate',
      'USPS First-Class physical induction',
    ],
  },
  certified: {
    id: 'certified',
    name: 'USPS Certified Mail®',
    priceCents: 1995,
    formattedPrice: '$19.95',
    lobExtraService: 'certified',
    description: 'Official USPS Certified Mail® with unique tracking number, barcode chain-of-custody, and postmark verification.',
    features: [
      'Everything in First-Class Mail',
      'USPS Certified Mail® barcode and unique tracking number',
      'Official USPS proof of mailing and postmark verification',
      'Live transit tracking and delivery confirmation scans',
      'Permanent physical dispatch audit record',
    ],
  },
  certified_return_receipt: {
    id: 'certified_return_receipt',
    name: 'USPS Certified Mail® + Return Receipt',
    priceCents: 2795,
    formattedPrice: '$27.95',
    lobExtraService: 'certified_return_receipt',
    description: 'Maximum legal leverage: USPS Certified Mail® with Electronic Return Receipt (ERR) signature delivery verification.',
    features: [
      'Everything in USPS Certified Mail®',
      'USPS Electronic Return Receipt (ERR) signature delivery verification',
      'Legally recognized proof of recipient delivery and signature record',
      'Automated permanent return receipt PDF archival',
    ],
  },
};
