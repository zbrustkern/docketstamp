/**
 * Cartridge 03: Tenant Repair and Maintenance Request
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const tenantRepairSchema = z.object({
  senderFullName: z.string().min(2, 'Tenant legal name is required'),
  recipientFormalName: z.string().min(2, 'Landlord or property management entity name is required'),
  leasedPremisesAddress: z.string().min(5, 'Unit address is required').max(90),
  issueCategory: z.enum([
    'Heating or cooling issue',
    'Plumbing or leak issue',
    'Electrical issue',
    'Water intrusion or suspected mold',
    'Appliance or structural issue',
    'Pest issue',
  ]),
  dateFirstObserved: z.string().min(4, 'Date first observed is required'),
  defectDescription: z.string().min(5, 'Defect description is required').max(220),
  accessAuthorization: z.enum([
    'Please contact me to arrange a time for inspection or maintenance',
    'Please propose an appointment time for inspection or maintenance',
  ]),
});

export const tenantRepairNotice: NoticeTemplateDefinition = {
  id: 'tenant-repair-and-maintenance-notice',
  slug: 'tenant-repair-and-maintenance-notice',
  aliases: ['tenant-repair', 'tenant-repair-request', 'repair-maintenance-demand', 'notice-of-intent-to-withhold-or-repair-and-deduct'],
  category: 'tenant',
  title: 'Tenant Repair and Maintenance Request',
  shortDescription: 'A factual request for inspection or maintenance. It does not classify a condition as a legal habitability violation or exercise a rent remedy.',
  documentHeaderTitle: 'REQUEST FOR PROPERTY INSPECTION OR MAINTENANCE',
  reLineTemplate: 'RE: Maintenance Request — {{issueCategory}} at {{leasedPremisesAddress}}',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Repair & Maintenance Notice | Send via USPS Certified Mail | DocketStamp',
    description: 'Describe a property condition and request inspection or maintenance. Confirm any separate legal procedure or access requirements for your location.',
    targetKeywords: [
      'tenant repair request letter',
      'property maintenance request letter',
      'rental repair request letter',
      'apartment inspection request',
      'landlord repair request',
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
      label: 'Condition / Maintenance Category',
      docusignTagLabel: 'DEFECT CATEGORY',
      inputType: 'select',
      placeholder: 'Plumbing or leak issue',
      options: [
        { label: 'Heating or cooling issue', value: 'Heating or cooling issue' },
        { label: 'Plumbing or leak issue', value: 'Plumbing or leak issue' },
        { label: 'Electrical issue', value: 'Electrical issue' },
        { label: 'Water intrusion or suspected mold', value: 'Water intrusion or suspected mold' },
        { label: 'Appliance or structural issue', value: 'Appliance or structural issue' },
        { label: 'Pest issue', value: 'Pest issue' },
      ],
      helperText: 'Choose the category that best describes what you observed; the selection does not make a legal determination.',
      maxLength: 50,
    },
    {
      key: 'dateFirstObserved',
      stepGroup: 'instrument_details',
      label: 'Date You First Observed the Condition',
      docusignTagLabel: 'DATE FIRST OBSERVED',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD',
      helperText: 'Enter when you first observed the condition. This does not state when or whether it was previously reported.',
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
      label: 'Access Coordination Preference',
      docusignTagLabel: 'ACCESS COORDINATION PREFERENCE',
      inputType: 'select',
      placeholder: 'Please contact me to arrange a time for inspection or maintenance',
      options: [
        {
          label: 'Please contact me to arrange a time for inspection or maintenance',
          value: 'Please contact me to arrange a time for inspection or maintenance',
        },
        {
          label: 'Please propose an appointment time for inspection or maintenance',
          value: 'Please propose an appointment time for inspection or maintenance',
        },
      ],
      helperText: 'This is a coordination preference. Any entry remains subject to applicable requirements.',
      maxLength: 90,
    },
  ],
  zodSchema: tenantRepairSchema,
  bodyParagraphs: [
    'I am writing about a condition I observed at {{leasedPremisesAddress}} on {{dateFirstObserved}}. The condition is described as {{issueCategory}}: {{defectDescription}}.',
    'Please inspect the condition and let me know what maintenance or repair, if any, you plan to provide. {{accessAuthorization}}.',
    'This is a general maintenance request. It does not determine whether a legal standard has been met, authorize rent withholding or repair-and-deduct, or establish a response deadline.',
  ],
};
