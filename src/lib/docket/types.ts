/**
 * Master TypeScript Contracts for DocketStamp Notices, Fields, Lookups & Rendering
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_MASTER_BUILD_SPEC.md (§1, §2, §5, §6, §7, §8)
 * - ARCHITECTURE.md
 */

import { z } from 'zod';

export type MailTierId = 'first_class' | 'certified' | 'certified_return_receipt';

export type RecipientMode =
  | 'manual_landlord'          // User types landlord/property manager name & address
  | 'verified_credit_bureau'   // Dropdown locked to Equifax, Experian, TransUnion
  | 'verified_or_manual_debt'  // Autocomplete from top debt collectors + manual fallback
  | 'verified_or_manual_corp'; // Autocomplete from non-fitness telco/home/insurance + manual fallback

export type AddressVerificationStatus =
  | 'unverified'
  | 'checking'
  | 'confirmed'
  | 'simulated'
  | 'failed'
  | 'unavailable';

export interface PostalAddress {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

// Backward-compatible alias for existing renderer / Lob client types
export type DocketAddress = {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
};

export interface StateStatuteEntry {
  stateCode: string;
  stateName: string;
  returnDeadlineLabel: string;
  statuteCitation: string;
  statutoryNuance: string;
  // Compatibility fields
  statutoryCitation?: string;
  returnDeadlineDays?: number;
  statuteSummary?: string;
  penaltyClause?: string;
  badFaithMultiplier?: number | string;
  itemizedDeductionsRequired?: boolean;
}

export type SecurityDepositStatute = StateStatuteEntry;

export type RecipientCategory =
  | 'credit_bureau'
  | 'debt_collector'
  | 'home_service'
  | 'telecom_insurance'
  | 'tech_hardware_legal'
  | 'CREDIT_BUREAU'
  | 'COLLECTION_AGENCY'
  | 'HOME_SECURITY'
  | 'TELECOM'
  | 'HOME_WARRANTY'
  | 'INSURANCE'
  | 'PEST_CONTROL';

export interface VerifiedRecipientEntry {
  id: string;
  category: 'credit_bureau' | 'debt_collector' | 'home_service' | 'telecom_insurance' | 'tech_hardware_legal';
  brandName: string;
  formalRecipientLine: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  requiredIdentifiersHint: string;
  recommendedTier: MailTierId;
  // Compatibility fields
  name?: string;
  department?: string;
  naicsCode?: string;
  address?: DocketAddress;
  statutoryReference?: string;
  notes?: string;
  verifiedAt?: string;
}

export type VerifiedRecipientEntity = VerifiedRecipientEntry;

export interface NoticeFieldConfig {
  key: string;                  // Matches {{token}} in template prose (e.g., "depositAmount")
  stepGroup: 'recipient' | 'sender' | 'instrument_details' | 'execution';
  label: string;                // Drawer prompt label
  docusignTagLabel: string;     // Amber pill label on canvas: e.g. "DEPOSIT AMOUNT"
  inputType: 'text' | 'currency' | 'date' | 'state_select' | 'select' | 'textarea_short';
  placeholder?: string;
  helperText?: string;          // UPL-safe factual guidance
  options?: { label: string; value: string }[]; // Used for deterministic dropdowns
  maxLength?: number;           // Enforces 1-page physical overflow limit
}

export interface NoticeTemplateDefinition {
  id: string;
  slug: string;                 // Canonical URL route: /notices/[slug]
  aliases?: string[];           // Additional slug aliases for backward-compatibility
  category: 'tenant' | 'credit_debt' | 'cancellation' | 'consumer_rights';
  title: string;                // UI Title
  shortDescription: string;     // Subtitle / summary
  documentHeaderTitle: string;  // Formal uppercase header printed on physical letter
  reLineTemplate: string;       // Printed inside the RE: docket block
  recommendedTier: MailTierId;
  recipientMode: RecipientMode;
  usesStateStatuteLookup: boolean;
  seoMeta: {
    title: string;
    description: string;
    targetKeywords: string[];
  };
  fields: NoticeFieldConfig[];
  zodSchema: z.ZodObject<any>;
  bodyParagraphs: string[];     // Array of deterministic paragraphs with {{variable}} tokens
  enclosuresLine?: string;      // Optional formal footer notation
}

export interface PricingTierMetadata {
  id: MailTierId;
  name: string;
  priceCents: number;
  formattedPrice: string;
  lobExtraService?: 'certified' | 'certified_return_receipt';
  description: string;
  features: string[];
}

export interface InterpolatedParagraphToken {
  type: 'text' | 'variable';
  content: string;
  key?: string;
  docusignTagLabel?: string;
  isFilled?: boolean;
}

export interface InterpolatedDocument {
  docketId: string;
  noticeDefinition: NoticeTemplateDefinition;
  headerTitle: string;
  reLine: string;
  senderAddress: DocketAddress;
  recipientAddress: DocketAddress;
  paragraphs: InterpolatedParagraphToken[][];
  rawParagraphs: string[];
  enclosuresLine?: string;
  clerkStamp: {
    docketId: string;
    registryTitle: string;
    timestampUtc: string;
    serviceLevel: MailTierId;
    cassStatus: string;
  };
  signatureBlock: {
    signerName: string;
    formalSignature: string; // e.g., "/s/ Full Name"
    executionDate: string;
  };
}
