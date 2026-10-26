/**
 * Cartridge 07: Product Complaint and Refund Request
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
    'Feature became unavailable or requires an additional payment',
    'Material service terms changed',
    'Advertisements appeared on a product or service',
    'Product or service did not work as expected',
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
  slug: 'product-complaint-refund-request',
  aliases: ['pre-arbitration-notice-of-dispute-and-refund-request', 'pre-arbitration-dispute', 'pre-arbitration-notice', 'feature-paywall-refund', 'smart-device-degraded-functionality-refund-demand'],
  category: 'consumer_rights',
  title: 'Pre-Arbitration Notice of Dispute & Feature Refund Demand',
  shortDescription: 'Demand a refund for removed or restricted features.',
  documentHeaderTitle: 'FORMAL PRE-ARBITRATION NOTICE OF DISPUTE AND REFUND DEMAND',
  reLineTemplate: 'RE: Mandatory Pre-Arbitration Dispute Notice — {{productOrServiceName}} ({{accountOrSerialIdentifier}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Pre-Arbitration Notice of Dispute & Feature Refund Demand | DocketStamp',
    description: 'Demand a refund for removed or restricted hardware features under governing Terms of Service dispute provisions using USPS Certified Mail.',
    targetKeywords: [
      'pre arbitration dispute notice',
      'product complaint and refund request',
      'hardware feature refund request',
      'smart device paywall refund demand',
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
      helperText: 'The company or contact you want to receive this general complaint. This does not confirm an agreement-required submission channel.',
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
      placeholder: 'Feature became unavailable or requires an additional payment',
      options: [
        {
          label: 'Feature became unavailable or requires an additional payment',
          value: 'Feature became unavailable or requires an additional payment',
        },
        {
          label: 'Material service terms changed',
          value: 'Material service terms changed',
        },
        {
          label: 'Advertisements appeared on a product or service',
          value: 'Advertisements appeared on a product or service',
        },
        {
          label: 'Product or service did not work as expected',
          value: 'Product or service did not work as expected',
        },
      ],
      helperText: 'Choose the description that best matches your concern; it is not a legal finding.',
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
      helperText: 'Enter the refund amount you are requesting. This is a request, not a determination that the amount is owed.',
      maxLength: 25,
    },
  ],
  zodSchema: preArbitrationDisputeSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that I, {{senderFullName}}, hereby submit this formal Pre-Arbitration Notice of Dispute pursuant to the informal dispute resolution provisions of the governing Terms of Service for {{productOrServiceName}} (Account/Serial ID: {{accountOrSerialIdentifier}}, Acquired: {{purchaseDate}}).',
    'NATURE OF DISPUTE: {{disputeTriggerCategory}}. Factual Summary: {{factualSummary}}.',
    'This post-purchase modification materially alters the functionality and agreed value of the product as represented at the time of purchase.',
    'REQUESTED RESOLUTION: To resolve this dispute amicably prior to the initiation of formal consumer arbitration or small claims proceedings, I demand a refund of {{requestedResolutionAmount}} (or restoration of full advertised functionality without recurring fees) delivered to {{senderFullAddress}} within thirty (30) days of receipt.',
  ],
};
