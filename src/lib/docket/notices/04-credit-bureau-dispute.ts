/**
 * Notice Cartridge 04: Credit Bureau Written Dispute Notice (FCRA § 611)
 *
 * Mandatory 30-day statutory reinvestigation demand sent to Equifax, Experian, or TransUnion
 * under 15 U.S.C. § 1681i (Fair Credit Reporting Act).
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5.4)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const fcraDisputeSchema = z.object({
  consumerFullName: z.string().min(2, 'Consumer legal name is required'),
  consumerAddress: z.string().min(5, 'Mailing address is required'),
  consumerLast4Ssn: z.string().length(4, 'Last 4 digits of SSN required'),
  consumerDob: z.string().min(4, 'Date of birth is required'),
  targetBureau: z.string().min(2, 'Credit bureau selection is required'),
  disputedFurnisherName: z.string().min(2, 'Disputed creditor or furnisher name is required'),
  disputedAccountNumberPartial: z.string().min(2, 'Account reference number is required'),
  natureOfDispute: z.string().min(10, 'Factual basis of dispute is required'),
});

export const creditBureauDisputeNotice: NoticeTemplateDefinition = {
  id: 'fcra-credit-dispute',
  slug: 'credit-bureau-dispute',
  category: 'credit_debt',
  title: 'Credit Bureau Written Dispute Notice (FCRA § 611)',
  documentHeaderTitle: 'FORMAL NOTICE OF DISPUTE UNDER FAIR CREDIT REPORTING ACT § 611',
  reLineTemplate: 'RE: Formal Dispute of Inaccurate Trade-Line under 15 U.S.C. § 1681i (Furnisher: {{disputedFurnisherName}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_credit_bureau',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'FCRA 611 Credit Dispute Letter | Certified Mail to Equifax, Experian, TransUnion',
    description: 'Trigger a mandatory 30-day federal credit file reinvestigation under FCRA Section 611 via USPS Certified Mail with Return Receipt.',
    targetKeywords: [
      'fcra 611 credit dispute letter',
      'credit bureau certified mail dispute',
      'equifax certified dispute address',
      'experian formal dispute letter',
      'transunion 30 day reinvestigation letter'
    ],
  },
  fields: [
    {
      key: 'consumerFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER LEGAL NAME',
      inputType: 'text',
      placeholder: 'e.g., Jennifer K. Reynolds',
      helperText: 'Your full legal name as it appears on your government identification.',
      maxLength: 70,
    },
    {
      key: 'consumerAddress',
      stepGroup: 'sender',
      label: 'Current Residential Mailing Address',
      docusignTagLabel: 'CONSUMER MAILING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 100 Main St, Apt 401, Denver, CO 80202',
      helperText: 'Current address where the bureau must mail investigation results.',
      maxLength: 120,
    },
    {
      key: 'consumerLast4Ssn',
      stepGroup: 'sender',
      label: 'Social Security Number (Last 4 Digits Only)',
      docusignTagLabel: 'SSN (LAST 4)',
      inputType: 'text',
      placeholder: '1234',
      helperText: 'Required by credit bureaus for file matching under FCRA § 611.',
      maxLength: 4,
    },
    {
      key: 'consumerDob',
      stepGroup: 'sender',
      label: 'Date of Birth (MM/DD/YYYY)',
      docusignTagLabel: 'DATE OF BIRTH',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD or MM/DD/YYYY',
      helperText: 'Required by credit bureaus for identity verification.',
      maxLength: 20,
    },
    {
      key: 'targetBureau',
      stepGroup: 'recipient',
      label: 'Target Credit Reporting Agency',
      docusignTagLabel: 'CREDIT REPORTING BUREAU',
      inputType: 'select',
      placeholder: 'Equifax Information Services LLC',
      options: [
        { label: 'Equifax Information Services LLC', value: 'Equifax Information Services LLC' },
        { label: 'Experian Consumer Dispute Center', value: 'Experian' },
        { label: 'TransUnion Consumer Solutions', value: 'TransUnion Consumer Solutions' },
        { label: 'Innovis Consumer Assistance', value: 'Innovis Consumer Assistance' },
      ],
      helperText: 'Select the credit reporting agency maintaining the inaccurate trade-line.',
      maxLength: 50,
    },
    {
      key: 'disputedFurnisherName',
      stepGroup: 'instrument_details',
      label: 'Creditor / Data Furnisher Name on Report',
      docusignTagLabel: 'CREDITOR / FURNISHER NAME',
      inputType: 'text',
      placeholder: 'e.g., Midland Credit Management / Chase Bank',
      helperText: 'The name of the entity that reported the trade-line to the bureau.',
      maxLength: 80,
    },
    {
      key: 'disputedAccountNumberPartial',
      stepGroup: 'instrument_details',
      label: 'Account Identifier / Number on File',
      docusignTagLabel: 'ACCOUNT #',
      inputType: 'text',
      placeholder: 'e.g., ACCT #4812-XXXX',
      helperText: 'Account number or partial masked number shown on your credit report.',
      maxLength: 40,
    },
    {
      key: 'natureOfDispute',
      stepGroup: 'instrument_details',
      label: 'Factual Grounds & Specific Errors Disputed',
      docusignTagLabel: 'FACTUAL GROUNDS OF DISPUTE',
      inputType: 'textarea_short',
      placeholder: 'e.g., Account was paid in full on Dec 2025. Bureau is incorrectly reporting delinquent balance. Never received 30-day notice.',
      helperText: 'State the specific factual inaccuracies: wrong balance, wrong dates, fraudulent account, or unverified status.',
      maxLength: 400,
    },
  ],
  zodSchema: fcraDisputeSchema,
  bodyParagraphs: [
    'This letter is a formal notice of dispute submitted pursuant to Section 611 of the Fair Credit Reporting Act, 15 U.S.C. § 1681i. The consumer credit report maintained under my identifying information contains inaccurate, incomplete, or unverified trade-line data as itemized below.',
    'DISPUTED TRADE-LINE IDENTIFICATION:\nCreditor / Data Furnisher: {{disputedFurnisherName}}\nAccount Reference Identifier: {{disputedAccountNumberPartial}}',
    'FACTUAL GROUNDS OF DISPUTE:\n{{natureOfDispute}}',
    'Pursuant to 15 U.S.C. § 1681i(a)(1), you are federally mandated to conduct a free and thorough reinvestigation of the disputed information, notify the data furnisher within five (5) business days pursuant to § 1681i(a)(2), and complete all reinvestigation procedures within thirty (30) calendar days of confirmed USPS delivery of this notice.',
    'If the data furnisher fails to verify the accuracy of the trade-line within the statutory 30-day window, the item must be promptly and permanently deleted from my credit file pursuant to 15 U.S.C. § 1681i(a)(5).',
    'MANDATORY STATUTORY NOTICE OF DISPUTE RESULTS:\nUpon completion of your reinvestigation, please deliver written results and an updated, free copy of my consumer disclosure file to the mailing address set forth above, as required by 15 U.S.C. § 1681i(a)(6).',
  ],
  enclosuresLine: 'Enclosures: Copy of Government Photo ID, Proof of Address (Utility Bill), Relevant Account Statements',
};
