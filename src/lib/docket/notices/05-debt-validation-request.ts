/**
 * Cartridge 05: FDCPA 30-Day Debt Verification & Validation Notice
 *
 * Conforms verbatim to Section 8 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md.
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
  title: 'FDCPA 30-Day Debt Verification & Validation Notice',
  shortDescription: 'Statutory 15 U.S.C. § 1692g dispute demanding debt validation, proof of claim authority, and cessation of collection activities.',
  documentHeaderTitle: 'STATUTORY NOTICE OF DISPUTE AND REQUEST FOR DEBT VALIDATION',
  reLineTemplate: 'RE: Debt Validation Request Pursuant to 15 U.S.C. § 1692g — Reference No: {{collectorReferenceNumber}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_debt',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'FDCPA Debt Validation Letter | Send via USPS Certified Mail | DocketStamp',
    description: 'Demand statutory debt validation under 15 U.S.C. § 1692g with cease-and-desist instructions via USPS Certified Mail with Return Receipt proof.',
    targetKeywords: [
      'debt validation letter',
      'fdcpa 30 day validation request',
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
      helperText: 'Date of the collection letter or first contact triggering the 30-day window.',
      maxLength: 30,
    },
    {
      key: 'communicationPreference',
      stepGroup: 'instrument_details',
      label: 'Communication Directives',
      docusignTagLabel: 'COMMUNICATION PREFERENCE',
      inputType: 'select',
      placeholder: 'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
      options: [
        {
          label: 'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
          value: 'All future communications regarding this matter must be conducted strictly in writing by U.S. Mail',
        },
        {
          label: 'Please forward written verification documentation to the mailing address listed above',
          value: 'Please forward written verification documentation to the mailing address listed above',
        },
      ],
      helperText: 'Specifies lawful communication constraints under FDCPA § 805(c).',
      maxLength: 100,
    },
  ],
  zodSchema: debtValidationSchema,
  bodyParagraphs: [
    'This letter serves as formal written notice pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g, in response to your communication dated {{initialContactDate}} referencing Account/File No. {{collectorReferenceNumber}} (Alleged Original Creditor: {{allegedOriginalCreditor}}; Alleged Balance: {{allegedBalance}}).',
    'PLEASE TAKE NOTICE that I formally dispute the validity and amount of the alleged debt referenced above in its entirety and request full statutory verification.',
    'Please provide documentary verification of this obligation, including: (a) the name and address of the original creditor; (b) an itemized accounting of the principal balance and any interest or fees assessed; and (c) documentation establishing your organization\'s legal authority to collect this alleged obligation.',
    'Pursuant to 15 U.S.C. § 1692g(b), please cease collection activities on this disputed account until written verification is mailed to {{senderFullAddress}}. Furthermore: {{communicationPreference}}.',
  ],
};
