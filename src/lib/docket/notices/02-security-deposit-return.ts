/**
 * Notice Cartridge 02: Statutory Security Deposit Return & Accounting Demand
 *
 * Formal demand under 50-State + DC statutory security deposit return laws.
 * Automatically pulls governing statutory citations, return deadlines, and bad-faith penalties.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5.2)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const securityDepositSchema = z.object({
  tenantFullName: z.string().min(2, 'Tenant legal name is required'),
  landlordOrManagerName: z.string().min(2, 'Landlord or management company is required'),
  rentalPropertyAddress: z.string().min(5, 'Rental address is required'),
  rentalState: z.string().length(2, '2-letter state code is required'),
  surrenderDate: z.string().min(4, 'Surrender/move-out date is required'),
  depositAmount: z.string().min(1, 'Security deposit amount is required'),
  disputedDeductions: z.string().optional(),
  forwardingAddress: z.string().min(5, 'Forwarding address is required'),
});

export const securityDepositNotice: NoticeTemplateDefinition = {
  id: 'security-deposit-demand',
  slug: 'security-deposit-return',
  category: 'tenant',
  title: 'Statutory Security Deposit Return & Accounting Demand',
  documentHeaderTitle: 'FORMAL DEMAND FOR RETURN OF RESIDENTIAL SECURITY DEPOSIT',
  reLineTemplate: 'RE: Final Statutory Demand for Immediate Return of Security Deposit in the Amount of {{depositAmount}}',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: true,
  seoMeta: {
    title: 'Demand Letter for Security Deposit Return | 50-State Statutory Citations | DocketStamp',
    description: 'Demand full return of your residential security deposit with exact state statutory citations, return deadlines, and bad-faith penalty warnings via USPS Certified Mail.',
    targetKeywords: [
      'security deposit demand letter',
      'demand return of security deposit',
      'landlord deposit return deadline',
      'statutory deposit demand certified mail',
      'bad faith security deposit penalty'
    ],
  },
  fields: [
    {
      key: 'tenantFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., Marcus Vance',
      helperText: 'Your full legal name as it appeared on the lease.',
      maxLength: 70,
    },
    {
      key: 'landlordOrManagerName',
      stepGroup: 'recipient',
      label: 'Landlord / Management Entity',
      docusignTagLabel: 'LANDLORD / MANAGEMENT ENTITY',
      inputType: 'text',
      placeholder: 'e.g., Oakridge Properties Inc.',
      helperText: 'The legal property owner or management company.',
      maxLength: 80,
    },
    {
      key: 'rentalPropertyAddress',
      stepGroup: 'instrument_details',
      label: 'Former Leased Rental Address',
      docusignTagLabel: 'RENTAL PROPERTY ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 402 Pine Street, Apt 3, Austin, TX 78701',
      helperText: 'The address of the residential premises you surrendered.',
      maxLength: 120,
    },
    {
      key: 'rentalState',
      stepGroup: 'instrument_details',
      label: 'State Where Property is Located',
      docusignTagLabel: 'STATE JURISDICTION',
      inputType: 'state_select',
      placeholder: 'TX',
      helperText: 'Determines the exact governing state statute, mandatory return window, and bad-faith penalty damages.',
      maxLength: 2,
    },
    {
      key: 'surrenderDate',
      stepGroup: 'instrument_details',
      label: 'Date Possession & Keys Were Surrendered',
      docusignTagLabel: 'SURRENDER DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD or Month DD, YYYY',
      helperText: 'The date you handed over keys or vacated the rental premises.',
      maxLength: 30,
    },
    {
      key: 'depositAmount',
      stepGroup: 'instrument_details',
      label: 'Total Security Deposit Amount Paid',
      docusignTagLabel: 'DEPOSIT AMOUNT',
      inputType: 'currency',
      placeholder: 'e.g., $1,850.00',
      helperText: 'The exact principal deposit amount paid at lease signing.',
      maxLength: 20,
    },
    {
      key: 'disputedDeductions',
      stepGroup: 'instrument_details',
      label: 'Itemized Deductions Disputed (Optional)',
      docusignTagLabel: 'DISPUTED DEDUCTIONS',
      inputType: 'textarea_short',
      placeholder: 'e.g., Disputed $350 cleaning deduction; unit was left in spotless condition.',
      helperText: 'Describe any improper or unitemized deductions taken by the landlord.',
      maxLength: 300,
    },
    {
      key: 'forwardingAddress',
      stepGroup: 'instrument_details',
      label: 'Designated Forwarding Address for Remittance',
      docusignTagLabel: 'PAYMENT FORWARDING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 8800 Research Blvd, Austin, TX 78758',
      helperText: 'The address where your refund check must be physically delivered.',
      maxLength: 120,
    },
  ],
  zodSchema: securityDepositSchema,
  bodyParagraphs: [
    'This letter constitutes formal statutory demand pursuant to {{statutoryCitation}} for the immediate and full return of the residential security deposit in the amount of {{depositAmount}} paid in connection with the lease of the premises located at {{rentalPropertyAddress}}.',
    'The undersigned tenant vacated the premises and surrendered physical possession and keys on {{surrenderDate}}. As of the date of this notice, more than the statutory limit of {{returnDeadlineDays}} calendar days has elapsed without receipt of the deposit funds or the required itemized statutory statement of deductions.',
    '{{#disputedDeductions}}SPECIFIC DISPUTED DEDUCTIONS:\n{{disputedDeductions}}{{/disputedDeductions}}{{^disputedDeductions}}The premises were surrendered in clean, undamaged condition, ordinary wear and tear excepted. No lawful grounds exist for withholding any portion of this deposit.{{/disputedDeductions}}',
    'Please remit the full sum of {{depositAmount}} via certified check or electronic funds to the undersigned at the following designated address within ten (10) business days of confirmed USPS delivery of this instrument:\nPAYMENT REMITTANCE ADDRESS:\n{{forwardingAddress}}',
    'STATUTORY BAD-FAITH PENALTY NOTICE:\nPursuant to {{statutoryCitation}}, failure to promptly remit deposit funds and lawful accounting subjects the landlord to statutory penalties: {{penaltyClause}}. The undersigned expressly reserves all legal rights to initiate formal legal action in small claims or civil court without further notice.',
  ],
  enclosuresLine: 'Enclosures: Move-in Inspection Report, Move-out Photos, Surrender Proof',
};
