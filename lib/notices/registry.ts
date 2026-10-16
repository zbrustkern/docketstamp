/**
 * Notice Cartridge Registry
 *
 * Unified canonical notice cartridges re-exported from src/lib/docket/notices
 * and statutory disclosures from src/lib/docket/guardrails.
 */

export * from '@/src/lib/docket/notices';
export {
  UPL_COMPLIANCE_DISCLOSURE,
  UPL_COMPLIANCE_FOOTER_TEXT,
  STATUTORY_COMPLIANCE_DISCLOSURE,
} from '@/src/lib/docket/guardrails';

import { getAllNotices } from '@/src/lib/docket/notices';
export const getAllNoticeTemplates = getAllNotices;
export type NoticeId = import('@/src/lib/docket/types').NoticeTemplateDefinition['slug'];
