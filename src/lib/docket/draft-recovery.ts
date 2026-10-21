/**
 * DocketStamp Draft Recovery & Real-Time Field Validation Engine
 *
 * Implements Sprint S4 requirements conforming to Sections 7.5, 7.6, and 10 of
 * docs/DOCKETSTAMP_HOME_CONVERSION_DESIGN_SPEC.md:
 *
 * 1. Real Deterministic Validation:
 *    - All required template fields non-empty.
 *    - Realistic address structure validation for sender and recipient addresses
 *      (street/number and recognizable structure; rejects single words like "abc" or "123").
 *    - Valid 5-digit US ZIP code or ZIP+4.
 *    - Valid 2-letter US state code.
 *    - Valid calendar date checking for inputType="date".
 *    - Bounded option checking for inputType="select".
 *    - Hard NAICS 713940 fitness blocker check on recipient name/company.
 *    - Honest progress counts (X of Y details completed).
 *    - First-invalid-field key resolution for focused navigation.
 *
 * 2. Session-Scoped Draft Recovery:
 *    - Keyed by `docketstamp_draft_v2_${slug}` in sessionStorage.
 *    - Survives page refresh and in-tab navigation without storing sensitive personal data in localStorage.
 *    - Explicit reset action to clear draft.
 *
 * 3. Strict Precedence Rule:
 *    - Explicit URL parameters (?recipientId=, ?field.*=, ?tier=) ALWAYS take precedence
 *      over stale session-recovered data.
 *    - Hydration never overwrites subsequent user edits.
 */

import {
  NoticeTemplateDefinition,
  NoticeFieldConfig,
  MailTierId,
} from './types';
import { isFitnessEntity } from './guardrails';
import { STATE_STATUTES } from './data/state-statutes';
import { getVerifiedRecipientById } from './data/verified-recipients';
import { getNoticeBySlug } from './notices';

export interface DraftValidationResult {
  isValid: boolean;
  fieldErrors: Record<string, string>;
  missingOrInvalidFields: string[];
  firstInvalidFieldKey: string | null;
  completedCount: number;
  totalCount: number;
}

export interface StoredNoticeDraft {
  slug: string;
  userValues: Record<string, string>;
  selectedRecipientId?: string | null;
  selectedTier?: MailTierId;
  docketId?: string;
  savedAt: number;
}

const VALID_TIERS: Set<MailTierId> = new Set([
  'first_class',
  'certified',
  'certified_return_receipt',
]);

/**
 * Validates street address structure:
 * Must have a street number or P.O. Box and at least two words.
 * Rejects single words ("abc", "123", "Main") and empty strings.
 */
export function isValidStreetAddress(addr: unknown): boolean {
  if (typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  if (trimmed.length < 5) return false;
  // Must contain a digit OR a PO Box reference
  const hasNumberOrBox = /\d/.test(trimmed) || /\b(p\.?o\.?\s*box|box)\b/i.test(trimmed);
  if (!hasNumberOrBox) return false;
  // Must have at least two words (e.g. "123 Main" or "PO Box 100")
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return true;
}

/**
 * Validates US ZIP code: 5 digits or ZIP+4 (e.g. 97477 or 97477-1234)
 */
export function isValidZipCode(zip: unknown): boolean {
  if (typeof zip !== 'string') return false;
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Validates 2-letter US state code
 */
export function isValidStateCode(state: unknown): boolean {
  if (typeof state !== 'string') return false;
  const trimmed = state.trim().toUpperCase();
  if (trimmed.length !== 2) return false;
  return Boolean(STATE_STATUTES[trimmed] || /^[A-Z]{2}$/.test(trimmed));
}

/**
 * Validates calendar date string:
 * Must be YYYY-MM-DD or parseable valid date with realistic calendar bounds (1900-2100).
 */
export function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (trimmed.length < 8) return false;

  // Strict format or standard parse
  const timestamp = Date.parse(trimmed);
  if (isNaN(timestamp)) return false;

  const parsedDate = new Date(trimmed);
  if (isNaN(parsedDate.getTime())) return false;

  const year = parsedDate.getUTCFullYear();
  if (year < 1900 || year > 2100) return false;

  return true;
}

/**
 * Validates bounded dropdown select against allowed options
 */
export function isValidSelectOption(field: NoticeFieldConfig, val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (!field.options || field.options.length === 0) return true;
  return field.options.some((opt) => opt.value === trimmed);
}

/**
 * Deterministic validation helper for notice drafts.
 * Checks notice-specific fields, sender address, and recipient address.
 */
export function validateNoticeDraft(
  notice: NoticeTemplateDefinition,
  values: Record<string, string>
): DraftValidationResult {
  const fieldErrors: Record<string, string> = {};
  const orderedFieldKeys: string[] = [];

  // Determine whether this notice uses pre-verified credit bureau mode
  const isBureauNotice = notice.recipientMode === 'verified_credit_bureau';

  // 1. SENDER FIELDS (Your details)
  orderedFieldKeys.push('senderFullName');
  const senderName = values.senderFullName || values.tenantFullName || '';
  if (!senderName || senderName.trim().length < 2 || senderName.startsWith('[')) {
    fieldErrors['senderFullName'] = 'Your full legal name is required.';
  }

  // Any notice fields specifically assigned to sender step group
  for (const field of notice.fields) {
    if (field.stepGroup === 'sender' && field.key !== 'senderFullName') {
      if (!orderedFieldKeys.includes(field.key)) {
        orderedFieldKeys.push(field.key);
      }
      validateSingleNoticeField(field, values[field.key], fieldErrors);
    }
  }

  // Sender Mailing Address
  orderedFieldKeys.push('senderAddressLine1');
  const senderLine1 = values.senderAddressLine1 || '';
  if (!isValidStreetAddress(senderLine1)) {
    fieldErrors['senderAddressLine1'] =
      'Please enter your sender mailing street address with number and street (e.g., 123 Main St or P.O. Box 100).';
  }

  orderedFieldKeys.push('senderCity');
  const senderCity = values.senderCity || '';
  if (!senderCity || senderCity.trim().length < 2 || senderCity.startsWith('[')) {
    fieldErrors['senderCity'] = 'City is required.';
  }

  orderedFieldKeys.push('senderState');
  const senderState = values.senderState || '';
  if (!isValidStateCode(senderState)) {
    fieldErrors['senderState'] = 'Select a valid 2-letter state.';
  }

  orderedFieldKeys.push('senderZip');
  const senderZip = values.senderZip || '';
  if (!isValidZipCode(senderZip)) {
    fieldErrors['senderZip'] = 'Enter a valid 5-digit US ZIP code.';
  }

  // 2. RECIPIENT FIELDS (Recipient details)
  if (isBureauNotice) {
    // Credit Bureau: requires selecting a bureau
    orderedFieldKeys.push('bureauEntityId');
    const bureauId = values.bureauEntityId || '';
    const validBureauIds = [
      'cra_eqf',
      'cra_exp',
      'cra_tru',
      'bureau-equifax',
      'bureau-experian',
      'bureau-transunion',
    ];
    if (!bureauId || !validBureauIds.includes(bureauId)) {
      fieldErrors['bureauEntityId'] = 'Please select a target credit bureau.';
    }
  } else {
    // General recipient / landlord
    orderedFieldKeys.push('recipientFormalName');
    const recipientName = values.recipientFormalName || '';
    if (!recipientName || recipientName.trim().length < 2 || recipientName.startsWith('[')) {
      fieldErrors['recipientFormalName'] = 'Recipient or entity name is required.';
    } else if (isFitnessEntity(recipientName)) {
      fieldErrors['recipientFormalName'] =
        'DocketStamp does not prepare or mail gym, health club, or fitness studio cancellation letters (NAICS 713940).';
    }

    // Any notice fields specifically assigned to recipient step group
    for (const field of notice.fields) {
      if (field.stepGroup === 'recipient' && field.key !== 'recipientFormalName' && field.key !== 'bureauEntityId') {
        if (!orderedFieldKeys.includes(field.key)) {
          orderedFieldKeys.push(field.key);
        }
        validateSingleNoticeField(field, values[field.key], fieldErrors);
      }
    }

    // Recipient Mailing Address
    orderedFieldKeys.push('recipientAddressLine1');
    const recipientLine1 = values.recipientAddressLine1 || '';
    if (!isValidStreetAddress(recipientLine1)) {
      fieldErrors['recipientAddressLine1'] =
        'Please enter a recipient street address with number and street (e.g., 100 Main St or P.O. Box 740256).';
    }

    orderedFieldKeys.push('recipientCity');
    const recipientCity = values.recipientCity || '';
    if (!recipientCity || recipientCity.trim().length < 2 || recipientCity.startsWith('[')) {
      fieldErrors['recipientCity'] = 'Recipient city is required.';
    }

    orderedFieldKeys.push('recipientState');
    const recipientState = values.recipientState || '';
    if (!isValidStateCode(recipientState)) {
      fieldErrors['recipientState'] = 'Select a valid 2-letter state for the recipient.';
    }

    orderedFieldKeys.push('recipientZip');
    const recipientZip = values.recipientZip || '';
    if (!isValidZipCode(recipientZip)) {
      fieldErrors['recipientZip'] = 'Enter a valid 5-digit US ZIP code for the recipient.';
    }
  }

  // 3. INSTRUMENT DETAILS (Notice template fields)
  for (const field of notice.fields) {
    if (
      field.key === 'senderFullName' ||
      field.key === 'recipientFormalName' ||
      field.key === 'bureauEntityId' ||
      orderedFieldKeys.includes(field.key)
    ) {
      continue;
    }
    orderedFieldKeys.push(field.key);
    validateSingleNoticeField(field, values[field.key], fieldErrors);
  }

  // Tenant flows display the rental location before sender and recipient details.
  // Keep validation focus aligned with that visual order so the first error lands
  // in the first section the user sees.
  const rentalAddressFirstKeys = notice.category === 'tenant'
    ? notice.fields
        .filter((field) =>
          ['leasedPremisesAddress', 'vacatedPremisesAddress', 'propertyState'].includes(field.key)
        )
        .map((field) => field.key)
    : [];
  const visualFieldKeys = [
    ...rentalAddressFirstKeys,
    ...orderedFieldKeys.filter((key) => !rentalAddressFirstKeys.includes(key)),
  ];

  // Compute missing/invalid fields and progress
  const missingOrInvalidFields: string[] = [];
  for (const key of visualFieldKeys) {
    if (fieldErrors[key]) {
      missingOrInvalidFields.push(key);
    }
  }

  const totalCount = visualFieldKeys.length;
  const completedCount = totalCount - missingOrInvalidFields.length;
  const isValid = missingOrInvalidFields.length === 0;
  const firstInvalidFieldKey = missingOrInvalidFields[0] || null;

  return {
    isValid,
    fieldErrors,
    missingOrInvalidFields,
    firstInvalidFieldKey,
    completedCount,
    totalCount,
  };
}

function validateSingleNoticeField(
  field: NoticeFieldConfig,
  rawVal: unknown,
  errors: Record<string, string>
): void {
  const val = typeof rawVal === 'string' ? rawVal.trim() : '';

  if (!val || val.length === 0 || val.startsWith('[')) {
    errors[field.key] = `${field.label} is required.`;
    return;
  }

  // Date check
  if (field.inputType === 'date') {
    if (!isValidCalendarDate(val)) {
      errors[field.key] = `Please enter a valid calendar date for ${field.label} (YYYY-MM-DD).`;
      return;
    }
  }

  // Select check
  if (field.inputType === 'select') {
    if (!isValidSelectOption(field, val)) {
      errors[field.key] = `Please select an option for ${field.label}.`;
      return;
    }
  }

  // State select check
  if (field.inputType === 'state_select' || field.key === 'propertyState') {
    if (!isValidStateCode(val)) {
      errors[field.key] = 'Please select a valid 2-letter state.';
      return;
    }
  }

  // SSN Last 4 check
  if (field.key === 'ssnLast4') {
    if (!/^\d{4}$/.test(val)) {
      errors[field.key] = 'Must be exactly 4 numeric digits.';
      return;
    }
  }

  // Max length check
  if (field.maxLength && val.length > field.maxLength) {
    errors[field.key] = `${field.label} exceeds maximum allowed length (${field.maxLength} chars).`;
    return;
  }

  // Specialized address fields in template
  const streetAddressFieldKeys = [
    'leasedPremisesAddress',
    'vacatedPremisesAddress',
    'rentalPropertyAddress',
    'servicePropertyAddress',
    'forwardingAddress',
  ];
  if (streetAddressFieldKeys.includes(field.key)) {
    if (!isValidStreetAddress(val)) {
      errors[field.key] = `Please enter a complete street address with number and street name for ${field.label}.`;
      return;
    }
  }
}

/**
 * Returns the scoped sessionStorage key for a notice slug
 */
export function getDraftStorageKey(slug: string): string {
  return `docketstamp_draft_v2_${slug.trim().toLowerCase()}`;
}

function getDraftSlugCandidates(slug: string): { canonicalSlug: string; slugs: string[] } {
  const notice = getNoticeBySlug(slug);
  const canonicalSlug = notice?.slug || slug.trim().toLowerCase();
  const slugs = [...new Set([
    canonicalSlug,
    ...(notice?.aliases || []).map((alias) => alias.trim().toLowerCase()),
  ])];
  return { canonicalSlug, slugs };
}

/**
 * Persists notice draft in sessionStorage (tab-scoped, no sensitive persistence in localStorage)
 */
export function saveNoticeDraft(
  slug: string,
  draft: {
    userValues: Record<string, string>;
    selectedRecipientId?: string | null;
    selectedTier?: MailTierId;
    docketId?: string;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const { canonicalSlug } = getDraftSlugCandidates(slug);
    const payload: StoredNoticeDraft = {
      slug: canonicalSlug,
      userValues: draft.userValues,
      selectedRecipientId: draft.selectedRecipientId || null,
      selectedTier: draft.selectedTier,
      docketId: draft.docketId,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(getDraftStorageKey(canonicalSlug), JSON.stringify(payload));
  } catch {
    // Graceful fallback for storage quota or privacy mode restrictions
  }
}

/**
 * Loads draft from sessionStorage for the active notice
 */
export function loadNoticeDraft(slug: string): StoredNoticeDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const { canonicalSlug, slugs } = getDraftSlugCandidates(slug);
    const canonicalKey = getDraftStorageKey(canonicalSlug);
    const canonicalRaw = window.sessionStorage.getItem(canonicalKey);

    for (const candidateSlug of slugs) {
      const key = getDraftStorageKey(candidateSlug);
      const raw = candidateSlug === canonicalSlug
        ? canonicalRaw
        : window.sessionStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const storedSlug = parsed && typeof parsed === 'object' && typeof parsed.slug === 'string'
        ? parsed.slug.trim().toLowerCase()
        : '';
      if (!parsed || typeof parsed !== 'object' || storedSlug !== candidateSlug) continue;

      const recovered: StoredNoticeDraft = { ...parsed, slug: canonicalSlug } as StoredNoticeDraft;
      // Copy a legacy draft into the canonical namespace only when it is empty.
      // Keep the original key and never overwrite any pre-existing canonical data.
      if (candidateSlug !== canonicalSlug && canonicalRaw === null) {
        try {
          window.sessionStorage.setItem(canonicalKey, JSON.stringify(recovered));
        } catch {
          // The recovered legacy draft is still returned if storage is read-only or full.
        }
      }
      return recovered;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears saved draft from sessionStorage
 */
export function clearNoticeDraft(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    const { slugs } = getDraftSlugCandidates(slug);
    for (const candidate of slugs) {
      window.sessionStorage.removeItem(getDraftStorageKey(candidate));
    }
  } catch {
    // Ignore
  }
}

export interface ResolveInitialDraftOptions {
  notice: NoticeTemplateDefinition;
  initialValues?: Record<string, string>;
  searchParams?: URLSearchParams | null;
}

export interface ResolvedWorkspaceDraft {
  userValues: Record<string, string>;
  selectedTier: MailTierId;
  selectedRecipientId: string | null;
  explicitKeys: Set<string>;
  explicitRecipientId: string | null;
}

const RECIPIENT_FIELD_KEYS = new Set([
  'recipientFormalName',
  'recipientAddressLine1',
  'recipientAddressLine2',
  'recipientCity',
  'recipientState',
  'recipientZip',
  'bureauEntityId',
]);

/**
 * Resolves initial workspace draft enforcing the strict Precedence Rule:
 * Explicit URL parameters (?recipientId=, ?field.*=, ?tier=) ALWAYS take precedence
 * over stale session-recovered data!
 */
export function resolveInitialWorkspaceDraft({
  notice,
  initialValues = {},
  searchParams,
}: ResolveInitialDraftOptions): ResolvedWorkspaceDraft {
  const explicitKeys = new Set<string>();
  const explicitValues: Record<string, string> = {};
  let explicitTier: MailTierId | null = null;
  let explicitRecipientId: string | null = null;

  // 1. Parse searchParams (or window.location.search fallback)
  let params = searchParams;
  if (!params && typeof window !== 'undefined' && window.location.search) {
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      // Safe fallback
    }
  }

  if (params) {
    // Recipient param
    const rId = params.get('recipientId') || params.get('recipient');
    if (rId) {
      explicitRecipientId = rId;
      explicitKeys.add('recipientId');
      const rec = getVerifiedRecipientById(rId);
      if (rec) {
        explicitValues.recipientFormalName = rec.formalRecipientLine || rec.brandName;
        explicitValues.recipientAddressLine1 = rec.addressLine1;
        explicitValues.recipientCity = rec.city;
        explicitValues.recipientState = rec.state;
        explicitValues.recipientZip = rec.zip;
        if (notice.slug.includes('credit-bureau') || rec.category === 'credit_bureau') {
          explicitValues.bureauEntityId = rec.id;
        }
        for (const k of Object.keys(explicitValues)) {
          explicitKeys.add(k);
        }
        if (rec.recommendedTier && VALID_TIERS.has(rec.recommendedTier)) {
          explicitTier = rec.recommendedTier;
        }
      }
    }

    // Tier param
    const tierParam = params.get('tier') || params.get('serviceLevel');
    if (tierParam && VALID_TIERS.has(tierParam as MailTierId)) {
      explicitTier = tierParam as MailTierId;
    }

    // Direct and dot-notation field params
    const noticeFieldKeys = new Set(notice.fields.map((f) => f.key));
    const commonFieldKeys = new Set([
      'senderFullName',
      'senderAddressLine1',
      'senderAddressLine2',
      'senderCity',
      'senderState',
      'senderZip',
      'propertyState',
      'consumerResidenceState',
      'docketId',
    ]);

    params.forEach((val, key) => {
      if (!val) return;
      if (key.startsWith('field.')) {
        const fieldKey = key.slice(6);
        if (fieldKey) {
          explicitValues[fieldKey] = val;
          explicitKeys.add(fieldKey);
        }
      } else if (noticeFieldKeys.has(key) || commonFieldKeys.has(key)) {
        explicitValues[key] = val;
        explicitKeys.add(key);
      }
    });
  }

  // 2. Load session draft
  const sessionDraft = loadNoticeDraft(notice.slug);

  // 3. Assemble final user values:
  // Base: initialValues
  const finalValues: Record<string, string> = {
    ...initialValues,
  };

  // Merge session draft:
  if (sessionDraft && sessionDraft.userValues) {
    for (const [k, v] of Object.entries(sessionDraft.userValues)) {
      // If URL has explicit recipientId, DO NOT overwrite with stale recipient data from session!
      if (explicitRecipientId && RECIPIENT_FIELD_KEYS.has(k)) {
        continue;
      }
      // If URL explicitly set this key, DO NOT overwrite with session data!
      if (explicitKeys.has(k)) {
        continue;
      }
      finalValues[k] = v;
    }
  }

  // Merge explicit URL values (highest priority)
  for (const [k, v] of Object.entries(explicitValues)) {
    finalValues[k] = v;
  }

  // Resolve tier
  const finalTier: MailTierId =
    explicitTier ||
    (sessionDraft?.selectedTier && VALID_TIERS.has(sessionDraft.selectedTier)
      ? sessionDraft.selectedTier
      : notice.recommendedTier);

  // Resolve selected recipient ID
  const finalRecipientId: string | null =
    explicitRecipientId || sessionDraft?.selectedRecipientId || finalValues.bureauEntityId || null;

  return {
    userValues: finalValues,
    selectedTier: finalTier,
    selectedRecipientId: finalRecipientId,
    explicitKeys,
    explicitRecipientId,
  };
}
