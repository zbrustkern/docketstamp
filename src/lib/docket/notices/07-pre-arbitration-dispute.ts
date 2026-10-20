/**
 * Cartridge 07: Pre-Arbitration Notice of Dispute & Feature Paywall Refund Request
 *
 * Conforms verbatim to Section 3 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md.
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
  title: 'Pre-Arbitration Notice of Dispute & Feature Paywall Refund Request',
  shortDescription: 'Formal written Pre-Arbitration Notice of Dispute demanding full refund or feature restoration before formal arbitration.',
  documentHeaderTitle: 'FORMAL PRE-ARBITRATION NOTICE OF DISPUTE AND REFUND REQUEST',
  reLineTemplate: 'RE: Mandatory Pre-Arbitration Notice of Dispute — {{productOrServiceName}} ({{accountOrSerialIdentifier}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Pre-Arbitration Notice of Dispute & Hardware Feature Refund | Certified Mail | DocketStamp',
    description: 'Dispatch a formal pre-arbitration notice of dispute and refund demand for post-purchase paywalled features or broken hardware terms via USPS Certified Mail.',
    targetKeywords: [
      'pre-arbitration notice of dispute',
      'hardware feature paywall refund',
      'mandatory informal dispute resolution notice',
      'aaa arbitration demand letter',
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
      helperText: 'The core commercial practice triggering this formal dispute.',
      maxLength: 100,
    },
    {
      key: 'factualSummary',
      stepGroup: 'instrument_details',
      label: 'Factual Statement',
      docusignTagLabel: 'FACTUAL STATEMENT',
      inputType: 'textarea_short',
      placeholder: 'e.g., Feature advertised at time of purchase was placed behind an unexpected monthly subscription fee.',
      helperText: 'Concise factual description of the diminished functionality or paywall.',
      maxLength: 200,
    },
    {
      key: 'requestedResolutionAmount',
      stepGroup: 'instrument_details',
      label: 'Refund Amount Requested',
      docusignTagLabel: 'REFUND AMOUNT REQUESTED',
      inputType: 'currency',
      placeholder: '$399.95',
      helperText: 'Total monetary compensation demanded to resolve the dispute amicably.',
      maxLength: 25,
    },
  ],
  zodSchema: preArbitrationDisputeSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that the undersigned consumer, {{senderFullName}}, hereby submits this formal written Pre-Arbitration Notice of Dispute pursuant to the mandatory informal dispute resolution provisions of the governing Terms of Service for {{productOrServiceName}} (Account/Device Identifier: {{accountOrSerialIdentifier}}, acquired on {{purchaseDate}}).',
    'NATURE OF DISPUTE: {{disputeTriggerCategory}}. Specifically: {{factualSummary}}',
    'This post-purchase modification or restriction materially diminishes the core functionality and bargained-for value of {{productOrServiceName}} as represented at the time of purchase.',
    'REQUESTED RESOLUTION: To resolve this matter amicably prior to the filing of formal consumer arbitration or small claims proceedings, please remit a full refund/settlement in the amount of {{requestedResolutionAmount}} (or confirm permanent restoration of the affected functionality without recurring fees) to {{senderFullName}} at {{senderFullAddress}} within thirty (30) days of receipt of this notice.',
  ],
};
