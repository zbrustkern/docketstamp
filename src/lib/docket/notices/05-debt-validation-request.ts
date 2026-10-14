/**
 * Notice Cartridge 05: 30-Day Debt Verification & Validation Request (FDCPA § 809)
 *
 * Mandatory statutory verification demand under 15 U.S.C. § 1692g.
 * Compels third-party collection agencies to immediately cease collection activities
 * until verified proof of debt and assignment is mailed to the consumer.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5.5)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const fdcpaValidationSchema = z.object({
  consumerFullName: z.string().min(2, 'Consumer legal name is required'),
  consumerAddress: z.string().min(5, 'Consumer mailing address is required'),
  collectionAgencyName: z.string().min(2, 'Collection agency name is required'),
  debtReferenceNumber: z.string().min(2, 'Account reference number is required'),
  originalCreditor: z.string().optional(),
  disputeStatement: z.string().min(5, 'Dispute statement is required'),
});

export const debtValidationNotice: NoticeTemplateDefinition = {
  id: 'fdcpa-debt-validation',
  slug: 'debt-validation-request',
  category: 'credit_debt',
  title: '30-Day Debt Verification & Validation Request (FDCPA § 809)',
  documentHeaderTitle: 'FORMAL DEMAND FOR VALIDATION OF DEBT PURSUANT TO FDCPA § 809',
  reLineTemplate: 'RE: Written Dispute and Demand for Debt Validation (Account / Reference #{{debtReferenceNumber}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'verified_or_manual_debt',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'FDCPA Debt Validation Letter | Cease Collection Demand | DocketStamp',
    description: 'Demand debt validation under 15 U.S.C. § 1692g and trigger an immediate mandatory statutory cease of collection activities via USPS Certified Mail.',
    targetKeywords: [
      'fdcpa debt validation letter',
      'debt validation request certified mail',
      '30 day debt validation demand',
      'cease and desist debt collector letter',
      'debt collector verification letter'
    ],
  },
  fields: [
    {
      key: 'consumerFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER LEGAL NAME',
      inputType: 'text',
      placeholder: 'e.g., Robert T. Miller',
      helperText: 'Your full legal name as it appears in correspondence.',
      maxLength: 70,
    },
    {
      key: 'consumerAddress',
      stepGroup: 'sender',
      label: 'Current Mailing Address',
      docusignTagLabel: 'CONSUMER MAILING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 2400 Peachtree Rd NW, Atlanta, GA 30305',
      helperText: 'Address where validation proof must be physically delivered.',
      maxLength: 120,
    },
    {
      key: 'collectionAgencyName',
      stepGroup: 'recipient',
      label: 'Collection Agency / Debt Buyer Name',
      docusignTagLabel: 'COLLECTION AGENCY NAME',
      inputType: 'text',
      placeholder: 'e.g., Portfolio Recovery Associates LLC',
      helperText: 'The name of the collection agency that contacted you or sent an initial notice.',
      maxLength: 80,
    },
    {
      key: 'debtReferenceNumber',
      stepGroup: 'instrument_details',
      label: 'Collection Account / File Reference Number',
      docusignTagLabel: 'ACCOUNT / REFERENCE #',
      inputType: 'text',
      placeholder: 'e.g., PRA-9918237',
      helperText: 'The account or file number printed on the collection letter.',
      maxLength: 40,
    },
    {
      key: 'originalCreditor',
      stepGroup: 'instrument_details',
      label: 'Original Creditor (if known)',
      docusignTagLabel: 'ORIGINAL CREDITOR',
      inputType: 'text',
      placeholder: 'e.g., Citibank, N.A.',
      helperText: 'The original bank or merchant who originated the account.',
      maxLength: 60,
    },
    {
      key: 'disputeStatement',
      stepGroup: 'instrument_details',
      label: 'Statement of Dispute',
      docusignTagLabel: 'DISPUTE STATEMENT',
      inputType: 'textarea_short',
      placeholder: 'e.g., I dispute the validity of this entire debt and the accuracy of the claimed balance. Provide proof of authority and original signed agreement.',
      helperText: 'A formal statement disputing the validity, assignment, or claimed balance of the debt.',
      maxLength: 350,
    },
  ],
  zodSchema: fdcpaValidationSchema,
  bodyParagraphs: [
    'This letter serves as formal written notice pursuant to 15 U.S.C. § 1692g of the Fair Debt Collection Practices Act (FDCPA) that the undersigned consumer disputes the validity of the alleged debt referenced under Account / File #{{debtReferenceNumber}}{{#originalCreditor}} allegedly originated with {{originalCreditor}}{{/originalCreditor}}.',
    'STATEMENT OF DISPUTE:\n{{disputeStatement}}',
    'STATUTORY CEASE-AND-DESIST DEMAND:\nPursuant to 15 U.S.C. § 1692g(b), you are federally mandated to IMMEDIATELY CEASE ALL COLLECTION ACTIVITIES, including telephone calls, written demands, and credit bureau reporting, until you obtain verification of the debt or a copy of a judgment and mail a copy of such verification to the consumer.',
    'Please provide: (1) competent written evidence that your agency possesses lawful standing and unbroken assignment to collect this debt, (2) an itemized calculation of all claimed principal, interest, attorney fees, and collection charges from the original creditor, and (3) a copy of the original agreement bearing the consumer\'s signature.',
    'FDCPA PENALTY ADMONITION:\nFailure to cease collection activities prior to mailing verified proof constitutes a direct violation of federal law under 15 U.S.C. § 1692k, subjecting the collector to civil liability, statutory damages, and reasonable attorney fees.',
  ],
  enclosuresLine: 'Enclosure: Copy of Initial Collection Notice / Billing Statement',
};
