/**
 * Chooser & Shared Company Routing Resolver
 *
 * Implements Sprint S2 requirements conforming to Sections 5, 7.3, 7.4, 7.6, and 10 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md.
 *
 * Responsibilities:
 * 1. Customer-facing display metadata for all 9 notice cartridges (displayTitle, plain subtitle, search aliases).
 * 2. Deterministic search across letters and verified institutional recipients.
 * 3. Bidirectional compatibility resolution between letters and recipients.
 * 4. Multi-purpose disambiguation for tech hardware OEM legal departments (Sonos, Withings, etc.).
 * 5. Clean URL generation for continuous workspace handoff (/notices/[slug] or /notices/[slug]?recipientId=[id]).
 * 6. NAICS 713940 fitness blocker integration (assertNonFitnessEntity / isFitnessEntity).
 */

import {
  ALL_NOTICE_CARTRIDGES,
  getNoticeBySlug,
  DOCKET_PRICING_TIERS,
} from './notices';
import { VERIFIED_RECIPIENTS } from './data/verified-recipients';
import { isFitnessEntity } from './guardrails';
import { VerifiedRecipientEntry, RecipientMode } from './types';

export const FITNESS_BLOCKER_NOTICE =
  'DocketStamp does not prepare or mail gym, health club, or fitness studio cancellation letters. Connected hardware and consumer electronics notices remain available.';

export const CHOOSER_PRICE_CUE = `Mailing from ${DOCKET_PRICING_TIERS.first_class.formattedPrice}. Certified Mail from ${DOCKET_PRICING_TIERS.certified.formattedPrice}.`;

export interface ChooserLetterMetadata {
  slug: string; // Canonical slug used by DocumentWorkspace
  promptSlug: string; // Slug specified in S2 design/prompt (for exact dual-indexing)
  aliases: string[]; // All recognized aliases for URL routing and search
  displayTitle: string; // Customer-facing plain display title
  subtitle: string; // Plain-English subtitle describing the letter
  searchAliases: string[]; // Curated search keywords
  category: 'tenant' | 'credit_debt' | 'cancellation' | 'consumer_rights';
  recipientMode: RecipientMode;
  formalDocumentTitle: string; // Intact formal legal document title for Lob print
  cartridgeId: string;
}

export interface CompanyPurposeOption {
  slug: string; // Canonical slug to navigate to
  promptSlug: string;
  label: string;
  description: string;
}

export interface CompanyCompatibilityResult {
  isCompatible: boolean;
  status: 'single_purpose' | 'multi_purpose' | 'incompatible';
  compatibleSlugs: string[];
  suggestedSlug?: string;
  purposes?: CompanyPurposeOption[];
  clearedReason?: string;
}

/**
 * The 3 deterministic purposes for tech_hardware_legal recipients.
 * Ambiguous hardware companies (Sonos, Withings, etc.) MUST present these 3 options
 * and MUST NEVER silently default to refund.
 */
export const HARDWARE_OEM_PURPOSE_OPTIONS: CompanyPurposeOption[] = [
  {
    slug: 'pre-arbitration-notice-of-dispute-and-refund-request',
    promptSlug: 'smart-device-degraded-functionality-refund-demand',
    label: 'Demand a refund for removed or restricted features',
    description: 'Demand a refund or request restoration for a removed or restricted feature.',
  },
  {
    slug: '30-day-mandatory-arbitration-opt-out-notice',
    promptSlug: 'arbitration-opt-out-notice-30-day',
    label: 'Send an arbitration opt-out notice',
    description: 'Send an opt-out notice after checking your agreement for eligibility and submission rules.',
  },
  {
    slug: 'statutory-health-and-biometric-data-deletion-demand',
    promptSlug: 'ccpa-gdpr-data-deletion-opt-out-request',
    label: 'Demand deletion of your personal data',
    description: 'Put your data-deletion demand and consent revocation in writing.',
  },
];

/**
 * Curated display definitions for all 9 notice cartridges.
 * Customer-facing titles and subtitles follow the scoped SPRINT-0011 copy authority.
 */
export const CHOOSER_LETTERS: ChooserLetterMetadata[] = [
  {
    slug: 'security-deposit-return-demand-letter',
    promptSlug: 'security-deposit-return-demand-letter',
    aliases: ['security-deposit-return', 'security-deposit-demand'],
    displayTitle: 'Demand your security deposit back',
    subtitle: 'Send a formal demand to your landlord or property manager.',
    searchAliases: [
      'security deposit',
      'deposit return',
      'deposit refund',
      'get a security deposit back',
      'landlord deposit',
      'tenant deposit',
      'apartment deposit',
      'security-deposit-return-demand-letter',
    ],
    category: 'tenant',
    recipientMode: 'manual_landlord',
    formalDocumentTitle: getNoticeBySlug('security-deposit-return-demand-letter')?.title || '',
    cartridgeId: 'security-deposit-return-demand-letter',
  },
  {
    slug: 'fcra-credit-bureau-written-dispute-letter',
    promptSlug: 'credit-bureau-dispute-letter-fcra-611',
    aliases: [
      'credit-bureau-dispute',
      'fcra-credit-dispute',
      'credit-bureau-dispute-letter-fcra-611',
    ],
    displayTitle: 'Dispute a credit-report error',
    subtitle: 'Written dispute for Equifax, Experian, or TransUnion',
    searchAliases: [
      'credit report',
      'credit bureau',
      'dispute credit',
      'dispute a credit report error',
      'equifax',
      'experian',
      'transunion',
      'fcra',
      'fcra 611',
      'tradeline error',
      'credit-bureau-dispute-letter-fcra-611',
    ],
    category: 'credit_debt',
    recipientMode: 'verified_credit_bureau',
    formalDocumentTitle: getNoticeBySlug('fcra-credit-bureau-written-dispute-letter')?.title || '',
    cartridgeId: 'fcra-credit-bureau-written-dispute-letter',
  },
  {
    slug: 'fdcpa-30-day-debt-validation-letter',
    promptSlug: 'debt-validation-demand-letter-fdcpa-809',
    aliases: [
      'debt-validation',
      'debt-validation-request',
      'fdcpa-debt-validation',
      'debt-validation-demand-letter-fdcpa-809',
    ],
    displayTitle: 'Dispute a debt and demand verification',
    subtitle: 'Challenge a collection claim and demand written verification.',
    searchAliases: [
      'debt collector',
      'debt validation',
      'verify debt',
      'ask a debt collector to verify a debt',
      'stop collections',
      'fdcpa',
      'fdcpa 809',
      'portfolio recovery',
      'midland credit',
      'debt-validation-demand-letter-fdcpa-809',
    ],
    category: 'credit_debt',
    recipientMode: 'verified_or_manual_debt',
    formalDocumentTitle: getNoticeBySlug('fdcpa-30-day-debt-validation-letter')?.title || '',
    cartridgeId: 'fdcpa-30-day-debt-validation-letter',
  },
  {
    slug: 'written-contract-and-policy-cancellation-letter',
    promptSlug: 'contract-membership-cancellation-notice',
    aliases: [
      'service-policy-cancellation',
      'service-cancellation',
      'contract-membership-cancellation-notice',
    ],
    displayTitle: 'Cancel a service or policy in writing',
    subtitle: 'Send written notice to cancel a service or policy.',
    searchAliases: [
      'cancel service',
      'cancel contract',
      'cancellation notice',
      'cancel a service or contract in writing',
      'adt',
      'vivint',
      'comcast',
      'xfinity',
      'spectrum',
      'terminix',
      'orkin',
      'contract-membership-cancellation-notice',
    ],
    category: 'cancellation',
    recipientMode: 'verified_or_manual_corp',
    formalDocumentTitle: getNoticeBySlug('written-contract-and-policy-cancellation-letter')?.title || '',
    cartridgeId: 'written-contract-and-policy-cancellation-letter',
  },
  {
    slug: 'tenant-repair-and-maintenance-notice',
    promptSlug: 'notice-of-intent-to-withhold-or-repair-and-deduct',
    aliases: [
      'tenant-repair',
      'tenant-repair-request',
      'repair-maintenance-demand',
      'notice-of-intent-to-withhold-or-repair-and-deduct',
    ],
    displayTitle: 'Demand repairs from your landlord',
    subtitle: 'Demand repairs and a written response from your landlord.',
    searchAliases: [
      'repair',
      'repairs',
      'maintenance',
      'request urgent rental repairs',
      'landlord repair',
      'habitability',
      'withhold rent',
      'repair and deduct',
      'tenant repair',
      'mold',
      'heat',
      'plumbing',
      'notice-of-intent-to-withhold-or-repair-and-deduct',
    ],
    category: 'tenant',
    recipientMode: 'manual_landlord',
    formalDocumentTitle: getNoticeBySlug('tenant-repair-and-maintenance-notice')?.title || '',
    cartridgeId: 'tenant-repair-and-maintenance-notice',
  },
  {
    slug: 'tenant-notice-of-intent-to-vacate',
    promptSlug: 'lease-termination-non-renewal-notice',
    aliases: [
      'intent-to-vacate',
      'tenant-vacate-notice',
      'lease-termination-non-renewal-notice',
    ],
    displayTitle: 'Give formal move-out notice',
    subtitle: 'Give your landlord written notice of your planned move-out date.',
    searchAliases: [
      'move out',
      'intent to vacate',
      'end or not renew a lease',
      'end lease',
      'lease termination',
      'non-renewal',
      '30-day notice',
      '60-day notice',
      'vacate apartment',
      'lease-termination-non-renewal-notice',
    ],
    category: 'tenant',
    recipientMode: 'manual_landlord',
    formalDocumentTitle: getNoticeBySlug('tenant-notice-of-intent-to-vacate')?.title || '',
    cartridgeId: 'tenant-notice-of-intent-to-vacate',
  },
  {
    slug: 'pre-arbitration-notice-of-dispute-and-refund-request',
    promptSlug: 'smart-device-degraded-functionality-refund-demand',
    aliases: [
      'pre-arbitration-dispute',
      'pre-arbitration-notice',
      'feature-paywall-refund',
      'smart-device-degraded-functionality-refund-demand',
    ],
    displayTitle: 'Demand a refund for removed or restricted features',
    subtitle: 'Demand a refund or request restoration for a removed product feature.',
    searchAliases: [
      'hardware refund',
      'device refund',
      'removed features',
      'paywall',
      'smart device',
      'request a refund for removed device features',
      'sonos',
      'withings',
      'ecobee',
      'garmin',
      'lg',
      'samsung',
      'canon',
      'roku',
      'tesla',
      'firmware update',
      'degraded functionality',
      'smart-device-degraded-functionality-refund-demand',
    ],
    category: 'consumer_rights',
    recipientMode: 'verified_or_manual_corp',
    formalDocumentTitle: getNoticeBySlug('pre-arbitration-notice-of-dispute-and-refund-request')?.title || '',
    cartridgeId: 'pre-arbitration-notice-of-dispute-and-refund-request',
  },
  {
    slug: '30-day-mandatory-arbitration-opt-out-notice',
    promptSlug: 'arbitration-opt-out-notice-30-day',
    aliases: [
      'arbitration-opt-out',
      'class-action-opt-out',
      '30-day-arbitration-opt-out',
      'arbitration-opt-out-notice-30-day',
    ],
    displayTitle: 'Send an arbitration opt-out notice',
    subtitle: 'Check your agreement for opt-out eligibility, deadline, method, and address.',
    searchAliases: [
      'arbitration opt out',
      'opt out of arbitration',
      'opt out of mandatory arbitration',
      'mandatory arbitration',
      'class action waiver',
      'terms of service opt out',
      '30 day opt out',
      'arbitration-opt-out-notice-30-day',
      'roku arbitration',
      'sonos arbitration',
      'samsung arbitration',
    ],
    category: 'consumer_rights',
    recipientMode: 'verified_or_manual_corp',
    formalDocumentTitle: getNoticeBySlug('30-day-mandatory-arbitration-opt-out-notice')?.title || '',
    cartridgeId: '30-day-mandatory-arbitration-opt-out-notice',
  },
  {
    slug: 'statutory-health-and-biometric-data-deletion-demand',
    promptSlug: 'ccpa-gdpr-data-deletion-opt-out-request',
    aliases: [
      'biometric-privacy-deletion',
      'health-data-erasure',
      'statutory-data-deletion',
      'ccpa-gdpr-data-deletion-opt-out-request',
    ],
    displayTitle: 'Demand deletion of your personal data',
    subtitle: 'Put your data-deletion demand and consent revocation in writing.',
    searchAliases: [
      'data deletion',
      'delete my data',
      'privacy deletion',
      'biometric data',
      'ccpa',
      'gdpr',
      'data privacy',
      'health data',
      'erasure',
      'revoke consent',
      'ccpa-gdpr-data-deletion-opt-out-request',
    ],
    category: 'consumer_rights',
    recipientMode: 'verified_or_manual_corp',
    formalDocumentTitle: getNoticeBySlug('statutory-health-and-biometric-data-deletion-demand')?.title || '',
    cartridgeId: 'statutory-health-and-biometric-data-deletion-demand',
  },
];

/**
 * Fast lookup map indexing all 9 letters by canonical slug, prompt slug, and all aliases.
 */
export const CHOOSER_METADATA_BY_SLUG: Record<string, ChooserLetterMetadata> = {};

for (const item of CHOOSER_LETTERS) {
  CHOOSER_METADATA_BY_SLUG[item.slug] = item;
  CHOOSER_METADATA_BY_SLUG[item.promptSlug] = item;
  for (const alias of item.aliases) {
    CHOOSER_METADATA_BY_SLUG[alias] = item;
  }
}

/**
 * Normalizes any recognized slug or alias to the canonical cartridge slug.
 */
export function normalizeToCanonicalSlug(slug: string): string {
  if (!slug) return '';
  const trimmed = slug.trim().toLowerCase();
  const matched = CHOOSER_METADATA_BY_SLUG[trimmed];
  return matched ? matched.slug : trimmed;
}

/**
 * Returns the ChooserLetterMetadata for a given slug, promptSlug, or alias.
 */
export function getLetterMetadata(slug: string): ChooserLetterMetadata | undefined {
  if (!slug) return undefined;
  return CHOOSER_METADATA_BY_SLUG[slug.trim().toLowerCase()];
}

/**
 * Alias for getLetterMetadata for consistent naming with getNoticeBySlug
 */
export const getChooserLetterBySlug = getLetterMetadata;


/**
 * Resolves a recipient by its ID from the pre-verified recipients registry.
 */
export function getVerifiedRecipientById(id: string): VerifiedRecipientEntry | undefined {
  if (!id) return undefined;
  return VERIFIED_RECIPIENTS.find((r) => r.id === id.trim());
}

/**
 * Returns all canonical slugs compatible with a verified recipient.
 */
export function getCompatibleSlugsForRecipient(
  recipientOrId: VerifiedRecipientEntry | string
): string[] {
  const recipient =
    typeof recipientOrId === 'string'
      ? getVerifiedRecipientById(recipientOrId)
      : recipientOrId;

  if (!recipient) return [];

  switch (recipient.category) {
    case 'credit_bureau':
      return ['fcra-credit-bureau-written-dispute-letter'];
    case 'debt_collector':
      return ['fdcpa-30-day-debt-validation-letter'];
    case 'home_service':
    case 'telecom_insurance':
      return ['written-contract-and-policy-cancellation-letter'];
    case 'tech_hardware_legal':
      return [
        'pre-arbitration-notice-of-dispute-and-refund-request',
        '30-day-mandatory-arbitration-opt-out-notice',
        'statutory-health-and-biometric-data-deletion-demand',
      ];
    default:
      return [];
  }
}

/**
 * Checks if a specific recipient ID is compatible with a given letter slug.
 */
export function isRecipientCompatibleWithLetter(
  recipientId: string,
  slug: string
): boolean {
  if (!recipientId || !slug) return false;
  const canonical = normalizeToCanonicalSlug(slug);
  const compatibleSlugs = getCompatibleSlugsForRecipient(recipientId);
  return compatibleSlugs.includes(canonical);
}

/**
 * Returns all verified recipients compatible with a specific letter slug.
 */
export function getCompatibleRecipientsForSlug(
  slug: string
): VerifiedRecipientEntry[] {
  const canonical = normalizeToCanonicalSlug(slug);
  return VERIFIED_RECIPIENTS.filter((r) =>
    getCompatibleSlugsForRecipient(r).includes(canonical)
  );
}

/**
 * Resolves compatibility between a recipient and an optional current letter slug.
 *
 * Enforces:
 * - Unambiguous corporate categories map 1:1.
 * - Tech hardware OEMs require purpose disambiguation and NEVER silently default to refund.
 * - Incompatible letter changes report a polite cleared reason.
 */
export function resolveRecipientCompatibility(
  recipientOrId: VerifiedRecipientEntry | string,
  currentSlug?: string | null
): CompanyCompatibilityResult {
  const recipient =
    typeof recipientOrId === 'string'
      ? getVerifiedRecipientById(recipientOrId)
      : recipientOrId;

  if (!recipient) {
    return {
      isCompatible: false,
      status: 'incompatible',
      compatibleSlugs: [],
    };
  }

  const compatibleSlugs = getCompatibleSlugsForRecipient(recipient);
  const companyName = recipient.brandName || recipient.formalRecipientLine;

  if (recipient.category === 'tech_hardware_legal') {
    // Multi-purpose ambiguous category
    const canonicalCurrent = currentSlug ? normalizeToCanonicalSlug(currentSlug) : null;
    const isCurrentCompatible = canonicalCurrent
      ? compatibleSlugs.includes(canonicalCurrent)
      : false;

    let clearedReason: string | undefined;
    if (currentSlug && !isCurrentCompatible) {
      const meta = getLetterMetadata(currentSlug);
      clearedReason = meta?.category === 'tenant'
        ? `Cleared ${companyName} because this letter goes to a landlord or custom recipient.`
        : `Cleared ${companyName} because that company is not compatible with this letter.`;
    }

    return {
      isCompatible: isCurrentCompatible,
      status: 'multi_purpose',
      compatibleSlugs,
      suggestedSlug: undefined, // CRITICAL: NEVER silently default to refund!
      purposes: HARDWARE_OEM_PURPOSE_OPTIONS,
      clearedReason,
    };
  }

  // Single-purpose categories: credit_bureau, debt_collector, home_service, telecom_insurance
  const suggestedSlug = compatibleSlugs[0];
  const canonicalCurrent = currentSlug ? normalizeToCanonicalSlug(currentSlug) : null;

  if (!currentSlug) {
    return {
      isCompatible: true,
      status: 'single_purpose',
      compatibleSlugs,
      suggestedSlug,
    };
  }

  const isCurrentCompatible = canonicalCurrent
    ? compatibleSlugs.includes(canonicalCurrent)
    : false;

  let clearedReason: string | undefined;
  if (!isCurrentCompatible) {
    const meta = getLetterMetadata(currentSlug);
    clearedReason = meta?.category === 'tenant'
      ? `Cleared ${companyName} because this letter goes to a landlord or custom recipient.`
      : `Cleared ${companyName} because this letter uses a different recipient.`;
  }

  return {
    isCompatible: isCurrentCompatible,
    status: isCurrentCompatible ? 'single_purpose' : 'incompatible',
    compatibleSlugs,
    suggestedSlug: isCurrentCompatible ? suggestedSlug : undefined,
    clearedReason,
  };
}

/** Alias for resolveRecipientCompatibility */
export const resolveCompanyCompatibility = resolveRecipientCompatibility;

/**
 * Builds the continuous workspace URL for a selected letter and optional recipient.
 *
 * Invariants:
 * - Always targets /notices/${canonicalSlug}
 * - Appends ?recipientId=${recipientId} only when a valid compatible recipient is chosen
 * - NEVER includes tier, state, or personal variables from the chooser
 */
export function buildChooserWorkspaceUrl(
  slug: string,
  recipientId?: string | null
): string {
  const canonical = normalizeToCanonicalSlug(slug);
  if (!canonical) return '/';

  if (recipientId && isRecipientCompatibleWithLetter(recipientId, canonical)) {
    return `/notices/${encodeURIComponent(canonical)}?recipientId=${encodeURIComponent(
      recipientId
    )}`;
  }

  return `/notices/${encodeURIComponent(canonical)}`;
}

export interface ChooserSearchResult {
  letters: ChooserLetterMetadata[];
  companies: VerifiedRecipientEntry[];
  isFitnessBlocked: boolean;
  fitnessBlockerNotice?: string;
  totalMatches: number;
}

/**
 * Deterministic search for the single unified chooser.
 *
 * 1. Checks NAICS 713940 fitness blocker. If blocked, returns zero results and displays
 *    the plain-English compliance notice.
 * 2. Matches letters by title, subtitle, slug, aliases, and search keywords.
 * 3. Matches companies by brand name, formal name, city, and state.
 */
export function searchChooser(query: string): ChooserSearchResult {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      letters: CHOOSER_LETTERS,
      companies: [],
      isFitnessBlocked: false,
      totalMatches: CHOOSER_LETTERS.length,
    };
  }

  // NAICS 713940 fitness guardrail check
  if (isFitnessEntity(trimmed)) {
    return {
      letters: [],
      companies: [],
      isFitnessBlocked: true,
      fitnessBlockerNotice: FITNESS_BLOCKER_NOTICE,
      totalMatches: 0,
    };
  }

  const q = trimmed.toLowerCase();

  // Search letters
  const matchedLetters = CHOOSER_LETTERS.filter((letter) => {
    if (letter.displayTitle.toLowerCase().includes(q)) return true;
    if (letter.subtitle.toLowerCase().includes(q)) return true;
    if (letter.slug.toLowerCase().includes(q)) return true;
    if (letter.promptSlug.toLowerCase().includes(q)) return true;
    if (letter.formalDocumentTitle.toLowerCase().includes(q)) return true;
    if (letter.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    if (letter.searchAliases.some((sa) => sa.toLowerCase().includes(q))) return true;
    return false;
  });

  // Search companies from VERIFIED_RECIPIENTS
  const matchedCompanies = VERIFIED_RECIPIENTS.filter((company) => {
    if (company.brandName.toLowerCase().includes(q)) return true;
    if (company.formalRecipientLine.toLowerCase().includes(q)) return true;
    if (company.city.toLowerCase().includes(q)) return true;
    if (company.state.toLowerCase().includes(q)) return true;
    if (company.name?.toLowerCase().includes(q)) return true;
    if (company.category.toLowerCase().replace('_', ' ').includes(q)) return true;
    return false;
  });

  return {
    letters: matchedLetters,
    companies: matchedCompanies,
    isFitnessBlocked: false,
    totalMatches: matchedLetters.length + matchedCompanies.length,
  };
}

/**
 * Category groups for the dedicated /companies directory.
 */
export const COMPANY_DIRECTORY_CATEGORIES = [
  { id: 'all', label: 'All recipients', count: 38 },
  { id: 'credit_bureau', label: 'Credit bureaus', count: 3 },
  { id: 'debt_collector', label: 'Debt collectors', count: 10 },
  { id: 'home_service', label: 'Home services, security & warranties', count: 9 },
  { id: 'telecom_insurance', label: 'Telecom, satellite & insurance', count: 8 },
  { id: 'tech_hardware_legal', label: 'Connected hardware & electronics', count: 8 },
] as const;

export type CompanyDirectoryCategoryId =
  (typeof COMPANY_DIRECTORY_CATEGORIES)[number]['id'];
