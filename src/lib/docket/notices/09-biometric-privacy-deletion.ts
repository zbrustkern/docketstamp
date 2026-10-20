/**
 * Cartridge 09: Statutory Health, Biometric & Telemetry Data Erasure Demand
 *
 * Conforms verbatim to Section 3 of docs/DOCKETSTAMP_AGENTIC_EXPANSION.md.
 * Invariant 1: Strictly enforces assertNonFitnessEntity() on corporate recipient.
 */

import { z } from 'zod';
import { NoticeTemplateDefinition } from '../types';
import { assertNonFitnessEntity } from '../guardrails';

export const biometricPrivacyDeletionSchema = z.object({
  senderFullName: z.string().min(2, 'Consumer full legal name is required').max(70),
  recipientFormalName: z.string().min(2, 'Data controller name is required').max(80),
  accountEmailOrId: z.string().min(3, 'Account email or ID is required').max(60),
  deviceOrAppCategory: z.enum([
    'Connected Health & Biometric Sensor Device',
    'Smart Home & Environmental Telemetry Appliance',
    'Connected Vehicle & Location Telemetry System',
    'Cloud Application & Consumer Profile Account',
  ]),
  applicablePrivacyFramework: z.enum([
    'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
    'General Consumer Data Protection & Revocation of Processing Consent',
  ]),
}).refine(
  (data) => {
    assertNonFitnessEntity(data.recipientFormalName);
    return true;
  },
  {
    message: 'Prohibited category: Gym, fitness club, and health club memberships (NAICS 713940) are strictly excluded from DocketStamp.',
    path: ['recipientFormalName'],
  }
);

export const biometricPrivacyDeletionNotice: NoticeTemplateDefinition = {
  id: 'statutory-health-and-biometric-data-deletion-demand',
  slug: 'statutory-health-and-biometric-data-deletion-demand',
  aliases: ['biometric-privacy-deletion', 'health-data-erasure', 'statutory-data-deletion'],
  category: 'consumer_rights',
  title: 'Statutory Health, Biometric & Telemetry Data Erasure Demand',
  shortDescription: 'Formal statutory notice revoking processing consent and demanding permanent erasure of biometric, health, telemetry, and location records.',
  documentHeaderTitle: 'STATUTORY NOTICE OF CONSENT REVOCATION AND DATA ERASURE DEMAND',
  reLineTemplate: 'RE: Statutory Data Erasure & Revocation of Consent — Account: {{accountEmailOrId}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Health & Biometric Data Erasure Demand Letter | USPS Certified Mail | DocketStamp',
    description: 'Demand complete deletion of biometric, health sensor, telemetry, and location data under CCPA/CPRA, MHMDA, and state privacy laws with USPS Certified Mail tracking.',
    targetKeywords: [
      'biometric data deletion request letter',
      'health data erasure demand',
      'ccpa biometric privacy deletion notice',
      'mhmda consumer health data revocation',
      'smart device telemetry deletion certified mail',
    ],
  },
  fields: [
    {
      key: 'senderFullName',
      stepGroup: 'sender',
      label: 'Consumer Full Legal Name',
      docusignTagLabel: 'CONSUMER NAME',
      inputType: 'text',
      placeholder: 'e.g., Devon R. Kessler',
      helperText: 'Your full legal name as registered with the data controller.',
      maxLength: 70,
    },
    {
      key: 'recipientFormalName',
      stepGroup: 'recipient',
      label: 'Data Controller / Privacy Department',
      docusignTagLabel: 'DATA CONTROLLER / PRIVACY DEPT',
      inputType: 'text',
      placeholder: 'e.g., Withings Inc. — Privacy & Data Protection',
      helperText: 'The legal entity controlling the health, biometric, or telemetry database.',
      maxLength: 80,
    },
    {
      key: 'accountEmailOrId',
      stepGroup: 'instrument_details',
      label: 'Account Email / ID',
      docusignTagLabel: 'ACCOUNT EMAIL / ID',
      inputType: 'text',
      placeholder: 'e.g., user@domain.com',
      helperText: 'The primary email address or user account identifier linked to your records.',
      maxLength: 60,
    },
    {
      key: 'deviceOrAppCategory',
      stepGroup: 'instrument_details',
      label: 'Device / Data Category',
      docusignTagLabel: 'DEVICE / DATA CATEGORY',
      inputType: 'select',
      placeholder: 'Connected Health & Biometric Sensor Device',
      options: [
        {
          label: 'Connected Health & Biometric Sensor Device',
          value: 'Connected Health & Biometric Sensor Device',
        },
        {
          label: 'Smart Home & Environmental Telemetry Appliance',
          value: 'Smart Home & Environmental Telemetry Appliance',
        },
        {
          label: 'Connected Vehicle & Location Telemetry System',
          value: 'Connected Vehicle & Location Telemetry System',
        },
        {
          label: 'Cloud Application & Consumer Profile Account',
          value: 'Cloud Application & Consumer Profile Account',
        },
      ],
      helperText: 'The category of hardware appliance or digital service generating records.',
      maxLength: 70,
    },
    {
      key: 'applicablePrivacyFramework',
      stepGroup: 'instrument_details',
      label: 'Statutory Basis',
      docusignTagLabel: 'STATUTORY BASIS',
      inputType: 'select',
      placeholder: 'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
      options: [
        {
          label: 'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
          value: 'Applicable State Consumer Data & Biometric Privacy Statutes (including CCPA/CPRA, MHMDA, TDPSA, and BIPA)',
        },
        {
          label: 'General Consumer Data Protection & Revocation of Processing Consent',
          value: 'General Consumer Data Protection & Revocation of Processing Consent',
        },
      ],
      helperText: 'The legal privacy basis governing your revocation and erasure demand.',
      maxLength: 120,
    },
  ],
  zodSchema: biometricPrivacyDeletionSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that the undersigned consumer, {{senderFullName}}, hereby revokes all prior consent for the collection, secondary profiling, AI training ingestion, or marketing solicitation derived from my {{deviceOrAppCategory}} associated with Account Identifier {{accountEmailOrId}}.',
    'Pursuant to {{applicablePrivacyFramework}}, I formally request the complete and permanent deletion of all personal, telemetry, health, and biometric records linked to {{accountEmailOrId}} across your production databases, analytics warehouses, and third-party data processors.',
    'Please immediately cease all promotional communications tied to my device usage and mail written certification confirming complete data erasure to {{senderFullAddress}} within the applicable statutory response period.',
  ],
};
