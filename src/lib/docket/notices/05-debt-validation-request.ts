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
  communicationPreference: z.string().optional(),
});

export const debtValidationNotice: NoticeTemplateDefinition = {
  id: 'fdcpa-30-day-debt-validation-letter',
  slug: 'debt-dispute-information-request',
  aliases: ['fdcpa-30-day-debt-validation-letter', 'debt-validation', 'debt-validation-request', 'fdcpa-debt-validation', 'debt-validation-demand-letter-fdcpa-809'],
  category: 'credit_debt',
  title: 'FDCPA Debt Validation & Dispute Demand',
  shortDescription: 'Challenge a collection claim and demand written verification.',
  documentHeaderTitle: 'FORMAL NOTICE OF DEBT DISPUTE AND DEMAND FOR VALIDATION (15 U.S.C. § 1692g)',
  reLineTemplate: 'RE: Timely Dispute & Debt Validation Demand — Ref: {{collectorReferenceNumber}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_debt',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Debt Dispute and Verification Request | USPS Mail | DocketStamp',
    description: 'Dispute a collection claim, demand written verification, and state a communication preference.',
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
    'PLEASE TAKE NOTICE that I, {{senderFullName}}, hereby formally dispute the alleged debt referenced in your communication dated {{initialContactDate}} (Collector Reference: {{collectorReferenceNumber}}, Alleged Original Creditor: {{allegedOriginalCreditor}}, Alleged Balance: {{allegedBalance}}).',
    'Pursuant to the Fair Debt Collection Practices Act (15 U.S.C. § 1692g(b)), I demand written verification of this alleged debt, including the original contract, an itemized calculation of all principal, interest, and fees, and documentation establishing your legal authority to collect.',
    'In accordance with federal law, you must cease all collection activities until competent verification is provided. All future communications regarding this matter must be conducted in writing via U.S. Mail to {{senderFullAddress}}.',
  ],
};
