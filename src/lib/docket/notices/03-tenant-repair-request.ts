/**
 * Notice Cartridge 03: Formal Tenant Request for Essential Repairs / Maintenance
 *
 * Formal written notice under the implied warranty of habitability and state housing maintenance codes.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5.3)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const repairDemandSchema = z.object({
  tenantFullName: z.string().min(2, 'Tenant legal name is required'),
  landlordOrManagerName: z.string().min(2, 'Landlord or management name is required'),
  rentalPropertyAddress: z.string().min(5, 'Rental address is required'),
  defectDescription: z.string().min(10, 'Defect description is required'),
  priorNoticeDates: z.string().optional(),
  statutoryRemedyDeadlineDays: z.string().default('14'),
});

export const tenantRepairNotice: NoticeTemplateDefinition = {
  id: 'repair-maintenance-demand',
  slug: 'tenant-repair-request',
  category: 'tenant',
  title: 'Formal Tenant Request for Essential Repairs & Habitability Remedy',
  documentHeaderTitle: 'FORMAL NOTICE OF DEFECT & DEMAND FOR ESSENTIAL REPAIRS',
  reLineTemplate: 'RE: Urgent Notice of Substandard Condition and Demand for Repair ({{rentalPropertyAddress}})',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Repair Notice Letter | Demand for Habitability Remedy | DocketStamp',
    description: 'Send a formal, certified mail repair notice to your landlord establishing proof of habitability defect and setting a statutory cure deadline.',
    targetKeywords: [
      'tenant repair request letter',
      'notice to repair landlord',
      'habitability demand letter',
      'certified mail landlord repair',
      'demand letter for apartment maintenance'
    ],
  },
  fields: [
    {
      key: 'tenantFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., David Chen',
      helperText: 'Full legal name of the resident.',
      maxLength: 70,
    },
    {
      key: 'landlordOrManagerName',
      stepGroup: 'recipient',
      label: 'Landlord / Property Manager Name',
      docusignTagLabel: 'LANDLORD / PROPERTY MANAGER',
      inputType: 'text',
      placeholder: 'e.g., Blue Sky Residential LLC',
      helperText: 'The property management company or landlord entity.',
      maxLength: 80,
    },
    {
      key: 'rentalPropertyAddress',
      stepGroup: 'instrument_details',
      label: 'Rental Property Address & Unit #',
      docusignTagLabel: 'RENTAL ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 550 Commonwealth Ave, Apt 12, Boston, MA 02215',
      helperText: 'Full physical address of the premises experiencing defects.',
      maxLength: 120,
    },
    {
      key: 'defectDescription',
      stepGroup: 'instrument_details',
      label: 'Description of Maintenance Defect / Habitability Issue',
      docusignTagLabel: 'DEFECT DESCRIPTION',
      inputType: 'textarea_short',
      placeholder: 'e.g., Main heating system inoperative since Oct 10; interior temperature below legal minimum. Active water leak under sink causing wood damage and mold.',
      helperText: 'Clearly and factually state the condition affecting physical habitability, heating, water, or safety.',
      maxLength: 400,
    },
    {
      key: 'priorNoticeDates',
      stepGroup: 'instrument_details',
      label: 'Dates of Prior Verbal / Written Notices (Optional)',
      docusignTagLabel: 'PRIOR NOTICE DATES',
      inputType: 'text',
      placeholder: 'e.g., Telephoned maintenance portal Oct 11, emailed landlord Oct 12.',
      helperText: 'Dates and methods of previous repair requests.',
      maxLength: 120,
    },
    {
      key: 'statutoryRemedyDeadlineDays',
      stepGroup: 'instrument_details',
      label: 'Cure Window Demanded',
      docusignTagLabel: 'REMEDY DEADLINE DAYS',
      inputType: 'select',
      placeholder: '14',
      options: [
        { label: '7 Calendar Days (Emergency / Essential Heat & Water)', value: '7' },
        { label: '14 Calendar Days (Standard Essential Habitability)', value: '14' },
        { label: '30 Calendar Days (General Structural / Appliance Maintenance)', value: '30' },
      ],
      helperText: 'Standard statutory period for landlord cure under state housing codes.',
      maxLength: 5,
    },
  ],
  zodSchema: repairDemandSchema,
  bodyParagraphs: [
    'This letter serves as formal written notice pursuant to the implied warranty of habitability and applicable state and local housing maintenance codes that substantial conditions requiring immediate repair exist at the leased premises located at {{rentalPropertyAddress}}.',
    'SPECIFIC CONDITIONS REQUIRING REPAIR:\n{{defectDescription}}',
    '{{#priorNoticeDates}}PRIOR NOTICES RECORDED:\nNotice of these conditions was previously provided as follows: {{priorNoticeDates}}. Despite prior notice, the condition remains uncured.{{/priorNoticeDates}}{{^priorNoticeDates}}These conditions directly affect the physical health, safety, and habitability of the premises.{{/priorNoticeDates}}',
    'You are formally requested to cure these conditions within {{statutoryRemedyDeadlineDays}} calendar days of confirmed USPS postal delivery of this notice. Please contact the undersigned immediately to schedule prompt contractor entry.',
    'RESERVATION OF STATUTORY REMEDIES:\nIf you fail to effectuate the necessary repairs within {{statutoryRemedyDeadlineDays}} calendar days, the undersigned reserves all rights under state law, including but not limited to repairing the condition and deducting the cost from rent, rent escrow withholding, lease termination due to constructive eviction, and reporting violations to local municipal building inspectors.',
  ],
  enclosuresLine: 'Enclosures: Photographic Evidence of Defect, Prior Maintenance Logs',
};
