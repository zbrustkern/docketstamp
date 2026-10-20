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
  title: 'Tenant Notice of Intent to Move Out',
  shortDescription: 'A general notice of your current plan to move out. It does not determine whether a lease or legal notice requirement has been met.',
  documentHeaderTitle: 'NOTICE OF INTENT TO MOVE OUT',
  reLineTemplate: 'RE: Intent to Move Out — {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Notice of Intent to Move Out | DocketStamp',
    description: 'Prepare a written notice describing your current plan to move out and asking the landlord about next steps. Check your lease and applicable requirements separately.',
    targetKeywords: [
      'notice of intent to vacate',
      'tenant move-out notice letter',
      'lease non-renewal request letter',
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
    'I am writing to let you know that I currently plan to move out of {{leasedPremisesAddress}} on {{moveOutDate}}.',
    'Please let me know what steps, if any, you require for move-out, arranging a walkthrough, returning keys or access devices, and receiving any final account correspondence.',
    'This letter communicates my current plan. It does not establish that a lease or legal notice requirement has been met or change any lease obligation.',
    'Please use this address for future correspondence: {{forwardingAddress}}.',
  ],
};
