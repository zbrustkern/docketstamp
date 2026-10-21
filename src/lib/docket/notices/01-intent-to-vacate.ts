/**
 * Cartridge 01: Tenant Notice of Intent to Move Out
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const intentToVacateSchema = z.object({
  senderFullName: z.string().min(2, 'Tenant full legal name is required'),
  recipientFormalName: z.string().min(2, 'Landlord or property manager name is required'),
  leasedPremisesAddress: z.string().min(5, 'Leased premises address is required').max(90),
  moveOutDate: z.string().min(4, 'Planned move-out date is required'),
  forwardingAddress: z.string().min(5, 'Forwarding address is required').max(100),
});

export const intentToVacateNotice: NoticeTemplateDefinition = {
  id: 'tenant-notice-of-intent-to-vacate',
  slug: 'tenant-notice-of-intent-to-vacate',
  aliases: ['intent-to-vacate', 'tenant-vacate-notice', 'lease-termination-non-renewal-notice'],
  category: 'tenant',
  title: 'Tenant Move-Out Notice',
  shortDescription: 'Give your landlord formal written notice of your planned move-out date.',
  documentHeaderTitle: 'FORMAL NOTICE OF INTENT TO MOVE OUT',
  reLineTemplate: 'RE: Formal Move-Out Notice — {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Move-Out Notice | USPS Mail | DocketStamp',
    description: 'Prepare formal written notice of your planned move-out date and ask your landlord to confirm next steps. Check your lease for applicable notice requirements.',
    targetKeywords: [
      'notice of intent to vacate',
      'tenant move-out notice letter',
      'formal move out notice to landlord',
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
      key: 'moveOutDate',
      stepGroup: 'instrument_details',
      label: 'Planned Move-Out Date',
      docusignTagLabel: 'VACATE DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'The date you currently plan to move out. This does not establish that a lease or legal notice period has been met.',
      maxLength: 30,
    },
    {
      key: 'forwardingAddress',
      stepGroup: 'instrument_details',
      label: 'Designated Forwarding Address',
      docusignTagLabel: 'FORWARDING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., PO Box 99, Eugene, OR 97401',
      helperText: 'An address where you would like to receive future correspondence.',
      maxLength: 100,
    },
  ],
  zodSchema: intentToVacateSchema,
  bodyParagraphs: [
    'I, {{senderFullName}}, give formal written notice that I plan to move out of {{leasedPremisesAddress}} on {{moveOutDate}}.',
    'I intend to surrender possession on or before {{moveOutDate}}.',
    'Please confirm receipt of this notice and let me know how to arrange any move-out inspection and return of keys or access devices.',
    'Please use this address for future correspondence: {{forwardingAddress}}.',
  ],
};
