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
  title: 'Tenant Notice of Intent to Vacate & Surrender Premises',
  shortDescription: 'Give your landlord formal written notice of your planned move-out date.',
  documentHeaderTitle: 'FORMAL NOTICE OF INTENT TO VACATE AND SURRENDER PREMISES',
  reLineTemplate: 'RE: Written Notice of Intent to Vacate — {{leasedPremisesAddress}}',
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
    'PLEASE TAKE NOTICE that the undersigned tenant, {{senderFullName}}, hereby provides formal written notice of intent to vacate and surrender possession of the leased premises located at {{leasedPremisesAddress}} on or before {{moveOutDate}}.',
    'Tenancy shall terminate effective {{moveOutDate}}. All keys, access devices, and physical possession of the unit will be surrendered on or before this date.',
    'Please contact me at the forwarding address below to confirm receipt of this notice and coordinate schedule availability for a joint move-out inspection.',
    'Please forward all future written correspondence, along with the itemized security deposit accounting and any remaining balance, to the following designated forwarding address: {{forwardingAddress}}.',
  ],
};
