/**
 * Cartridge 06: Service or Policy Cancellation Request
 *
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
  effectiveCancellationDate: z.string().min(4, 'Requested cancellation date is required'),
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
  slug: 'service-cancellation-request',
  aliases: ['written-contract-and-policy-cancellation-letter', 'service-policy-cancellation', 'service-cancellation', 'contract-membership-cancellation-notice'],
  category: 'cancellation',
  title: 'Service or Policy Cancellation Request',
  shortDescription: 'A general request to cancel a named service or policy. It does not confirm cancellation, end coverage, or revoke a separate payment authorization.',
  documentHeaderTitle: 'REQUEST TO CANCEL SERVICE OR POLICY',
  reLineTemplate: 'RE: Cancellation Request — {{serviceTypeLabel}} | Account/Policy No: {{accountOrPolicyNumber}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Service or Policy Cancellation Request Letter | DocketStamp',
    description: 'Prepare a written cancellation request and ask the provider to confirm its effective date and any required next steps. This request does not confirm that coverage or service has ended.',
    targetKeywords: [
      'service cancellation letter certified mail',
      'insurance policy cancellation request',
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
      label: 'Requested Cancellation Date',
      docusignTagLabel: 'REQUESTED CANCELLATION DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you are requesting. The provider may require another date or additional steps.',
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
    'I request cancellation of the {{serviceTypeLabel}} identified by account or policy number {{accountOrPolicyNumber}} and associated with {{servicePropertyAddress}}.',
    'I am requesting cancellation effective {{effectiveCancellationDate}}. Please confirm whether this request can be completed, the effective date, any steps or charges that may apply, and any refund you determine may be due.',
    'This letter is a request and does not itself confirm cancellation, end insurance coverage or service, or revoke a separate payment authorization.',
  ],
};
