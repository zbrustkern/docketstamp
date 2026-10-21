/**
 * Cartridge 06: Written Service Contract & Insurance Policy Cancellation
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 * Invariant 1: Strictly enforces assertNonFitnessEntity() on corporate recipient and contract fields.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';
import { assertNonFitnessEntity } from '../guardrails';

export const serviceCancellationSchema = z.object({
  senderFullName: z.string().min(2, 'Account holder legal name is required'),
  recipientFormalName: z.string().min(2, 'Service provider or insurer name is required'),
  accountOrPolicyNumber: z.string().min(2, 'Account or policy number is required').max(45),
  serviceTypeLabel: z.enum([
    'Home Security & Monitoring Agreement',
    'Residential Pest / Lawn Service Agreement',
    'Home Warranty Service Contract',
    'Telecommunications / Satellite Service Account',
    'Automobile / Property Insurance Policy',
    'Commercial / Residential Service Subscription',
  ]),
  effectiveCancellationDate: z.string().min(4, 'Effective cancellation date is required'),
  servicePropertyAddress: z.string().min(5, 'Service or covered property address is required').max(90),
}).refine(
  (data) => {
    assertNonFitnessEntity(data.recipientFormalName);
    assertNonFitnessEntity(data.serviceTypeLabel);
    return true;
  },
  {
    message: 'Prohibited category: Gym, fitness club, and health club subscriptions (NAICS 713940) are strictly excluded from DocketStamp.',
    path: ['recipientFormalName'],
  }
);

export const serviceCancellationNotice: NoticeTemplateDefinition = {
  id: 'written-contract-and-policy-cancellation-letter',
  slug: 'written-contract-and-policy-cancellation-letter',
  aliases: ['service-policy-cancellation', 'service-cancellation'],
  category: 'cancellation',
  title: 'Service or Policy Cancellation Notice',
  shortDescription: 'Cancel a service or policy in writing and request confirmation.',
  documentHeaderTitle: 'WRITTEN SERVICE OR POLICY CANCELLATION REQUEST',
  reLineTemplate: 'RE: Written Notice of Cancellation — {{serviceTypeLabel}} | Account/Policy No: {{accountOrPolicyNumber}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Service or Policy Cancellation Notice | USPS Mail | DocketStamp',
    description: 'Prepare a written service or policy cancellation notice, request your selected effective date, and ask for account confirmation.',
    targetKeywords: [
      'service cancellation letter certified mail',
      'insurance policy cancellation notice',
      'home security cancellation letter',
      'terminate recurring contract letter',
      'written contract cancellation notice',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Account Holder Full Legal Name',
      docusignTagLabel: 'ACCOUNT HOLDER NAME',
      inputType: 'text',
      placeholder: 'e.g., Casey J. Taylor',
      helperText: 'Your name as recorded on the account or insurance policy.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Service Provider / Insurance Company',
      docusignTagLabel: 'PROVIDER / INSURER NAME',
      inputType: 'text',
      placeholder: 'e.g., ADT Security Services',
      helperText: 'The legal corporate name of the service provider or insurance carrier.',
      maxLength: 80,
    },
    {
      key: 'accountOrPolicyNumber',
      stepGroup: 'instrument_details',
      label: 'Account or Policy Identifier',
      docusignTagLabel: 'POLICY / ACCOUNT #',
      inputType: 'text',
      placeholder: 'e.g., POL-8492019-A',
      helperText: 'Your account number, policy number, or customer ID to be terminated.',
      maxLength: 45,
    },
    {
      key: 'serviceTypeLabel',
      stepGroup: 'instrument_details',
      label: 'Agreement / Service Category',
      docusignTagLabel: 'AGREEMENT TYPE',
      inputType: 'select',
      placeholder: 'Home Security & Monitoring Agreement',
      options: [
        { label: 'Home Security & Monitoring Agreement', value: 'Home Security & Monitoring Agreement' },
        { label: 'Residential Pest / Lawn Service Agreement', value: 'Residential Pest / Lawn Service Agreement' },
        { label: 'Home Warranty Service Contract', value: 'Home Warranty Service Contract' },
        { label: 'Telecommunications / Satellite Service Account', value: 'Telecommunications / Satellite Service Account' },
        { label: 'Automobile / Property Insurance Policy', value: 'Automobile / Property Insurance Policy' },
        { label: 'Commercial / Residential Service Subscription', value: 'Commercial / Residential Service Subscription' },
      ],
      helperText: 'Select the contract classification.',
      maxLength: 60,
    },
    {
      key: 'effectiveCancellationDate',
      stepGroup: 'instrument_details',
      label: 'Effective Cancellation Date',
      docusignTagLabel: 'EFFECTIVE CANCELLATION DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you request for cancellation. Check your agreement for applicable terms and processing requirements.',
      maxLength: 30,
    },
    {
      key: 'servicePropertyAddress',
      stepGroup: 'instrument_details',
      label: 'Covered / Service Street Address',
      docusignTagLabel: 'SERVICE / COVERED ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 814 Oakwood Drive, Austin, TX 78704',
      helperText: 'The physical property location covered by this agreement or policy.',
      maxLength: 90,
    },
  ],
  zodSchema: serviceCancellationSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, give written notice to cancel the {{serviceTypeLabel}} identified by Account/Policy Number {{accountOrPolicyNumber}} for {{servicePropertyAddress}}.',
    'I request cancellation effective {{effectiveCancellationDate}} and revoke authorization for recurring automatic charges after cancellation takes effect.',
    'Please confirm the cancellation date and identify any remaining obligations or refund. Send written confirmation to {{senderFullAddress}}.',
  ],
};
