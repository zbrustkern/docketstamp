/**
 * Cartridge 08: 30-Day Mandatory Arbitration & Class-Action Waiver Opt-Out Notice
 *
 * Conforms verbatim to Section 3 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md.
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
  title: '30-Day Mandatory Arbitration & Class-Action Waiver Opt-Out Notice',
  shortDescription: 'Formal timely written election opting out of mandatory binding arbitration and class-action waivers under updated consumer terms.',
  documentHeaderTitle: 'FORMAL WRITTEN NOTICE OF OPT-OUT FROM ARBITRATION AND CLASS WAIVER',
  reLineTemplate: 'RE: Timely Notice of Opt-Out from Mandatory Arbitration — {{productOrPlatformName}} ({{accountIdentifier}})',
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
      placeholder: 'e.g., Roku, Inc. — General Counsel & Arbitration Opt-Out',
      helperText: 'The official company name and legal address designated in the arbitration opt-out clause.',
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
      helperText: 'The date updated terms were published/accepted, or date device was acquired.',
      maxLength: 30,
    },
  ],
  zodSchema: arbitrationOptOutSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that the undersigned consumer and account holder, {{senderFullName}}, hereby exercises the right to formally opt out of the mandatory binding arbitration provision and class-action waiver set forth in the Terms of Service or User Agreement governing {{productOrPlatformName}} (accepted or effective on {{termsEffectiveOrPurchaseDate}}).',
    'ACCOUNT & DEVICE IDENTIFICATION: Consumer Name: {{senderFullName}} | Registered Account / Email / Device Identifier: {{accountIdentifier}} | Registered Mailing Address: {{senderFullAddress}}.',
    'Please record this timely postmarked election in my permanent account file confirming that I retain all rights to resolve disputes before a court or regulatory agency of competent jurisdiction, and mail written confirmation of this opt-out registration to {{senderFullAddress}}.',
  ],
  enclosuresLine: 'Enclosure: Copy of Account Profile / Hardware Registration Documentation',
};
