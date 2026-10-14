/**
 * Master Notice Cartridge Registry
 *
 * Exports all deterministic Notice Cartridges for DocketStamp.
 * Adding Notice #7 requires creating a single file in notices/ and adding one line here,
 * without touching UI or checkout plumbing.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5)
 * - docs/DESIGN_SYSTEM.md (§1)
 */

import { NoticeTemplateDefinition } from '../types';
import { intentToVacateNotice } from './01-intent-to-vacate';
import { securityDepositNotice } from './02-security-deposit-return';
import { tenantRepairNotice } from './03-tenant-repair-request';
import { creditBureauDisputeNotice } from './04-credit-bureau-dispute';
import { debtValidationNotice } from './05-debt-validation-request';
import { serviceCancellationNotice } from './06-service-policy-cancellation';

export {
  intentToVacateNotice,
  securityDepositNotice,
  tenantRepairNotice,
  creditBureauDisputeNotice,
  debtValidationNotice,
  serviceCancellationNotice,
};

export const ALL_NOTICE_CARTRIDGES: NoticeTemplateDefinition[] = [
  intentToVacateNotice,
  securityDepositNotice,
  tenantRepairNotice,
  creditBureauDisputeNotice,
  debtValidationNotice,
  serviceCancellationNotice,
];

const NOTICES_BY_SLUG = new Map<string, NoticeTemplateDefinition>();
const NOTICES_BY_ID = new Map<string, NoticeTemplateDefinition>();

for (const notice of ALL_NOTICE_CARTRIDGES) {
  NOTICES_BY_SLUG.set(notice.slug, notice);
  NOTICES_BY_ID.set(notice.id, notice);
}

/**
 * Returns all active notice cartridges.
 */
export function getAllNotices(): NoticeTemplateDefinition[] {
  return ALL_NOTICE_CARTRIDGES;
}

/**
 * Resolves a notice cartridge by URL slug (e.g., "intent-to-vacate", "security-deposit-return").
 */
export function getNoticeBySlug(slug: string): NoticeTemplateDefinition | undefined {
  return NOTICES_BY_SLUG.get(slug);
}

/**
 * Resolves a notice cartridge by internal ID (e.g., "tenant-vacate-notice", "security-deposit-demand").
 */
export function getNoticeById(id: string): NoticeTemplateDefinition | undefined {
  return NOTICES_BY_ID.get(id);
}

/**
 * Returns notices belonging to a specific category.
 */
export function getNoticesByCategory(
  category: NoticeTemplateDefinition['category']
): NoticeTemplateDefinition[] {
  return ALL_NOTICE_CARTRIDGES.filter((n) => n.category === category);
}
