/**
 * Notice Cartridge 06: Written Service & Insurance Policy Cancellation Notice (Non-Fitness)
 *
 * Irrevocable written notice of contract termination, service cancellation, and EFT/ACH debit revocation.
 * Strictly non-fitness entities (home security, pest control, telecom, warranty, auto/home insurance).
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3.1, §5.6)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const serviceCancellationSchema = z.object({
  customerFullName: z.string().min(2, 'Customer legal name is required'),
  customerAddress: z.string().min(5, 'Billing/service address is required'),
  serviceProviderName: z.string().min(2, 'Service provider name is required'),
  contractCategory: z.string().min(2, 'Contract category is required'),
  accountOrPolicyNumber: z.string().min(2, 'Account or policy number is required'),
  cancellationEffectiveDate: z.string().min(4, 'Effective date is required'),
  reasonForCancellation: z.string().optional(),
});

export const serviceCancellationNotice: NoticeTemplateDefinition = {
  id: 'service-cancellation',
  slug: 'service-policy-cancellation',
  category: 'cancellation',
  title: 'Written Service & Insurance Policy Cancellation Notice',
  documentHeaderTitle: 'FORMAL WRITTEN NOTICE OF CONTRACT TERMINATION & CANCELLATION',
  reLineTemplate: 'RE: Irrevocable Notice of Cancellation - {{contractCategory}} (Account/Policy #{{accountOrPolicyNumber}})',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Formal Contract & Insurance Cancellation Letter | Certified Mail | DocketStamp',
    description: 'Dispatch an official written notice of contract cancellation and revoke recurring ACH/card billing authorizations via USPS Certified Mail.',
    targetKeywords: [
      'written notice of cancellation',
      'contract cancellation letter',
      'cancel home security certified mail',
      'insurance policy cancellation notice',
      'revoke ach debit authorization letter'
    ],
  },
  fields: [
    {
      key: 'customerFullName',
      stepGroup: 'sender',
      label: 'Account Holder Legal Name',
      docusignTagLabel: 'ACCOUNT HOLDER NAME',
      inputType: 'text',
      placeholder: 'e.g., Sarah Jenkins',
      helperText: 'Full legal name on file with the service provider or insurer.',
      maxLength: 70,
    },
    {
      key: 'customerAddress',
      stepGroup: 'sender',
      label: 'Billing / Service Address on File',
      docusignTagLabel: 'BILLING / SERVICE ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 780 Park Place, Seattle, WA 98101',
      helperText: 'The physical or billing address associated with the account.',
      maxLength: 120,
    },
    {
      key: 'serviceProviderName',
      stepGroup: 'recipient',
      label: 'Service Provider / Insurer Legal Name',
      docusignTagLabel: 'PROVIDER / INSURER NAME',
      inputType: 'text',
      placeholder: 'e.g., ADT Security Services',
      helperText: 'Non-fitness service provider, utility, warranty company, or insurer.',
      maxLength: 80,
    },
    {
      key: 'contractCategory',
      stepGroup: 'instrument_details',
      label: 'Contract Category (Non-Fitness Only)',
      docusignTagLabel: 'CONTRACT TYPE',
      inputType: 'select',
      placeholder: 'Home Security / Alarm Service',
      options: [
        { label: 'Home Security / Alarm Monitoring', value: 'Home Security / Alarm Monitoring' },
        { label: 'Pest Control Maintenance Service', value: 'Pest Control Maintenance Service' },
        { label: 'Telecommunications / Internet / Cable', value: 'Telecommunications / Internet' },
        { label: 'Home Warranty Plan', value: 'Home Warranty Plan' },
        { label: 'Auto / Homeowners Insurance Policy', value: 'Auto / Homeowners Insurance' },
      ],
      helperText: 'Note: Fitness and gym memberships are excluded under DocketStamp compliance policy.',
      maxLength: 50,
    },
    {
      key: 'accountOrPolicyNumber',
      stepGroup: 'instrument_details',
      label: 'Account / Policy / Agreement Number',
      docusignTagLabel: 'ACCOUNT / POLICY #',
      inputType: 'text',
      placeholder: 'e.g., ACCT #ADT-883921',
      helperText: 'The exact account, subscriber, or policy identifier.',
      maxLength: 40,
    },
    {
      key: 'cancellationEffectiveDate',
      stepGroup: 'instrument_details',
      label: 'Effective Cancellation Date',
      docusignTagLabel: 'EFFECTIVE CANCELLATION DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD or Month DD, YYYY',
      helperText: 'The date services must cease and recurring billing terminates.',
      maxLength: 30,
    },
    {
      key: 'reasonForCancellation',
      stepGroup: 'instrument_details',
      label: 'Reason for Cancellation (Optional)',
      docusignTagLabel: 'CANCELLATION REASON',
      inputType: 'textarea_short',
      placeholder: 'e.g., Relocating residence; contract term expired; switching providers.',
      helperText: 'Optional statement of why you are discontinuing service.',
      maxLength: 300,
    },
  ],
  zodSchema: serviceCancellationSchema,
  bodyParagraphs: [
    'Please accept this formal written instrument as unequivocal, irrevocable written notice that the undersigned is terminating and cancelling all services, policies, and contractual agreements associated with Account / Policy #{{accountOrPolicyNumber}} effective as of {{cancellationEffectiveDate}}.',
    'REVOCATION OF BILLING & PAYMENT AUTHORIZATION:\nEffective immediately upon receipt of this notice, all authorizations for recurring electronic fund transfers (EFT), automated clearinghouse (ACH) debits, and credit card charges associated with this account are permanently revoked.',
    '{{#reasonForCancellation}}STATED REASON FOR CANCELLATION:\n{{reasonForCancellation}}{{/reasonForCancellation}}{{^reasonForCancellation}}This written notice satisfies all contractual prerequisites for cancellation under the governing terms of service.{{/reasonForCancellation}}',
    'Please deliver written confirmation of this cancellation together with an itemized accounting of any prorated unearned premiums or prepaid balance refunds to the customer mailing address set forth above within ten (10) business days of confirmed USPS delivery.',
    'PROHIBITION OF UNAUTHORIZED CHARGES:\nAny unauthorized post-cancellation debits or billing attempts will be contested as fraudulent transactions and reported to the Consumer Financial Protection Bureau (CFPB), Federal Trade Commission (FTC), and state licensing authorities.',
  ],
  enclosuresLine: 'Enclosure: Copy of Billing Invoice / Policy Identification Card',
};
