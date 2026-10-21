/**
 * Cartridge 07: Pre-Arbitration Notice of Dispute & Feature Paywall Refund Request
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 * Invariant 1: Strictly enforces assertNonFitnessEntity() on corporate recipient.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';
import { assertNonFitnessEntity } from '../guardrails';

export const preArbitrationDisputeSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required').max(70),
  recipientFormalName: z.string().min(2, 'Corporate recipient name is required').max(80),
  productOrServiceName: z.string().min(2, 'Product or service name is required').max(60),
  accountOrSerialIdentifier: z.string().min(2, 'Account or serial identifier is required').max(45),
  purchaseDate: z.string().min(4, 'Purchase or activation date is required').max(30),
  disputeTriggerCategory: z.enum([
    'Post-Purchase Removal or Paywalling of Advertised Feature',
    'Unilateral Modification of Material Terms of Service',
    'Injection of Unsolicited Commercial Advertisements on Hardware',
    'Breach of Express or Implied Hardware/Software Functionality',
  ]),
  factualSummary: z.string().min(5, 'Factual statement is required').max(200),
  requestedResolutionAmount: z.string().min(1, 'Refund amount is required').max(25),
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

export const preArbitrationDisputeNotice: NoticeTemplateDefinition = {
  id: 'pre-arbitration-notice-of-dispute-and-refund-request',
  slug: 'pre-arbitration-notice-of-dispute-and-refund-request',
  aliases: ['pre-arbitration-dispute', 'pre-arbitration-notice', 'feature-paywall-refund'],
  category: 'consumer_rights',
  title: 'Feature Refund Demand Letter',
  shortDescription: 'Demand a refund for a removed or restricted product feature.',
  documentHeaderTitle: 'FORMAL DEMAND FOR REFUND OR FEATURE RESTORATION',
  reLineTemplate: 'RE: Product Feature Dispute — {{productOrServiceName}} ({{accountOrSerialIdentifier}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Feature Refund Demand Letter | USPS Mail | DocketStamp',
    description: 'Prepare a demand for a refund or request for feature restoration based on facts you provide, then send it by USPS.',
    targetKeywords: [
      'pre-arbitration notice of dispute',
      'hardware feature paywall refund',
      'feature removal refund demand',
      'consumer dispute notice certified mail',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER NAME',
      inputType: 'text',
      placeholder: 'e.g., Morgan L. Vance',
      helperText: 'Your full legal name as registered on the product or account.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Corporate Entity / Legal Department',
      docusignTagLabel: 'CORPORATION / LEGAL DEPT',
      inputType: 'text',
      placeholder: 'e.g., Withings Inc. — Legal & Consumer Dispute Dept.',
      helperText: 'The formal legal name and department of the manufacturer or platform.',
      maxLength: 80,
    },
    {
      key: 'productOrServiceName',
      stepGroup: 'instrument_details',
      label: 'Product or Device Name',
      docusignTagLabel: 'PRODUCT / DEVICE NAME',
      inputType: 'text',
      placeholder: 'e.g., Withings Body Scan Smart Scale',
      helperText: 'The exact model or commercial name of the hardware device or subscription.',
      maxLength: 60,
    },
    {
      key: 'accountOrSerialIdentifier',
      stepGroup: 'instrument_details',
      label: 'Serial / Account ID',
      docusignTagLabel: 'SERIAL / ACCOUNT ID',
      inputType: 'text',
      placeholder: 'e.g., user@example.com / SN-94820184',
      helperText: 'Registered account email, device serial number, or IMEI identifier.',
      maxLength: 45,
    },
    {
      key: 'purchaseDate',
      stepGroup: 'instrument_details',
      label: 'Purchase Date',
      docusignTagLabel: 'PURCHASE DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The approximate date the device or service was originally purchased.',
      maxLength: 30,
    },
    {
      key: 'disputeTriggerCategory',
      stepGroup: 'instrument_details',
      label: 'Dispute Basis',
      docusignTagLabel: 'DISPUTE BASIS',
      inputType: 'select',
      placeholder: 'Post-Purchase Removal or Paywalling of Advertised Feature',
      options: [
        {
          label: 'Post-Purchase Removal or Paywalling of Advertised Feature',
          value: 'Post-Purchase Removal or Paywalling of Advertised Feature',
        },
        {
          label: 'Unilateral Modification of Material Terms of Service',
          value: 'Unilateral Modification of Material Terms of Service',
        },
        {
          label: 'Injection of Unsolicited Commercial Advertisements on Hardware',
          value: 'Injection of Unsolicited Commercial Advertisements on Hardware',
        },
        {
          label: 'Breach of Express or Implied Hardware/Software Functionality',
          value: 'Breach of Express or Implied Hardware/Software Functionality',
        },
      ],
      helperText: 'Choose the issue that best describes your reported dispute.',
      maxLength: 100,
    },
    {
      key: 'factualSummary',
      stepGroup: 'instrument_details',
      label: 'Factual Statement',
      docusignTagLabel: 'FACTUAL STATEMENT',
      inputType: 'textarea_short',
      placeholder: 'e.g., Feature advertised at time of purchase was placed behind an unexpected monthly subscription fee.',
      helperText: 'Briefly describe what happened, using facts you can support. Check the agreement for any required pre-dispute steps, recipient, method, or deadline. Line breaks are printed as spaces.',
      maxLength: 200,
    },
    {
      key: 'requestedResolutionAmount',
      stepGroup: 'instrument_details',
      label: 'Refund Amount Requested',
      docusignTagLabel: 'REFUND AMOUNT REQUESTED',
      inputType: 'currency',
      placeholder: '$399.95',
      helperText: 'The refund amount you are requesting. The letter does not establish that a contract-specific waiting period or procedure has been met.',
      maxLength: 25,
    },
  ],
  zodSchema: preArbitrationDisputeSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, am writing about {{productOrServiceName}} (Account/Device Identifier: {{accountOrSerialIdentifier}}), acquired on {{purchaseDate}}.',
    'The issue is {{disputeTriggerCategory}}. Specifically: {{factualSummary}}',
    'I demand a refund of {{requestedResolutionAmount}} or request restoration of the affected feature. I request a written response within 30 days of receipt, sent to {{senderFullAddress}}.',
  ],
};
