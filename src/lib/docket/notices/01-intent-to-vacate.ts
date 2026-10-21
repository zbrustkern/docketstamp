/**
 * Cartridge 01: Tenant Notice of Intent to Vacate & Lease Non-Renewal
 *
 * Customer-facing copy follows [SPRINT-0011](../../../../docs/sprints/SPRINT-0011.md) scoped authority.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const intentToVacateSchema = z.object({
  senderFullName: z.string().min(2, 'Tenant full legal name is required'),
  recipientFormalName: z.string().min(2, 'Landlord or property manager name is required'),
  leasedPremisesAddress: z.string().min(5, 'Leased premises address is required').max(90),
  leaseNoticePeriod: z.enum(['30-Day', '60-Day', 'End-of-Term']),
  moveOutDate: z.string().min(4, 'Surrender/vacate date is required'),
  forwardingAddress: z.string().min(5, 'Forwarding address is required').max(100),
});

export const intentToVacateNotice: NoticeTemplateDefinition = {
  id: 'tenant-notice-of-intent-to-vacate',
  slug: 'tenant-notice-of-intent-to-vacate',
  aliases: ['intent-to-vacate', 'tenant-vacate-notice'],
  category: 'tenant',
  title: 'Formal Move-Out Notice',
  shortDescription: 'Give your landlord written notice of your planned move-out date.',
  documentHeaderTitle: 'FORMAL NOTICE OF INTENT TO VACATE AND NON-RENEWAL OF LEASE',
  reLineTemplate: 'RE: Notice of Lease Non-Renewal — {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Formal Move-Out Notice | USPS Mail | DocketStamp',
    description: 'Prepare a written move-out notice, review the letter, and send it by USPS. Check your lease and applicable rules for the notice period.',
    targetKeywords: [
      'notice of intent to vacate',
      'tenant lease non-renewal letter',
      'move out notice to landlord',
      'certified mail tenant notice',
      'surrender of premises letter',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., Alex M. Rivera',
      helperText: 'Full legal name of the tenant(s) as stated on the lease agreement.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Landlord / Management Entity',
      docusignTagLabel: 'LANDLORD / PROPERTY MANAGER',
      inputType: 'text',
      placeholder: 'e.g., Summit Property Management LLC',
      helperText: 'The legal landlord or property management company named in your lease.',
      maxLength: 80,
    },
    {
      key: 'leasedPremisesAddress',
      stepGroup: 'instrument_details',
      label: 'Leased Unit Physical Address',
      docusignTagLabel: 'LEASED UNIT ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 742 Evergreen Terrace, Apt 4B, Springfield, OR 97477',
      helperText: 'The physical street address of the leased residential premises.',
      maxLength: 90,
    },
    {
      key: 'leaseNoticePeriod',
      stepGroup: 'instrument_details',
      label: 'Notice Period to State',
      docusignTagLabel: 'NOTICE PERIOD',
      inputType: 'select',
      placeholder: '30-Day',
      options: [
        { label: '30-Day Written Notice', value: '30-Day' },
        { label: '60-Day Written Notice', value: '60-Day' },
        { label: 'End-of-Term Expiration Notice', value: 'End-of-Term' },
      ],
      helperText: 'Choose a notice period to state. Check your lease and applicable rules for the period and required delivery method.',
      maxLength: 20,
    },
    {
      key: 'moveOutDate',
      stepGroup: 'instrument_details',
      label: 'Key Surrender & Vacate Date',
      docusignTagLabel: 'VACATE DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you plan to move out and surrender possession.',
      maxLength: 30,
    },
    {
      key: 'forwardingAddress',
      stepGroup: 'instrument_details',
      label: 'Designated Forwarding Address',
      docusignTagLabel: 'FORWARDING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., PO Box 99, Eugene, OR 97401',
      helperText: 'Where the landlord must remit your security deposit refund and accounting.',
      maxLength: 100,
    },
  ],
  zodSchema: intentToVacateSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, give {{leaseNoticePeriod}} written notice that I plan to move out of {{leasedPremisesAddress}}.',
    'I intend to surrender possession on or before {{moveOutDate}}.',
    'Please confirm receipt of this notice and let me know how to arrange any move-out inspection.',
    'Please send any deposit accounting or refund to this forwarding address: {{forwardingAddress}}.',
  ],
};
