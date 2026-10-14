/**
 * Master TypeScript Contracts for DocketStamp Notices, Fields, & Lookups
 *
 * Governing documents:
 * - docs/DOCKETSTAMP_SPEC.md (§3, §5)
 * - docs/DESIGN_SYSTEM.md (§1, §3)
 */

import { z } from 'zod';

export type MailTierId = 'first_class' | 'certified' | 'certified_return_receipt';

export type RecipientMode =
  | 'manual_landlord'          // User types landlord/property manager name & address
  | 'verified_credit_bureau'   // Dropdown locked to Equifax, Experian, TransUnion
  | 'verified_or_manual_debt'  // Autocomplete from 10 top debt collectors + manual fallback
  | 'verified_or_manual_corp'; // Autocomplete from non-fitness telco/home/insurance + manual fallback

export interface NoticeFieldConfig {
  key: string;                  // Matches {{token}} in template prose (e.g., "depositAmount")
  stepGroup: 'recipient' | 'sender' | 'instrument_details' | 'execution';
  label: string;                // Drawer prompt label: "Security Deposit Amount Withheld"
  docusignTagLabel: string;     // Amber pill label on canvas: "DEPOSIT AMOUNT"
  inputType: 'text' | 'currency' | 'date' | 'state_select' | 'select' | 'textarea_short';
  placeholder?: string;
  helperText?: string;          // UPL-safe factual guidance
  options?: { label: string; value: string }[]; // Used for deterministic dropdowns
  maxLength?: number;           // Enforces 1-page physical overflow limit
}

export interface NoticeTemplateDefinition {
  id: string;
  slug: string;                 // URL route: /notices/[slug]
  category: 'tenant' | 'credit_debt' | 'cancellation';
  title: string;                // UI & SEO Title
  documentHeaderTitle: string;  // Formal uppercase header printed on the physical letter
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
  enclosuresLine?: string;      // Optional formal footer notation (e.g., "Encl: Copy of Lease Agreement")
}

export interface DocketAddress {
  name: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country?: string;
}

export interface SecurityDepositStatute {
  stateCode: string;
  stateName: string;
  returnDeadlineDays: number;
  statutoryCitation: string;
  statuteSummary: string;
  penaltyClause: string;
  badFaithMultiplier: number | string;
  itemizedDeductionsRequired: boolean;
  notes?: string;
}

export interface VerifiedRecipientEntity {
  id: string;
  name: string;
  department: string;
  category: 'CREDIT_BUREAU' | 'COLLECTION_AGENCY' | 'HOME_SECURITY' | 'TELECOM' | 'HOME_WARRANTY' | 'INSURANCE' | 'PEST_CONTROL';
  naicsCode: string; // Excludes 713940
  address: DocketAddress;
  statutoryReference?: string;
  notes?: string;
  verifiedAt: string;
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
