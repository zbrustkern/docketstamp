/**
 * Cartridge 05: FDCPA 30-Day Debt Verification & Validation Notice
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const debtValidationSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required'),
  recipientFormalName: z.string().min(2, 'Collection agency or debt buyer name is required'),
  collectorReferenceNumber: z.string().min(1, 'Collection reference/file number is required').max(40),
  allegedOriginalCreditor: z.string().min(2, 'Original creditor name is required').max(60),
  allegedBalance: z.string().min(1, 'Alleged balance amount is required'),
  initialContactDate: z.string().min(4, 'Date of initial communication is required'),
  communicationPreference: z.enum([
    'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
    'Please forward written verification documentation to the mailing address listed above',
  ]),
});

export const debtValidationNotice: NoticeTemplateDefinition = {
  id: 'fdcpa-30-day-debt-validation-letter',
  slug: 'fdcpa-30-day-debt-validation-letter',
  aliases: ['debt-validation', 'debt-validation-request', 'fdcpa-debt-validation'],
  category: 'credit_debt',
  title: 'Debt Dispute and Verification Demand',
  shortDescription: 'Challenge a collection claim and demand written verification.',
  documentHeaderTitle: 'DEBT DISPUTE AND DEMAND FOR VERIFICATION',
  reLineTemplate: 'RE: Debt Validation Request Pursuant to 15 U.S.C. § 1692g — Reference No: {{collectorReferenceNumber}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_debt',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Debt Dispute and Verification Demand | USPS Mail | DocketStamp',
    description: 'Dispute an alleged debt and request information about it. FDCPA protections depend on the collector, debt, and timing.',
    targetKeywords: [
      'debt validation letter',
      'fdcpa debt dispute verification request',
      'debt verification demand certified mail',
      'dispute debt collection agency letter',
      '15 usc 1692g validation notice',
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
      label: 'Alleged Amount Demanded',
      docusignTagLabel: 'ALLEGED AMOUNT',
      inputType: 'currency',
      placeholder: 'e.g., $1,420.50',
      helperText: 'The total balance claimed in the collection communication.',
      maxLength: 20,
    },
    {
      key: 'initialContactDate',
      stepGroup: 'instrument_details',
      label: 'Date of Initial Collection Communication',
      docusignTagLabel: 'DATE OF INITIAL NOTICE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'Enter the date shown on the communication. This date alone does not establish a validation deadline.',
      maxLength: 30,
    },
    {
      key: 'communicationPreference',
      stepGroup: 'instrument_details',
      label: 'Requested Communication Preference',
      docusignTagLabel: 'COMMUNICATION PREFERENCE',
      inputType: 'select',
      placeholder: 'Prefer future communication in writing by U.S. Mail',
      options: [
        {
          label: 'Prefer future communications in writing by U.S. Mail',
          value: 'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
        },
        {
          label: 'Request written verification at the mailing address above',
          value: 'Please forward written verification documentation to the mailing address listed above',
        },
      ],
      helperText: 'Choose a communication request. The selected wording does not establish a legal restriction.',
      maxLength: 100,
    },
  ],
  zodSchema: debtValidationSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, dispute the alleged debt identified in your communication dated {{initialContactDate}}: Reference {{collectorReferenceNumber}}, alleged original creditor {{allegedOriginalCreditor}}, and alleged balance {{allegedBalance}}.',
    'I demand verification of the alleged debt. Please send information identifying the original creditor and explaining the amount claimed.',
    'If the FDCPA applies and I submit this written dispute within the validation period, I demand that you cease collection of the disputed debt until you mail verification as required by 15 U.S.C. § 1692g(b). Send your response to {{senderFullAddress}}.',
    '{{communicationPreference}}',
  ],
};
