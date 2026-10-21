/**
 * Cartridge 04: FCRA § 611 Credit Bureau Written Dispute Notice
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const creditBureauDisputeSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required'),
  recipientFormalName: z.string().min(2, 'Credit bureau name is required'),
  bureauEntityId: z.enum(['cra_eqf', 'cra_exp', 'cra_tru', 'bureau-equifax', 'bureau-experian', 'bureau-transunion']),
  senderDob: z.string().min(4, 'Date of birth is required'),
  ssnLast4: z.string().regex(/^\d{4}$/, 'Must be exactly 4 numeric digits'),
  furnisherName: z.string().min(2, 'Furnisher or creditor name is required').max(60),
  partialAccountNumber: z.string().min(2, 'Account reference number is required').max(30),
  disputeReason: z.enum([
    'Account does not belong to me / Identity discrepancy',
    'Balance or past-due amount is inaccurately reported',
    'Account status (late payment / charge-off) is inaccurate',
    'Account was paid/settled in full but reflects open balance',
    'Duplicate tradeline reporting on file',
    'Account exceeds statutory 7-year reporting period',
  ]),
  factualExplanation: z.string().min(5, 'Factual statement is required').max(200),
});

export const creditBureauDisputeNotice: NoticeTemplateDefinition = {
  id: 'fcra-credit-bureau-written-dispute-letter',
  slug: 'fcra-credit-bureau-written-dispute-letter',
  aliases: ['credit-bureau-dispute', 'fcra-credit-dispute'],
  category: 'credit_debt',
  title: 'Credit Report Dispute Letter',
  shortDescription: 'Dispute a credit-report error and request an investigation.',
  documentHeaderTitle: 'WRITTEN NOTICE OF CREDIT FILE INACCURACY AND REINVESTIGATION REQUEST',
  reLineTemplate: 'RE: FCRA § 611 Consumer File Dispute (15 U.S.C. § 1681i) — SSN Ending in XXX-XX-{{ssnLast4}} | DOB: {{senderDob}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_credit_bureau',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Credit Report Dispute Letter | USPS Mail | DocketStamp',
    description: 'Dispute information on a credit report and request a reasonable reinvestigation and any correction required by applicable FCRA rules.',
    targetKeywords: [
      'credit bureau dispute letter',
      'fcra 611 dispute letter certified mail',
      'credit report inaccuracy letter',
      'credit bureau reinvestigation request',
      'written dispute equifax experian transunion',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER NAME',
      inputType: 'text',
      placeholder: 'e.g., Taylor S. Morgan',
      helperText: 'Your full legal name currently appearing on your credit disclosure.',
      maxLength: 70,
    },
    {
      key: 'bureauEntityId',
      stepGroup: 'recipient',
      label: 'Target Credit Reporting Agency',
      docusignTagLabel: 'SELECT CREDIT BUREAU',
      inputType: 'select',
      placeholder: 'cra_eqf',
      options: [
        { label: 'Equifax Information Services LLC', value: 'cra_eqf' },
        { label: 'Experian National Consumer Assistance Center', value: 'cra_exp' },
        { label: 'TransUnion Consumer Solutions', value: 'cra_tru' },
      ],
      helperText: 'Select the credit bureau maintaining the disputed file.',
      maxLength: 20,
    },
    {
      key: 'senderDob',
      stepGroup: 'instrument_details',
      label: 'Date of Birth (MM/DD/YYYY)',
      docusignTagLabel: 'DATE OF BIRTH',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'Required by credit bureaus to locate and verify your consumer credit file.',
      maxLength: 15,
    },
    {
      key: 'ssnLast4',
      stepGroup: 'instrument_details',
      label: 'Social Security Number (Last 4 Digits Only)',
      docusignTagLabel: 'LAST 4 SSN',
      inputType: 'text',
      placeholder: '1234',
      helperText: 'For consumer identification. Do NOT provide full SSN; only the last 4 digits.',
      maxLength: 4,
    },
    {
      key: 'furnisherName',
      stepGroup: 'instrument_details',
      label: 'Furnisher / Creditor Name',
      docusignTagLabel: 'CREDITOR / ACCOUNT NAME',
      inputType: 'text',
      placeholder: 'e.g., Apex Financial Services',
      helperText: 'The bank, lender, or collection agency reporting the inaccurate tradeline.',
      maxLength: 60,
    },
    {
      key: 'partialAccountNumber',
      stepGroup: 'instrument_details',
      label: 'Account Reference / File Number',
      docusignTagLabel: 'ACCOUNT NUMBER',
      inputType: 'text',
      placeholder: 'e.g., 4012-XXXX-XXXX-9912',
      helperText: 'Account number or tradeline identifier as displayed on your credit report.',
      maxLength: 30,
    },
    {
      key: 'disputeReason',
      stepGroup: 'instrument_details',
      label: 'Primary Basis of Inaccuracy',
      docusignTagLabel: 'DISPUTE BASIS',
      inputType: 'select',
      placeholder: 'Account does not belong to me / Identity discrepancy',
      options: [
        {
          label: 'Account does not belong to me / Identity discrepancy',
          value: 'Account does not belong to me / Identity discrepancy',
        },
        {
          label: 'Balance or past-due amount is inaccurately reported',
          value: 'Balance or past-due amount is inaccurately reported',
        },
        {
          label: 'Account status (late payment / charge-off) is inaccurate',
          value: 'Account status (late payment / charge-off) is inaccurate',
        },
        {
          label: 'Account was paid/settled in full but reflects open balance',
          value: 'Account was paid/settled in full but reflects open balance',
        },
        {
          label: 'Duplicate tradeline reporting on file',
          value: 'Duplicate tradeline reporting on file',
        },
        {
          label: 'Account exceeds statutory 7-year reporting period',
          value: 'Account exceeds statutory 7-year reporting period',
        },
      ],
      helperText: 'Choose the reason that best matches the error you report.',
      maxLength: 80,
    },
    {
      key: 'factualExplanation',
      stepGroup: 'instrument_details',
      label: 'Concise Factual Statement',
      docusignTagLabel: 'FACTUAL STATEMENT',
      inputType: 'textarea_short',
      placeholder: 'e.g., This account was settled for a zero balance on March 15, 2026, but continues to report a past-due balance of $480.',
      helperText: 'State the specific factual error that needs correction or deletion. Line breaks are printed as spaces.',
      maxLength: 200,
    },
  ],
  zodSchema: creditBureauDisputeSchema,
  bodyParagraphs: [
    'Pursuant to Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i), I am submitting this formal written notice to dispute inaccurate information currently appearing on my consumer credit file maintained by {{recipientFormalName}}.',
    'DISPUTED TRADELINE IDENTIFICATION: Furnisher / Creditor Name: {{furnisherName}} | Account Reference: {{partialAccountNumber}}.',
    'BASIS OF INACCURACY: {{disputeReason}}. Specifically: {{factualExplanation}}',
    'Under 15 U.S.C. § 1681i, I request a reasonable reinvestigation of the information identified above. Please correct or delete information as required by applicable law, send me the results, and provide an updated consumer disclosure when required.',
  ],
};
