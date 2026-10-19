import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { MailTierId, PricingTierMetadata } from '@/src/lib/docket/types';
import { getNoticeBySlug, DOCKET_PRICING_TIERS } from '@/src/lib/docket/notices';
import { getVerifiedRecipientById } from '@/src/lib/docket/data/verified-recipients';
import { assertNonFitnessEntity, ConflictOfInterestError } from '@/src/lib/docket/guardrails';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { recordServerBusinessEvent } from '@/lib/admin-console/measurement/store';

export interface PostalAddressInput {
  name?: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  [key: string]: unknown;
}

export interface StageDraftRequest {
  noticeSlug: string;
  recipientId?: string;
  customRecipient?: PostalAddressInput;
  sender?: PostalAddressInput;
  fieldValues?: Record<string, any>;
  recommendedTier?: MailTierId;
}

export interface StagedDraftRecord {
  stageId: string;
  noticeSlug: string;
  noticeTitle: string;
  recipientId?: string;
  recipient?: any;
  customRecipient?: PostalAddressInput;
  sender?: PostalAddressInput;
  fieldValues: Record<string, any>;
  recommendedTier: MailTierId;
  missingRequiredFields: string[];
  previewSummary: string;
  reviewUrl: string;
  pricingTiers: Record<MailTierId, PricingTierMetadata>;
  createdAt: string;
  expiresAt: string;
}

export interface StageDraftSuccess {
  success: true;
  stageId: string;
  noticeSlug: string;
  reviewUrl: string;
  missingRequiredFields: string[];
  previewSummary: string;
  pricingTiers: Record<MailTierId, PricingTierMetadata>;
  expiresAt: string;
  draft: StagedDraftRecord;
}

export interface StageDraftFailure {
  success: false;
  status: number;
  error: string;
  code: string;
  details?: any;
}

export type StageDraftResult = StageDraftSuccess | StageDraftFailure;

// In-memory cache for ultra-fast access and fallback
const inMemoryDrafts = new Map<string, StagedDraftRecord>();

const DATA_DIR = path.join(process.cwd(), '.data');
const DRAFTS_FILE = path.join(DATA_DIR, 'staged-drafts.json');

function generateStageId(): string {
  return `DS-STAGE-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

function loadDraftsFromFile(): Map<string, StagedDraftRecord> {
  const map = new Map<string, StagedDraftRecord>();
  try {
    if (fs.existsSync(DRAFTS_FILE)) {
      const raw = fs.readFileSync(DRAFTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const now = Date.now();
        for (const [key, val] of Object.entries(parsed)) {
          const record = val as StagedDraftRecord;
          // Only load unexpired records
          if (record && record.expiresAt && new Date(record.expiresAt).getTime() > now) {
            map.set(key, record);
          }
        }
      }
    }
  } catch (err) {
    console.error('[stage-store] Could not read staged drafts file, using in-memory store:', err);
  }
  return map;
}

async function persistDraft(record: StagedDraftRecord): Promise<void> {
  // New writes must reach shared durable storage before a resumable link is returned.
  await firestoreDb.collection('staged_drafts_v1').doc(record.stageId).set(
    sanitizeFirestoreData({ ...record, schemaVersion: 1, expiresAtMs: Date.parse(record.expiresAt) })
  );
  inMemoryDrafts.set(record.stageId, record);
}

export async function getStagedDraft(stageId: string): Promise<StagedDraftRecord | null> {
  if (!stageId) return null;

  const now = Date.now();

  let record = inMemoryDrafts.get(stageId);

  if (!record) {
    const snap = await firestoreDb.collection('staged_drafts_v1').doc(stageId).get();
    if (snap.exists) record = snap.data() as StagedDraftRecord;
    if (record) {
      inMemoryDrafts.set(stageId, record);
    }
  }

  // Read legacy file drafts during migration; new writes never fall back to process-local storage.
  if (!record) record = loadDraftsFromFile().get(stageId);

  if (!record) return null;

  // Check TTL (7-day expiration)
  if (new Date(record.expiresAt).getTime() <= now) {
    inMemoryDrafts.delete(stageId);
    return null;
  }

  return record;
}

export async function createStagedDraft(body: StageDraftRequest): Promise<StageDraftResult> {
  // 1. Guardrail check: assertNonFitnessEntity
  try {
    if (body.noticeSlug) {
      assertNonFitnessEntity(body.noticeSlug);
    }
    if (body.recipientId) {
      assertNonFitnessEntity(body.recipientId);
    }
    if (body.customRecipient) {
      assertNonFitnessEntity(body.customRecipient);
    }
    if (body.fieldValues) {
      assertNonFitnessEntity(body.fieldValues);
    }
    if (body.sender) {
      assertNonFitnessEntity(body.sender);
    }
  } catch (err: any) {
    if (
      err instanceof ConflictOfInterestError ||
      err?.name === 'ConflictOfInterestError' ||
      err?.code === 'CONFLICT_OF_INTEREST_FITNESS_EXCLUSION' ||
      (err?.message && err.message.includes('NAICS 713940'))
    ) {
      return {
        success: false,
        status: 400,
        error: err.message || 'Prohibited fitness entity category (NAICS 713940). DocketStamp strictly excludes gym and fitness memberships.',
        code: 'CONFLICT_OF_INTEREST',
      };
    }
    throw err;
  }

  // 2. Validate noticeSlug existence
  if (!body.noticeSlug || typeof body.noticeSlug !== 'string') {
    return {
      success: false,
      status: 400,
      error: 'Field "noticeSlug" is required.',
      code: 'MISSING_NOTICE_SLUG',
    };
  }

  const notice = getNoticeBySlug(body.noticeSlug);
  if (!notice) {
    return {
      success: false,
      status: 404,
      error: `Notice cartridge not found for slug '${body.noticeSlug}'.`,
      code: 'NOT_FOUND',
    };
  }

  // 3. Verify recipientId if provided
  let recipientEntry: any = undefined;
  if (body.recipientId) {
    recipientEntry = getVerifiedRecipientById(body.recipientId);
    if (!recipientEntry) {
      return {
        success: false,
        status: 400,
        error: `Verified recipient '${body.recipientId}' not found.`,
        code: 'INVALID_RECIPIENT_ID',
      };
    }
  }

  // 4. Validate provided fieldValues against partial Zod schema
  const fieldValues = body.fieldValues || {};
  if (notice.zodSchema) {
    let parseResult: any = { success: true };
    try {
      const def = (notice.zodSchema as any)._def;
      if (def && def.shape) {
        const rawShape = typeof def.shape === 'function' ? def.shape() : def.shape;
        parseResult = z.object(rawShape).partial().safeParse(fieldValues);
      } else if (typeof (notice.zodSchema as any).partial === 'function') {
        parseResult = (notice.zodSchema as any).partial().safeParse(fieldValues);
      }
    } catch {
      // If schema structure differs, validate present fields individually
      if ((notice.zodSchema as any)._def?.shape) {
        const shape = (notice.zodSchema as any)._def.shape;
        const rawShape = typeof shape === 'function' ? shape() : shape;
        for (const [key, val] of Object.entries(fieldValues)) {
          if (rawShape[key] && val !== undefined && val !== null && val !== '') {
            const fieldRes = rawShape[key].safeParse(val);
            if (!fieldRes.success) {
              parseResult = fieldRes;
              break;
            }
          }
        }
      }
    }

    if (!parseResult.success) {
      return {
        success: false,
        status: 400,
        error: 'Provided fieldValues failed cartridge schema validation.',
        code: 'INVALID_FIELD_VALUES',
        details: parseResult.error?.flatten ? parseResult.error.flatten() : parseResult.error,
      };
    }
  }

  // 5. Compute missingRequiredFields
  const missingRequiredFields: string[] = [];
  if (notice.fields && Array.isArray(notice.fields)) {
    for (const field of notice.fields) {
      const val = fieldValues[field.key];
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        missingRequiredFields.push(field.key);
      }
    }
  }

  // 6. Generate stageId, timestamps, reviewUrl
  const stageId = generateStageId();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + 7 * 86400 * 1000).toISOString(); // 7-day TTL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://docketstamp.com';
  const reviewUrl = `${baseUrl}/notices/${notice.slug}?stage=${stageId}`;
  const recommendedTier = body.recommendedTier || notice.recommendedTier || 'certified_return_receipt';
  const previewSummary = notice.shortDescription || notice.title;

  const record: StagedDraftRecord = {
    stageId,
    noticeSlug: notice.slug,
    noticeTitle: notice.title,
    recipientId: body.recipientId,
    recipient: recipientEntry,
    customRecipient: body.customRecipient,
    sender: body.sender,
    fieldValues,
    recommendedTier,
    missingRequiredFields,
    previewSummary,
    reviewUrl,
    pricingTiers: DOCKET_PRICING_TIERS,
    createdAt,
    expiresAt,
  };

  try {
    await persistDraft(record);
  } catch {
    console.error('[stage-store] Durable stage write failed; no resume link returned.');
    return {
      success: false,
      status: 503,
      error: 'Draft could not be saved for resume. Please retry.',
      code: 'STORAGE_UNAVAILABLE',
    };
  }

  // Analytics are observational; a failed event must never undo a durable draft.
  try {
    await recordServerBusinessEvent({
      eventName: 'stage_created',
      idempotencyKey: `stage-created:${stageId}`,
      noticeId: notice.slug,
      classification: 'unresolved',
    });
  } catch {
    console.warn('[stage-store] Stage was saved but measurement event could not be recorded.');
  }

  return {
    success: true,
    stageId,
    noticeSlug: notice.slug,
    reviewUrl,
    missingRequiredFields,
    previewSummary,
    pricingTiers: DOCKET_PRICING_TIERS,
    expiresAt,
    draft: record,
  };
}
