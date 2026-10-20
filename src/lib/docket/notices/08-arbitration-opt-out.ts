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
  title: 'Arbitration Terms and Opt-Out Procedure Request',
  shortDescription: 'A general request for the agreement version and any opt-out steps. This letter does not itself exercise or confirm an opt-out, timeliness, or preservation of rights.',
  documentHeaderTitle: 'REQUEST FOR ARBITRATION TERMS AND ANY OPT-OUT PROCEDURE',
  reLineTemplate: 'RE: Request for Agreement Information — {{productOrPlatformName}} ({{accountIdentifier}})',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Arbitration Agreement Information Request | DocketStamp',
    description: 'Request the agreement version associated with your account and information about any opt-out process. This form does not itself submit an opt-out.',
    targetKeywords: [
      'arbitration agreement information request',
      'arbitration opt-out process information',
      'request arbitration terms',
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
    'I am writing about the agreement associated with {{productOrPlatformName}} and the account identifier {{accountIdentifier}}. The date I associate with the agreement is {{termsEffectiveOrPurchaseDate}}.',
    'Please send me the agreement version associated with this account and explain any opt-out procedure, including its deadline, required submission channel, and scope, if an opt-out is available.',
    'This is an information request only. It does not itself exercise an opt-out, establish that a deadline or required channel has been met, or determine which rights or procedures apply.',
  ],
};
