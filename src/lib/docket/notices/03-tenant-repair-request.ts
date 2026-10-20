/**
 * Cartridge 03: Formal Tenant Request for Essential Repairs
 *
 * Conforms verbatim to Section 8 of docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const tenantRepairSchema = z.object({
  senderFullName: z.string().min(2, 'Tenant legal name is required'),
  recipientFormalName: z.string().min(2, 'Landlord or property management entity name is required'),
  leasedPremisesAddress: z.string().min(5, 'Unit address is required').max(90),
  issueCategory: z.enum([
    'Heating / HVAC Failure',
    'Plumbing / Water Leak',
    'Electrical Hazard',
    'Water Intrusion / Mold Condition',
    'Appliance / Structural Defect',
    'Pest Infestation',
  ]),
  dateFirstObserved: z.string().min(4, 'Date first observed/reported is required'),
  defectDescription: z.string().min(5, 'Defect description is required').max(220),
  accessAuthorization: z.enum([
    'Tenant grants maintenance entry with 24-hour advance notice',
    'Tenant requests scheduled appointment prior to entry',
  ]),
});

export const tenantRepairNotice: NoticeTemplateDefinition = {
  id: 'tenant-repair-and-maintenance-notice',
  slug: 'tenant-repair-and-maintenance-notice',
  aliases: ['tenant-repair', 'tenant-repair-request', 'repair-maintenance-demand'],
  category: 'tenant',
  title: 'Formal Tenant Request for Essential Repairs',
  shortDescription: 'Written documentation of defective residential habitability condition requesting prompt repair, maintenance remediation, and inspection.',
  documentHeaderTitle: 'FORMAL WRITTEN NOTICE OF REQUIRED MAINTENANCE AND REPAIRS',
  reLineTemplate: 'RE: Notice of Defective Condition ({{issueCategory}}) — {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Repair & Maintenance Notice | Send via USPS Certified Mail | DocketStamp',
    description: 'Document defective rental conditions, habitability failures, and repair requests with proof of physical USPS Certified Mail delivery to your landlord.',
    targetKeywords: [
      'tenant repair request letter',
      'notice to repair landlord certified mail',
      'habitability repair notice',
      'apartment maintenance demand letter',
      'landlord repair notice',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., Jordan Hayes',
      helperText: 'Your full legal name as it appears on your residential lease.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Landlord / Management Entity',
      docusignTagLabel: 'LANDLORD / PROPERTY MANAGER',
      inputType: 'text',
      placeholder: 'e.g., Skyline Residential Management',
      helperText: 'The legal property owner or management company responsible for maintenance.',
      maxLength: 80,
    },
    {
      key: 'leasedPremisesAddress',
      stepGroup: 'instrument_details',
      label: 'Leased Unit Address',
      docusignTagLabel: 'UNIT ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 512 Elm St, Apt 2B, Chicago, IL 60614',
      helperText: 'The physical street address and unit number experiencing the condition.',
      maxLength: 90,
    },
    {
      key: 'issueCategory',
      stepGroup: 'instrument_details',
      label: 'Defect / Maintenance Category',
      docusignTagLabel: 'DEFECT CATEGORY',
      inputType: 'select',
      placeholder: 'Plumbing / Water Leak',
      options: [
        { label: 'Heating / HVAC Failure', value: 'Heating / HVAC Failure' },
        { label: 'Plumbing / Water Leak', value: 'Plumbing / Water Leak' },
        { label: 'Electrical Hazard', value: 'Electrical Hazard' },
        { label: 'Water Intrusion / Mold Condition', value: 'Water Intrusion / Mold Condition' },
        { label: 'Appliance / Structural Defect', value: 'Appliance / Structural Defect' },
        { label: 'Pest Infestation', value: 'Pest Infestation' },
      ],
      helperText: 'Primary habitability or maintenance category of the issue.',
      maxLength: 40,
    },
    {
      key: 'dateFirstObserved',
      stepGroup: 'instrument_details',
      label: 'Date Condition First Reported or Observed',
      docusignTagLabel: 'DATE FIRST REPORTED',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'When the issue began or when you first brought it to management\'s attention.',
      maxLength: 30,
    },
    {
      key: 'defectDescription',
      stepGroup: 'instrument_details',
      label: 'Factual Description of Condition',
      docusignTagLabel: 'DESCRIPTION OF CONDITION',
      inputType: 'textarea_short',
      placeholder: 'e.g., Severe water leak beneath bathroom vanity causing standing water and wood deterioration.',
      helperText: 'Concise factual description of the issue and its impact on the home.',
      maxLength: 220,
    },
    {
      key: 'accessAuthorization',
      stepGroup: 'instrument_details',
      label: 'Maintenance Entry Authorization',
      docusignTagLabel: 'ENTRY AUTHORIZATION',
      inputType: 'select',
      placeholder: 'Tenant grants maintenance entry with 24-hour advance notice',
      options: [
        {
          label: 'Tenant grants maintenance entry with 24-hour advance notice',
          value: 'Tenant grants maintenance entry with 24-hour advance notice',
        },
        {
          label: 'Tenant requests scheduled appointment prior to entry',
          value: 'Tenant requests scheduled appointment prior to entry',
        },
      ],
      helperText: 'Specify entry terms for inspection and contractor repair work.',
      maxLength: 70,
    },
  ],
  zodSchema: tenantRepairSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that the undersigned tenant(s), {{senderFullName}}, residing at {{leasedPremisesAddress}}, hereby submit formal written documentation of a condition requiring prompt repair and remediation under the governing lease agreement and applicable residential habitability standards.',
    'Specifically, the premises are currently experiencing the following issue categorized as {{issueCategory}}, first observed or reported on {{dateFirstObserved}}: {{defectDescription}}',
    'This condition materially affects the normal residential use and maintenance of the premises. Regarding contractor or maintenance access to inspect and remedy this condition: {{accessAuthorization}}.',
    'Please provide written confirmation within five (5) business days of the scheduled inspection and repair date so that an accurate maintenance record may be maintained by all parties.',
  ],
};
