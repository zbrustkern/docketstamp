/**
 * Cartridge 01: Tenant Notice of Intent to Vacate & Lease Non-Renewal
 *
 * Conforms verbatim to Section 8 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md.
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
  title: 'Tenant Notice of Intent to Vacate & Lease Non-Renewal',
  shortDescription: 'Formal written notice under governing lease agreement and residential tenancy laws establishing surrender date and forwarding address.',
  documentHeaderTitle: 'FORMAL NOTICE OF INTENT TO VACATE AND NON-RENEWAL OF LEASE',
  reLineTemplate: 'RE: Notice of Lease Non-Renewal — {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Notice of Intent to Vacate Letter | Send via USPS Certified Mail | DocketStamp',
    description: 'Execute and dispatch a legally formal 30-day or 60-day Notice of Intent to Vacate to your landlord with USPS Certified Mail tracking and proof of mailing.',
    targetKeywords: [
      'notice of intent to vacate',
      'tenant lease non-renewal letter',
      '30 day notice to vacate landlord',
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
      label: 'Statutory or Lease Notice Period',
      docusignTagLabel: 'NOTICE PERIOD',
      inputType: 'select',
      placeholder: '30-Day',
      options: [
        { label: '30-Day Written Notice', value: '30-Day' },
        { label: '60-Day Written Notice', value: '60-Day' },
        { label: 'End-of-Term Expiration Notice', value: 'End-of-Term' },
      ],
      helperText: 'The notice duration required by your lease agreement or state statute.',
      maxLength: 20,
    },
    {
      key: 'moveOutDate',
      stepGroup: 'instrument_details',
      label: 'Key Surrender & Vacate Date',
      docusignTagLabel: 'VACATE DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The final date on which you will completely vacate and surrender keys.',
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
    'PLEASE TAKE NOTICE that the undersigned tenant(s), {{senderFullName}}, hereby provide formal written {{leaseNoticePeriod}} notice of intent to vacate and terminate tenancy for the residential premises located at {{leasedPremisesAddress}}.',
    'In accordance with the written notice provisions of the governing lease agreement, tenancy will conclude and full possession of the premises will be surrendered on or before {{moveOutDate}}.',
    'Please provide schedule availability for a joint move-out walkthrough inspection prior to the surrender date. All keys, fobs, and access devices will be returned upon final surrender of the unit.',
    'Kindly forward the full accounting and refund of the residential security deposit to the following forwarding address: {{forwardingAddress}}.',
  ],
  enclosuresLine: 'Enclosure: Written Key Surrender & Inspection Acknowledgement',
};
