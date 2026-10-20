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
  title: 'Personal Data Deletion Request',
  shortDescription: 'A general request asking a company to review deletion of data associated with an account. It does not establish eligibility under a particular privacy law or submission channel.',
  documentHeaderTitle: 'REQUEST TO REVIEW PERSONAL DATA DELETION',
  reLineTemplate: 'RE: Personal Data Request — Account: {{accountEmailOrId}}',
  recommendedTier: 'certified',
  recipientMode: 'verified_or_manual_corp',
  usesStateStatuteLookup: false,
  seoMeta: {
    title: 'Personal Data Deletion Request Letter | DocketStamp',
    description: 'Prepare a general request for a company to review deletion of data associated with an account. Applicable rights, exceptions, and submission channels vary.',
    targetKeywords: [
      'personal data deletion request letter',
      'privacy request letter',
      'request to delete account data',
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
    'I am writing about the {{deviceOrAppCategory}} associated with my account identifier {{accountEmailOrId}}.',
    'Please review my request to delete personal data associated with this account to the extent deletion is available under applicable law. If you retain some information, please identify the categories retained, the basis for retention, and the applicable retention period, if available.',
    'This is a general request. It does not establish eligibility under any particular privacy law, confirm that data is covered as health or biometric data, or replace a provider-required identity check or submission channel.',
  ],
};
