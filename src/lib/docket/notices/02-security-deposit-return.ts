/**
 * Cartridge 02: Security Deposit Demand Letter
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 * Keeps the state citation while treating user-selected response periods as requests.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const securityDepositSchema = z.object({
  senderFullName: z.string().min(2, 'Tenant legal name is required'),
  recipientFormalName: z.string().min(2, 'Landlord or management entity name is required'),
  propertyState: z.string().length(2, '2-letter state code is required'),
  vacatedPremisesAddress: z.string().min(5, 'Vacated premises address is required').max(90),
  moveOutDate: z.string().min(4, 'Move-out date is required'),
  depositAmount: z.string().min(1, 'Deposit amount is required'),
  amountReceivedToDate: z.string().min(1, 'Amount returned/received to date is required'),
  balanceRequested: z.string().min(1, 'Balance requested is required'),
  responseDays: z.enum(['7 calendar days', '10 business days', '14 calendar days']),
});

export const securityDepositNotice: NoticeTemplateDefinition = {
  id: 'security-deposit-return-demand-letter',
  slug: 'security-deposit-return-demand-letter',
  aliases: ['security-deposit-return', 'security-deposit-demand'],
  category: 'tenant',
  title: 'Security Deposit Demand Letter',
  shortDescription: 'Demand return of your security deposit and request an itemized explanation and supporting records for claimed deductions.',
  documentHeaderTitle: 'FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT',
  reLineTemplate: 'RE: Security Deposit Return Accounting — {{vacatedPremisesAddress}} ({{statuteCitation}})',
  recommendedTier: 'certified_return_receipt',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: true,
  seoMeta: {
    title: 'Security Deposit Demand Letter | USPS Mail | DocketStamp',
    description: 'Prepare a security deposit demand that states your reported amounts, cites the selected state law, and requests an itemized explanation of deductions.',
    targetKeywords: [
      'security deposit demand letter',
      'demand return of security deposit',
      'security deposit demand to landlord',
      'deposit deduction accounting request',
      'security deposit certified mail letter',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., Marcus Vance',
      helperText: 'Your full legal name as it appeared on the lease agreement.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Landlord / Management Entity',
      docusignTagLabel: 'LANDLORD / PROPERTY MANAGER',
      inputType: 'text',
      placeholder: 'e.g., Oakridge Properties Inc.',
      helperText: 'The legal property owner or management company.',
      maxLength: 80,
    },
    {
      key: 'propertyState',
      stepGroup: 'instrument_details',
      label: 'State Jurisdiction',
      docusignTagLabel: 'PROPERTY STATE',
      inputType: 'state_select',
      placeholder: 'TX',
      helperText: 'Adds a state statutory citation. Legal deadlines can depend on applicable facts and conditions.',
      maxLength: 2,
    },
    {
      key: 'vacatedPremisesAddress',
      stepGroup: 'instrument_details',
      label: 'Vacated Property Address',
      docusignTagLabel: 'VACATED PROPERTY ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 402 Pine Street, Apt 3, Austin, TX 78701',
      helperText: 'The physical street address of the residential premises you vacated.',
      maxLength: 90,
    },
    {
      key: 'moveOutDate',
      stepGroup: 'instrument_details',
      label: 'Move-Out Date',
      docusignTagLabel: 'MOVE-OUT DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you report moving out or surrendering possession.',
      maxLength: 30,
    },
    {
      key: 'depositAmount',
      stepGroup: 'instrument_details',
      label: 'Security Deposit Amount Paid',
      docusignTagLabel: 'DEPOSIT AMOUNT',
      inputType: 'currency',
      placeholder: 'e.g., $1,850.00',
      helperText: 'The original principal deposit paid at lease inception.',
      maxLength: 20,
    },
    {
      key: 'amountReceivedToDate',
      stepGroup: 'instrument_details',
      label: 'Amount Returned / Received to Date',
      docusignTagLabel: 'AMOUNT RECEIVED',
      inputType: 'currency',
      placeholder: 'e.g., $0.00',
      helperText: 'Enter $0.00 if no portion of the deposit has been refunded.',
      maxLength: 20,
    },
    {
      key: 'balanceRequested',
      stepGroup: 'instrument_details',
      label: 'Remaining Unrefunded Balance Due',
      docusignTagLabel: 'BALANCE DUE',
      inputType: 'currency',
      placeholder: 'e.g., $1,850.00',
      helperText: 'The unpaid balance of the deposit you are demanding.',
      maxLength: 20,
    },
    {
      key: 'responseDays',
      stepGroup: 'instrument_details',
      label: 'Requested Response Period',
      docusignTagLabel: 'REQUESTED RESPONSE',
      inputType: 'select',
      placeholder: '10 business days',
      options: [
        { label: '7 calendar days', value: '7 calendar days' },
        { label: '10 business days', value: '10 business days' },
        { label: '14 calendar days', value: '14 calendar days' },
      ],
      helperText: 'Your requested time for a response. It does not change any statutory deadline.',
      maxLength: 20,
    },
  ],
  zodSchema: securityDepositSchema,
  bodyParagraphs: [
    'I demand return of {{balanceRequested}} from my security deposit for {{vacatedPremisesAddress}}. My move-out date was {{moveOutDate}}. I paid {{depositAmount}} and have received {{amountReceivedToDate}} back.',
    'This demand concerns the security deposit return and accounting requirements addressed in {{statuteCitation}}. If you claim deductions, provide an itemized explanation and supporting records, and remit the undisputed balance.',
    'Send payment payable to {{senderFullName}} and your written response to {{senderFullAddress}}. I request a response within {{responseDays}} of receipt. This requested response period does not change any statutory deadline.',
  ],
};
