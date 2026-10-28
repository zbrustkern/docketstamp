/**
 * Cartridge 09: Personal Data Deletion Request
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
    'Connected device or app account',
    'Smart-home service account',
    'Vehicle or location account',
    'Cloud application or consumer profile',
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
  slug: 'personal-data-deletion-request',
  aliases: ['statutory-health-and-biometric-data-deletion-demand', 'biometric-privacy-deletion', 'health-data-erasure', 'statutory-data-deletion', 'ccpa-gdpr-data-deletion-opt-out-request'],
  category: 'consumer_rights',
  title: 'Biometric & Personal Data Erasure Demand',
  shortDescription: 'Put your data-deletion demand and consent revocation in writing.',
  documentHeaderTitle: 'FORMAL STATUTORY NOTICE OF CONSENT REVOCATION AND DATA ERASURE DEMAND',
  reLineTemplate: 'RE: Data Erasure Demand & Revocation of Consent — Account: {{accountEmailOrId}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Personal Data Deletion Demand | USPS Mail | DocketStamp',
    description: 'Demand deletion of personal data associated with an account and revoke consent for processing where applicable.',
    targetKeywords: [
      'personal data deletion request letter',
      'privacy request letter',
      'demand deletion of personal data',
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
      helperText: 'The company or contact you want to receive this general data request.',
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
      placeholder: 'Connected device or app account',
      options: [
        {
          label: 'Connected device or app account',
          value: 'Connected device or app account',
        },
        {
          label: 'Smart-home service account',
          value: 'Smart-home service account',
        },
        {
          label: 'Vehicle or location account',
          value: 'Vehicle or location account',
        },
        {
          label: 'Cloud application or consumer profile',
          value: 'Cloud application or consumer profile',
        },
      ],
      helperText: 'Choose the account or product category that best identifies the records you want reviewed; this does not classify the data under a law.',
      maxLength: 60,
    },
  ],
  zodSchema: biometricPrivacyDeletionSchema,
  bodyParagraphs: [
    'PLEASE TAKE NOTICE that I, {{senderFullName}}, hereby formally revoke all prior consent for the collection, secondary processing, commercial profiling, or AI training usage of my personal data associated with {{deviceOrAppCategory}} (Account Identifier: {{accountEmailOrId}}).',
    'Pursuant to applicable statutory consumer data and privacy protections, I demand the permanent deletion of all personal, telemetry, sensor, and biometric data linked to this account across your active systems, archives, and downstream processors.',
    'Please immediately confirm complete data erasure in writing to {{senderFullAddress}} within the applicable statutory response period, or state the specific legal basis for any records retained.',
  ],
};
