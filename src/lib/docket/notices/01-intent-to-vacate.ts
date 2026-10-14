/**
 * Notice Cartridge 01: Tenant Notice of Intent to Vacate / Lease Non-Renewal
 *
 * Formal written notice under state residential tenancy codes and lease agreements
 * establishing the surrender date and forwarding address for deposit return.
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§5.1)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';

export const tenantVacateSchema = z.object({
  tenantFullName: z.string().min(2, 'Tenant full legal name is required'),
  landlordOrManagerName: z.string().min(2, 'Landlord or management company name is required'),
  rentalPropertyAddress: z.string().min(5, 'Rental street address is required'),
  unitNumber: z.string().optional(),
  rentalCity: z.string().min(2, 'Rental city is required'),
  rentalState: z.string().length(2, '2-letter state code is required'),
  rentalZip: z.string().min(5, 'ZIP code is required'),
  currentLeaseEndDate: z.string().min(4, 'Lease expiration date is required'),
  effectiveVacateDate: z.string().min(4, 'Surrender/vacate date is required'),
  forwardingAddress: z.string().min(5, 'Forwarding address is required'),
  jointInspectionRequested: z.string().default('Yes'),
});

export const intentToVacateNotice: NoticeTemplateDefinition = {
  id: 'tenant-vacate-notice',
  slug: 'intent-to-vacate',
  category: 'tenant',
  title: 'Tenant Notice of Intent to Vacate / Lease Non-Renewal',
  documentHeaderTitle: 'FORMAL NOTICE OF INTENT TO VACATE & LEASE NON-RENEWAL',
  reLineTemplate: 'RE: Written Notice of Intent to Vacate & Surrender Leased Premises ({{rentalPropertyAddress}})',
  recommendedTier: 'certified',
  recipientMode: 'manual_landlord',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Tenant Notice of Intent to Vacate Form | Send via Certified Mail | DocketStamp',
    description: 'Execute and dispatch an official 30-day or 60-day Notice of Intent to Vacate to your landlord via USPS Certified Mail with tracking and proof of mailing.',
    targetKeywords: [
      'notice of intent to vacate',
      'lease non-renewal letter',
      'tenant move out notice',
      'certified mail landlord notice',
      '30 day notice to vacate landlord'
    ],
  },
  fields: [
    {
      key: 'tenantFullName',
      stepGroup: 'sender',
      label: 'Tenant Full Legal Name',
      docusignTagLabel: 'TENANT NAME',
      inputType: 'text',
      placeholder: 'e.g., Alex M. Rivera',
      helperText: 'Enter the full legal name of the tenant(s) named on the lease agreement.',
      maxLength: 70,
    },
    {
      key: 'landlordOrManagerName',
      stepGroup: 'recipient',
      label: 'Landlord or Management Entity',
      docusignTagLabel: 'LANDLORD / PROPERTY MANAGER',
      inputType: 'text',
      placeholder: 'e.g., Summit Property Management LLC',
      helperText: 'Enter the property management entity or landlord named in your lease.',
      maxLength: 80,
    },
    {
      key: 'rentalPropertyAddress',
      stepGroup: 'instrument_details',
      label: 'Rental Street Address',
      docusignTagLabel: 'RENTAL ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 742 Evergreen Terrace',
      helperText: 'The physical street address of the leased residential premises.',
      maxLength: 100,
    },
    {
      key: 'unitNumber',
      stepGroup: 'instrument_details',
      label: 'Apartment / Unit # (Optional)',
      docusignTagLabel: 'UNIT #',
      inputType: 'text',
      placeholder: 'e.g., Apt 4B',
      maxLength: 20,
    },
    {
      key: 'rentalCity',
      stepGroup: 'instrument_details',
      label: 'City',
      docusignTagLabel: 'CITY',
      inputType: 'text',
      placeholder: 'e.g., Los Angeles',
      maxLength: 50,
    },
    {
      key: 'rentalState',
      stepGroup: 'instrument_details',
      label: 'State',
      docusignTagLabel: 'STATE',
      inputType: 'state_select',
      placeholder: 'CA',
      maxLength: 2,
    },
    {
      key: 'rentalZip',
      stepGroup: 'instrument_details',
      label: 'ZIP Code',
      docusignTagLabel: 'ZIP CODE',
      inputType: 'text',
      placeholder: '90001',
      maxLength: 10,
    },
    {
      key: 'currentLeaseEndDate',
      stepGroup: 'instrument_details',
      label: 'Current Lease Expiration Date',
      docusignTagLabel: 'LEASE EXPIRATION DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD or Month DD, YYYY',
      helperText: 'The official termination date specified in your current lease agreement.',
      maxLength: 30,
    },
    {
      key: 'effectiveVacateDate',
      stepGroup: 'instrument_details',
      label: 'Key Surrender & Vacate Date',
      docusignTagLabel: 'VACATE / SURRENDER DATE',
      inputType: 'date',
      placeholder: 'YYYY-MM-DD or Month DD, YYYY',
      helperText: 'The exact date you will completely surrender physical possession and return keys.',
      maxLength: 30,
    },
    {
      key: 'forwardingAddress',
      stepGroup: 'instrument_details',
      label: 'Designated Forwarding Address',
      docusignTagLabel: 'FORWARDING ADDRESS',
      inputType: 'text',
      placeholder: 'e.g., 1200 Grand Ave, Suite 300, Dallas, TX 75201',
      helperText: 'Where the landlord must remit your security deposit and itemized accounting.',
      maxLength: 120,
    },
    {
      key: 'jointInspectionRequested',
      stepGroup: 'instrument_details',
      label: 'Request Joint Walkthrough Inspection?',
      docusignTagLabel: 'INSPECTION REQUEST',
      inputType: 'select',
      placeholder: 'Yes',
      options: [
        { label: 'Yes - Formally Request Joint Walkthrough Inspection', value: 'Yes' },
        { label: 'No - Waive Joint Inspection Request', value: 'No' },
      ],
      maxLength: 10,
    },
  ],
  zodSchema: tenantVacateSchema,
  bodyParagraphs: [
    'Please accept this formal written instrument as official, unequivocal notice pursuant to the terms of the governing lease agreement and applicable state residential tenancy law that the undersigned tenant(s) will surrender possession and completely vacate the premises located at {{rentalPropertyAddress}}{{#unitNumber}}, Unit {{unitNumber}}{{/unitNumber}}, {{rentalCity}}, {{rentalState}} {{rentalZip}} on or before {{effectiveVacateDate}}.',
    'The current lease term terminates on {{currentLeaseEndDate}}. The undersigned tenant(s) will not be renewing the tenancy for any subsequent term and will surrender all keys, access devices, and physical possession on or prior to the stated effective surrender date.',
    'Pursuant to state tenancy standards, the tenant formally requests coordination of a joint pre-move-out walk-through inspection prior to key surrender. In accordance with governing statutory timelines, all remaining security deposit funds together with an itemized statement of any lawful deductions must be remitted within the governing statutory return window to the following designated forwarding address:',
    'DESIGNATED FORWARDING ADDRESS FOR DEPOSIT RETURN:\n{{forwardingAddress}}',
    'FAILURE TO RETURN THE FULL SECURITY DEPOSIT WITHIN STATUTORY TIME LIMITS FOLLOWING SURRENDER MAY SUBJECT THE LANDLORD TO STATUTORY BAD-FAITH PENALTIES AND REASONABLE ATTORNEY FEES UNDER APPLICABLE STATE LAW.',
  ],
  enclosuresLine: 'Enclosure: Copy of Key Handover Acknowledgement Form',
};
