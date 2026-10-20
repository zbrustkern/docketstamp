/**
 * Cartridge 05: Debt Dispute and Information Request
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const debtValidationSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required'),
  recipientFormalName: z.string().min(2, 'Collection agency or debt buyer name is required'),
  collectorReferenceNumber: z.string().min(1, 'Collection reference/file number is required').max(40),
  allegedOriginalCreditor: z.string().min(2, 'Original creditor name is required').max(60),
  allegedBalance: z.string().min(1, 'Alleged balance amount is required'),
  initialContactDate: z.string().min(4, 'Date shown on the communication is required'),
  communicationPreference: z.enum([
    'Please send future responses about this request in writing by U.S. Mail',
    'Please send a written response to the mailing address on this notice',
  ]),
});

export const debtValidationNotice: NoticeTemplateDefinition = {
  id: 'fdcpa-30-day-debt-validation-letter',
  slug: 'debt-dispute-information-request',
  aliases: ['fdcpa-30-day-debt-validation-letter', 'debt-validation', 'debt-validation-request', 'fdcpa-debt-validation', 'debt-validation-demand-letter-fdcpa-809'],
  category: 'credit_debt',
  title: 'Debt Dispute and Information Request',
  shortDescription: 'A general request to review a disputed collection balance and explain the account. It does not establish FDCPA coverage, a timely validation request, or a pause in collection.',
  documentHeaderTitle: 'DEBT DISPUTE AND REQUEST FOR ACCOUNT INFORMATION',
  reLineTemplate: 'RE: Account Dispute and Information Request — Reference No: {{collectorReferenceNumber}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_debt',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Debt Dispute and Information Request Letter | DocketStamp',
    description: 'Prepare a general written request disputing a collection balance and asking for account information. It does not confirm legal coverage, timeliness, or a collection pause.',
    targetKeywords: [
      'debt dispute letter',
      'collection balance information request',
      'dispute debt collection agency letter',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER NAME',
      inputType: 'text',
      placeholder: 'e.g., Morgan L. Davis',
      helperText: 'Your full legal name as addressed on collection communications.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Debt Collector / Agency Name',
      docusignTagLabel: 'COLLECTOR ENTITY NAME',
      inputType: 'text',
      placeholder: 'e.g., Portfolio Recovery Associates, LLC',
      helperText: 'The legal collection agency or debt buyer contacting you.',
      maxLength: 80,
    },
    {
      key: 'collectorReferenceNumber',
      stepGroup: 'instrument_details',
      label: 'Collector File / Reference Number',
      docusignTagLabel: 'COLLECTION REF #',
      inputType: 'text',
      placeholder: 'e.g., PRA-90214-X8',
      helperText: 'The account or file reference number on the collection notice.',
      maxLength: 40,
    },
    {
      key: 'allegedOriginalCreditor',
      stepGroup: 'instrument_details',
      label: 'Alleged Original Creditor',
      docusignTagLabel: 'ORIGINAL CREDITOR',
      inputType: 'text',
      placeholder: 'e.g., Synchrony Bank / Amazon Store Card',
      helperText: 'The original bank, lender, or merchant who originated the obligation.',
      maxLength: 60,
    },
    {
      key: 'allegedBalance',
      stepGroup: 'instrument_details',
      label: 'Amount Stated in Collection Communication',
      docusignTagLabel: 'ALLEGED AMOUNT',
      inputType: 'currency',
      placeholder: 'e.g., $1,420.50',
      helperText: 'The total balance claimed in the collection communication.',
      maxLength: 20,
    },
    {
      key: 'initialContactDate',
      stepGroup: 'instrument_details',
      label: 'Date on the Communication You Are Responding To',
      docusignTagLabel: 'COMMUNICATION DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'Enter the date shown on the collection communication you are responding to. It does not establish that a statutory period began on that date.',
      maxLength: 30,
    },
    {
      key: 'communicationPreference',
      stepGroup: 'instrument_details',
      label: 'Communication Directives',
      docusignTagLabel: 'COMMUNICATION PREFERENCE',
      inputType: 'select',
      placeholder: 'Please send future responses about this request in writing by U.S. Mail',
      options: [
        {
          label: 'Please send future responses about this request in writing by U.S. Mail',
          value: 'Please send future responses about this request in writing by U.S. Mail',
        },
        {
          label: 'Please send a written response to the mailing address on this notice',
          value: 'Please send a written response to the mailing address on this notice',
        },
      ],
      helperText: 'This is a communication preference, not a cease-communication demand or statement of legal effect.',
      maxLength: 100,
    },
  ],
  zodSchema: debtValidationSchema,
  bodyParagraphs: [
    'I am writing about your communication dated {{initialContactDate}} concerning reference number {{collectorReferenceNumber}}. It lists {{allegedOriginalCreditor}} as the original creditor and {{allegedBalance}} as the amount claimed.',
    'I dispute the amount stated in that communication. Please explain the current balance, including any payments, credits, interest, or fees included in it, and identify the entity claiming to collect the account.',
    'This is a general account dispute and request for information. It does not establish that a statutory validation procedure applies or that this request is timely under any such procedure.',
    'Please honor this communication preference for responses to this request: {{communicationPreference}}.',
  ],
};
