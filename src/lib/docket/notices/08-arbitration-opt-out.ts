/**
 * Cartridge 08: Arbitration Terms and Opt-Out Procedure Request
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
  slug: 'arbitration-opt-out-procedure-request',
  aliases: ['30-day-mandatory-arbitration-opt-out-notice', 'arbitration-opt-out', 'class-action-opt-out', '30-day-arbitration-opt-out', 'arbitration-opt-out-notice-30-day'],
  category: 'consumer_rights',
  title: '30-Day Mandatory Arbitration Opt-Out Notice',
  shortDescription: 'Exercise your right to opt out of mandatory binding arbitration and class-action waivers.',
  documentHeaderTitle: 'FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS ACTION WAIVER',
  reLineTemplate: 'RE: Timely Written Notice of Opt-Out from Mandatory Arbitration — {{productOrPlatformName}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Mandatory Arbitration Opt-Out Notice Letter | USPS Certified Mail | DocketStamp',
    description: 'Exercise your right to opt out of mandatory binding arbitration and class-action waivers within 30 days of updated terms using tracked USPS Certified Mail.',
    targetKeywords: [
      'arbitration opt out letter',
      'opt out of mandatory arbitration notice',
      'class action waiver opt out',
      '30 day arbitration opt out notice',
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
      placeholder: 'e.g., Roku, Inc. — Legal Department',
      helperText: 'The company or contact for this information request. This does not confirm an agreement-required opt-out channel.',
      maxLength: 80,
    },
    {
      key: 'productOrPlatformName',
      stepGroup: 'instrument_details',
      label: 'Company / Platform Name',
      docusignTagLabel: 'COMPANY / PLATFORM NAME',
      inputType: 'text',
      placeholder: 'e.g., Roku Smart OS Platform',
      helperText: 'The product or service connected to the agreement you want the company to identify.',
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
      label: 'Date Associated with the Agreement',
      docusignTagLabel: 'AGREEMENT DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you associate with the agreement, if known. It does not identify the agreement version or establish an opt-out period.',
      maxLength: 30,
    },
  ],
  zodSchema: arbitrationOptOutSchema,
  bodyParagraphs: [
    'PLEASE TAKE FORMAL NOTICE that I, {{senderFullName}}, hereby exercise my contractual right to formally opt out of the mandatory binding arbitration agreement and class action waiver set forth in the Terms of Service governing {{productOrPlatformName}} (terms effective or purchase date: {{termsEffectiveOrPurchaseDate}}).',
    'ACCOUNT & IDENTIFIER INFORMATION: Consumer Name: {{senderFullName}} | Account Email / Serial No: {{accountIdentifier}} | Registered Address: {{senderFullAddress}}.',
    'Please record this timely postmarked election in my permanent account record confirming that I retain all rights to resolve disputes before a court of competent jurisdiction. Please mail written confirmation of this opt-out registration to {{senderFullAddress}}.',
  ],
};
