/**
 * Cartridge 08: 30-Day Mandatory Arbitration & Class-Action Waiver Opt-Out Notice
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 * Invariant 1: Strictly enforces assertNonFitnessEntity() on corporate recipient.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';
import { assertNonFitnessEntity } from '../guardrails';

export const arbitrationOptOutSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required').max(70),
  recipientFormalName: z.string().min(2, 'Company recipient name is required').max(80),
  productOrPlatformName: z.string().min(2, 'Product or platform name is required').max(60),
  accountIdentifier: z.string().min(2, 'Account email or serial number is required').max(60),
  termsEffectiveOrPurchaseDate: z.string().min(4, 'Terms effective or purchase date is required').max(30),
}).refine(
  (data) => {
    assertNonFitnessEntity(data.recipientFormalName);
    return true;
  },
  {
    message: 'Prohibited category: Gym, fitness club, and health club memberships (NAICS 713940) are strictly excluded from DocketStamp.',
    path: ['recipientFormalName'],
  }
);

export const arbitrationOptOutNotice: NoticeTemplateDefinition = {
  id: '30-day-mandatory-arbitration-opt-out-notice',
  slug: '30-day-mandatory-arbitration-opt-out-notice',
  aliases: ['arbitration-opt-out', 'class-action-opt-out', '30-day-arbitration-opt-out'],
  category: 'consumer_rights',
  title: 'Arbitration Opt-Out Notice',
  shortDescription: 'Send an arbitration opt-out notice if your agreement permits it.',
  documentHeaderTitle: 'FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS WAIVER',
  reLineTemplate: 'RE: Arbitration Opt-Out Request — {{productOrPlatformName}} ({{accountIdentifier}})',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Arbitration Opt-Out Notice | USPS Mail | DocketStamp',
    description: 'Prepare an arbitration opt-out notice after checking the governing agreement for eligibility, deadline, submission method, and address.',
    targetKeywords: [
      'arbitration opt out letter',
      'opt out of mandatory arbitration notice',
      'class action waiver opt out',
      'arbitration opt out notice',
      'roku arbitration opt out letter',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER NAME',
      inputType: 'text',
      placeholder: 'e.g., Jordan E. Blake',
      helperText: 'Your full legal name as registered with the service or account.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Company / Legal Department',
      docusignTagLabel: 'COMPANY / LEGAL DEPT',
      inputType: 'text',
      placeholder: 'e.g., Roku, Inc. — General Counsel & Arbitration Opt-Out',
      helperText: 'Enter the recipient and address specified by the agreement, if applicable.',
      maxLength: 80,
    },
    {
      key: 'productOrPlatformName',
      stepGroup: 'instrument_details',
      label: 'Company / Platform Name',
      docusignTagLabel: 'COMPANY / PLATFORM NAME',
      inputType: 'text',
      placeholder: 'e.g., Roku Smart OS Platform',
      helperText: 'The specific product, service, or platform whose arbitration clause you are opting out of.',
      maxLength: 60,
    },
    {
      key: 'accountIdentifier',
      stepGroup: 'instrument_details',
      label: 'Account Email or Serial #',
      docusignTagLabel: 'ACCOUNT EMAIL OR SERIAL #',
      inputType: 'text',
      placeholder: 'e.g., user@example.com or Device SN',
      helperText: 'The account email, username, or hardware serial number registered to you.',
      maxLength: 60,
    },
    {
      key: 'termsEffectiveOrPurchaseDate',
      stepGroup: 'instrument_details',
      label: 'Terms / Purchase Date',
      docusignTagLabel: 'TERMS / PURCHASE DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'Enter the relevant date. Check the agreement for eligibility and any deadline.',
      maxLength: 30,
    },
  ],
  zodSchema: arbitrationOptOutSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, give written notice that I elect to opt out of mandatory arbitration and any associated class-action waiver to the extent the governing agreement permits. This notice concerns {{productOrPlatformName}} and the terms or purchase date {{termsEffectiveOrPurchaseDate}}.',
    'Account or device identifier: {{accountIdentifier}}. My mailing address is {{senderFullAddress}}.',
    'Record this election and send written confirmation to {{senderFullAddress}}. If you contend that the election is unavailable, identify the provision that applies.',
  ],
};
