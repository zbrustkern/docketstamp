import crypto from 'node:crypto';
import { z } from 'zod';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { ALL_NOTICE_CARTRIDGES } from '@/src/lib/docket/notices';
import { STATE_STATUTES } from '@/src/lib/docket/data/state-statutes';
import { UPL_COMPLIANCE_FOOTER_TEXT } from '@/src/lib/docket/guardrails';
import {
  AdminTemplateCatalogEntry, AdminTemplatesResponse, AvailabilityDecision, GeoRule,
  GlobalTemplatePolicy, PolicyNexus, PublicAvailabilityResponse, PublicTemplateAvailability,
  TemplatePolicy, TemplatePolicyDocument, TemplateReview, TemplateSettings,
  TemplateSource, US_STATE_CODES, evaluateTemplateAvailability,
} from '@/src/lib/docket/template-policy';
import { serverEnvironment } from '@/lib/admin-console/commands/access';

// Increment when renderer token/enum mapping semantics change in a way that can
// alter the meaning of the compiled notice, in addition to the inputs hashed below.
// Also bump for custom schema refinements/transforms: function semantics are not
// safely serializable by schemaFingerprint().
export const TEMPLATE_RENDERING_POLICY_REVISION = 1;
const POLICY_COLLECTION = 'template_availability_v1';
const POLICY_ID_PREFIX = 'policy_';
const AUDIT_COLLECTION = 'template_policy_audit_v1';
const RECEIPT_COLLECTION = 'template_policy_receipts_v1';
const HISTORY_COLLECTION = 'template_policy_history_v1';
const MAX_HISTORY = 25;
const ALL_RULE: GeoRule = { mode: 'all', states: [] };
const DEFAULT_GLOBAL: GlobalTemplatePolicy = {
  enabled: true, requireCurrentReview: false,
  residence: { ...ALL_RULE }, property: { ...ALL_RULE },
};
const EMPTY_REVIEW: TemplateReview = {
  status: 'unreviewed', reviewer: '', reviewedAt: null, reviewBy: null,
  evidenceUrl: '', notes: '', contentDigest: null,
};
const MIGRATION_ENABLED_SLUGS = new Set([
  'tenant-notice-of-intent-to-vacate', 'security-deposit-return-demand-letter',
  'tenant-repair-and-maintenance-notice', 'fcra-credit-bureau-written-dispute-letter',
  'fdcpa-30-day-debt-validation-letter', 'written-contract-and-policy-cancellation-letter',
  'pre-arbitration-notice-of-dispute-and-refund-request', '30-day-mandatory-arbitration-opt-out-notice',
  'statutory-health-and-biometric-data-deletion-demand',
]);

const env = (): TemplatePolicyDocument['environment'] => serverEnvironment();
const idForEnv = (environment: string) => `${POLICY_ID_PREFIX}${environment}`;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
function schemaFingerprint(schema: any): unknown {
  if (!schema || typeof schema !== 'object') return null;
  const def = schema._def || {};
  const checks = Array.isArray(def.checks) ? def.checks.map((check: any) => {
    const checkDef = check?._zod?.def || check?._def || check;
    const result: Record<string, unknown> = {};
    for (const key of ['kind','check','type','value','values','minimum','maximum','inclusive','exact','format','regex']) {
      const value = checkDef?.[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) result[key] = value;
    }
    return result;
  }) : [];
  const enumValues = def.values || def.entries;
  const values = enumValues && typeof enumValues === 'object' ? Object.values(enumValues).filter((value) => typeof value === 'string') : undefined;
  const nested = def.innerType ? schemaFingerprint(def.innerType) : undefined;
  return { type: def.typeName || def.type || 'unknown', checks, values, nested };
}

export function getNoticeContentDigest(notice: (typeof ALL_NOTICE_CARTRIDGES)[number]): string {
  const shape = (notice.zodSchema as any)?._def?.shape;
  const schemaShape = typeof shape === 'function' ? shape() : shape || {};
  const meaningfulDefinition = {
    id: notice.id, slug: notice.slug, category: notice.category, title: notice.title,
    documentHeaderTitle: notice.documentHeaderTitle, reLineTemplate: notice.reLineTemplate,
    usesStateStatuteLookup: notice.usesStateStatuteLookup,
    fields: notice.fields.map((field) => ({
      key: field.key, label: field.label, inputType: field.inputType, helperText: field.helperText,
      options: field.options, maxLength: field.maxLength, docusignTagLabel: field.docusignTagLabel,
    })),
    requiredSchema: Object.keys(schemaShape).sort().map((key) => [key, schemaFingerprint(schemaShape[key])]), bodyParagraphs: notice.bodyParagraphs,
    enclosuresLine: notice.enclosuresLine || null,
    complianceFooter: UPL_COMPLIANCE_FOOTER_TEXT('DS-POLICY-DIGEST'),
    stateCitationData: notice.usesStateStatuteLookup ? STATE_STATUTES : null,
    renderingPolicyRevision: TEMPLATE_RENDERING_POLICY_REVISION,
  };
  return sha256(stable(meaningfulDefinition));
}

const defaultSource = (): TemplateSource => ({
  kind: 'original', title: 'DocketStamp original deterministic template', url: '',
  jurisdiction: 'United States', retrievedAt: '', reuseStatus: 'unverified', notes: '',
});
function defaultTemplate(): TemplatePolicy {
  return {
    enabled: true, requireCurrentReview: false,
    residence: { ...ALL_RULE }, property: { ...ALL_RULE }, sources: [defaultSource()],
    review: { ...EMPTY_REVIEW },
  };
}
function futureTemplate(): TemplatePolicy {
  return { ...defaultTemplate(), enabled: false };
}

const stateCodeSet = new Set<string>(US_STATE_CODES);
const stateCodeSchema = z.string().refine((state) => stateCodeSet.has(state), 'Unknown state code');
const stateListSchema = z.array(stateCodeSchema).max(51);
const geoRuleSchema = z.object({
  mode: z.enum(['all','allowlist','blocklist']), states: stateListSchema,
}).strict().superRefine((rule, ctx) => {
  if (rule.mode === 'all' && rule.states.length) ctx.addIssue({ code: 'custom', message: 'all mode cannot include states' });
  if (new Set(rule.states).size !== rule.states.length) ctx.addIssue({ code: 'custom', message: 'states must be unique' });
});
const sourceSchema = z.object({
  kind: z.enum(['original','official_sample','official_guidance']),
  title: z.string().trim().min(1).max(160), url: z.string().trim().max(500),
  jurisdiction: z.string().trim().min(1).max(120), retrievedAt: z.string().max(40),
  reuseStatus: z.enum(['unverified','permitted','restricted']), notes: z.string().max(1000),
}).strict().superRefine((source, ctx) => {
  if (source.kind !== 'original' && !validHttpUrl(source.url)) ctx.addIssue({ code: 'custom', path: ['url'], message: 'external sources require an HTTP(S) URL' });
  if (source.url && !validHttpUrl(source.url)) ctx.addIssue({ code: 'custom', path: ['url'], message: 'URL must use HTTP(S)' });
  if (source.retrievedAt && !validDate(source.retrievedAt)) ctx.addIssue({ code: 'custom', path: ['retrievedAt'], message: 'retrievedAt must be a valid date' });
});
export const templateSettingsSchema = z.object({
  enabled: z.boolean(), requireCurrentReview: z.boolean(), residence: geoRuleSchema,
  property: geoRuleSchema, sources: z.array(sourceSchema).max(20),
}).strict();
export const globalTemplatePolicySchema = z.object({
  enabled: z.boolean(), requireCurrentReview: z.boolean(), residence: geoRuleSchema, property: geoRuleSchema,
}).strict();
const reviewInputSchema = z.object({
  status: z.enum(['unreviewed','in_review','approved','hold']), reviewer: z.string().trim().max(120),
  reviewBy: z.string().max(40).nullable(), evidenceUrl: z.string().trim().max(500), notes: z.string().max(2000),
}).strict().superRefine((review, ctx) => {
  if (review.reviewBy && !validDate(review.reviewBy)) ctx.addIssue({ code: 'custom', path: ['reviewBy'], message: 'reviewBy must be a valid date' });
  if (review.evidenceUrl && !validHttpUrl(review.evidenceUrl)) ctx.addIssue({ code: 'custom', path: ['evidenceUrl'], message: 'evidence URL must use HTTP(S)' });
});
export const templateMutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_global'), requestId: z.string().regex(/^[a-zA-Z0-9_.:-]{8,128}$/), reason: z.string().trim().min(1).max(500), expectedRevision: z.number().int().nonnegative(), global: globalTemplatePolicySchema }).strict(),
  z.object({ action: z.literal('set_template'), requestId: z.string().regex(/^[a-zA-Z0-9_.:-]{8,128}$/), reason: z.string().trim().min(1).max(500), expectedRevision: z.number().int().nonnegative(), slug: z.string().min(1).max(120), expectedContentDigest: z.string().regex(/^[a-f0-9]{64}$/), settings: templateSettingsSchema, review: reviewInputSchema.optional() }).strict(),
]);
export type TemplateMutation = z.infer<typeof templateMutationSchema>;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}
function validHttpUrl(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
}

function defaultDocument(environment: TemplatePolicyDocument['environment']): TemplatePolicyDocument {
  const templates: Record<string, TemplatePolicy> = {};
  for (const notice of ALL_NOTICE_CARTRIDGES) templates[notice.slug] = MIGRATION_ENABLED_SLUGS.has(notice.slug) ? defaultTemplate() : futureTemplate();
  return { schemaVersion: 1, revision: 0, environment, global: DEFAULT_GLOBAL, templates, updatedAt: null, updatedBy: null };
}

function validatePolicyDocument(input: unknown, environment: TemplatePolicyDocument['environment']): TemplatePolicyDocument {
  const schema = z.object({
    schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), environment: z.enum(['local','staging','production']),
    global: globalTemplatePolicySchema, templates: z.record(z.string(), z.object({
      enabled: z.boolean(), requireCurrentReview: z.boolean(), residence: geoRuleSchema, property: geoRuleSchema,
      sources: z.array(sourceSchema).max(20), review: z.object({
        status: z.enum(['unreviewed','in_review','approved','hold']), reviewer: z.string().max(120),
        reviewedAt: z.string().nullable(), reviewBy: z.string().nullable(), evidenceUrl: z.string().max(500),
        notes: z.string().max(2000), contentDigest: z.string().nullable(),
      }).strict(),
    }).strict()), updatedAt: z.string().nullable(), updatedBy: z.string().nullable(),
  }).strict();
  const parsed = schema.parse(input);
  if (parsed.environment !== environment) throw new Error('POLICY_ENVIRONMENT_MISMATCH');
  return parsed as TemplatePolicyDocument;
}

function mergeDocument(input: TemplatePolicyDocument): TemplatePolicyDocument {
  const templates = { ...input.templates };
  // Only a wholly absent policy gets migration defaults. Missing entries in a
  // saved policy must not silently restore a previously paused template.
  for (const notice of ALL_NOTICE_CARTRIDGES) if (!templates[notice.slug]) templates[notice.slug] = futureTemplate();
  return { ...input, templates };
}

function isReviewCurrent(policy: TemplatePolicy, digest: string, now = Date.now()): boolean {
  const review = policy.review;
  if (review.status !== 'approved' || review.contentDigest !== digest || !review.reviewer.trim() || !review.evidenceUrl.trim()) return false;
  if (!review.reviewedAt || !review.reviewBy || !validDate(review.reviewedAt) || !validDate(review.reviewBy)) return false;
  return Date.parse(review.reviewedAt) <= now && Date.parse(review.reviewBy) > now;
}

export function policyToPublicEntry(notice: (typeof ALL_NOTICE_CARTRIDGES)[number], document: TemplatePolicyDocument, now = Date.now()): PublicTemplateAvailability {
  const digest = getNoticeContentDigest(notice);
  const currentPolicy = document.templates[notice.slug] || futureTemplate();
  const residenceRules = [document.global.residence, currentPolicy.residence];
  const propertyRules = notice.category === 'tenant' ? [document.global.property, currentPolicy.property] : [];
  let reasonCode: string | null = null;
  if (!document.global.enabled || !currentPolicy.enabled) reasonCode = 'TEMPLATE_UNAVAILABLE';
  else if (currentPolicy.review.status === 'hold') reasonCode = 'TEMPLATE_ON_HOLD';
  else if ((document.global.requireCurrentReview || currentPolicy.requireCurrentReview) && !isReviewCurrent(currentPolicy, digest, now)) reasonCode = 'REVIEW_REQUIRED';
  const restrictive = (rules: GeoRule[]) => rules.some((rule) => rule.mode !== 'all' && rule.states.length > 0);
  return {
    slug: notice.slug, title: notice.title, category: notice.category, contentDigest: digest,
    available: reasonCode === null, reasonCode,
    reason: reasonCode ? 'This notice is not currently available.' : null,
    requiresResidence: restrictive(residenceRules), requiresProperty: restrictive(propertyRules),
    residenceRules, propertyRules,
  };
}

export function evaluatePolicy(document: TemplatePolicyDocument, slug: string, nexus: PolicyNexus): AvailabilityDecision {
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === slug);
  if (!notice) return { allowed: false, code: 'TEMPLATE_NOT_FOUND', message: 'This notice is not currently available.', requiredFields: [] };
  return evaluateTemplateAvailability(policyToPublicEntry(notice, document), nexus);
}

async function readPolicySnapshot(tx?: FirebaseFirestore.Transaction): Promise<{ ref: FirebaseFirestore.DocumentReference; document: TemplatePolicyDocument }> {
  const environment = env();
  const ref = firestoreDb.collection(POLICY_COLLECTION).doc(idForEnv(environment));
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) return { ref, document: defaultDocument(environment) };
  const parsed = validatePolicyDocument(snap.data(), environment);
  return { ref, document: mergeDocument(parsed) };
}

export async function getPolicyDocument(): Promise<TemplatePolicyDocument> {
  return (await readPolicySnapshot()).document;
}

export async function getPublicTemplateAvailability(): Promise<PublicAvailabilityResponse> {
  const policy = await getPolicyDocument();
  return { revision: policy.revision, templates: ALL_NOTICE_CARTRIDGES.map((notice) => policyToPublicEntry(notice, policy)) };
}

export async function getAdminTemplatesResponse(canManage: boolean): Promise<AdminTemplatesResponse> {
  const policy = await getPolicyDocument();
  const templates: AdminTemplateCatalogEntry[] = ALL_NOTICE_CARTRIDGES.map((notice) => {
    const contentDigest = getNoticeContentDigest(notice);
    const templatePolicy = policy.templates[notice.slug] || futureTemplate();
    const availability = policyToPublicEntry(notice, policy);
    return {
      slug: notice.slug, title: notice.title, category: notice.category, contentDigest,
      documentHeaderTitle: notice.documentHeaderTitle, reLineTemplate: notice.reLineTemplate,
      bodyParagraphs: notice.bodyParagraphs,
      fields: notice.fields.map((field) => ({ key: field.key, label: field.label, inputType: field.inputType,
        helperText: field.helperText, options: field.options, maxLength: field.maxLength })),
      policy: templatePolicy, availability,
      reviewCurrent: isReviewCurrent(templatePolicy, contentDigest),
    };
  });
  const history = await firestoreDb.collection(HISTORY_COLLECTION).doc(idForEnv(policy.environment)).get();
  const recentRows = Array.isArray((history.data() as any)?.entries) ? (history.data() as any).entries.slice(0, MAX_HISTORY) : [];
  return {
    policy, templates, canManage, complianceFooter: UPL_COMPLIANCE_FOOTER_TEXT('DS-000000'),
    recentChanges: recentRows.map((row: any) => ({
      auditId: String(row.auditId || ''), revision: Number(row.revision || 0), occurredAt: String(row.occurredAt || ''),
      actorId: String(row.actorId || ''), reason: String(row.reason || ''), action: String(row.action || ''), targetId: String(row.targetId || ''),
    })),
  };
}

export async function checkTemplateAvailability(slug: string, nexus: PolicyNexus): Promise<{ decision: AvailabilityDecision; revision: number; contentDigest: string }> {
  const policy = await getPolicyDocument();
  const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === slug);
  const decision = evaluatePolicy(policy, slug, nexus);
  return { decision, revision: policy.revision, contentDigest: notice ? getNoticeContentDigest(notice) : '' };
}

export async function createStagedDraftUnderPolicy<T extends Record<string, any>>(record: T, slug: string, nexus: PolicyNexus): Promise<{ ok: true; revision: number; contentDigest: string } | { ok: false; decision: AvailabilityDecision }> {
  const stageRef = firestoreDb.collection('staged_drafts_v1').doc(String(record.stageId));
  return firestoreDb.runTransaction(async (tx) => {
    const { ref, document } = await readPolicySnapshot(tx);
    const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === slug);
    const decision = evaluatePolicy(document, slug, nexus);
    if (!decision.allowed) return { ok: false as const, decision };
    const contentDigest = notice ? getNoticeContentDigest(notice) : '';
    const stored = sanitizeFirestoreData({ ...record, policyRevision: document.revision, templateContentDigest: contentDigest, policyNexus: nexus, policyDecisionAt: new Date().toISOString(), schemaVersion: 1, expiresAtMs: Date.parse(String(record.expiresAt)) });
    tx.set(stageRef, stored as any);
    // A read of the versioned policy document in this transaction establishes
    // the stage-vs-admin-update cutoff; a missing policy is intentionally implicit rev0.
    void ref;
    return { ok: true as const, revision: document.revision, contentDigest };
  });
}

export async function createOrderUnderPolicy<T extends Record<string, any>>(order: T, slug: string, nexus: PolicyNexus): Promise<{ ok: true; revision: number; contentDigest: string } | { ok: false; decision: AvailabilityDecision }> {
  const orderRef = firestoreDb.collection('orders').doc(String(order.id));
  return firestoreDb.runTransaction(async (tx) => {
    const { document } = await readPolicySnapshot(tx);
    const notice = ALL_NOTICE_CARTRIDGES.find((candidate) => candidate.slug === slug);
    const decision = evaluatePolicy(document, slug, nexus);
    if (!decision.allowed) return { ok: false as const, decision };
    const contentDigest = notice ? getNoticeContentDigest(notice) : '';
    const locked = sanitizeFirestoreData({ ...order, templatePolicyRevision: document.revision, templateContentDigest: contentDigest, policyNexus: nexus, policyDecisionAt: new Date().toISOString() });
    tx.create(orderRef, locked as any);
    return { ok: true as const, revision: document.revision, contentDigest };
  });
}

export async function commitTemplateMutation(actorId: string, input: TemplateMutation): Promise<{ revision: number; auditId: string; duplicate?: boolean }> {
  const environment = env();
  const canonicalDigest = sha256(stable(input));
  const requestKey = sha256(`${environment}:${actorId}:${input.requestId}`);
  const receiptRef = firestoreDb.collection(RECEIPT_COLLECTION).doc(requestKey);
  const auditRef = firestoreDb.collection(AUDIT_COLLECTION).doc(requestKey);
  const historyRef = firestoreDb.collection(HISTORY_COLLECTION).doc(idForEnv(environment));
  const happenedAt = new Date().toISOString();
  return firestoreDb.runTransaction(async (tx) => {
    const [{ ref: policyRef, document }, receiptSnap, historySnap] = await Promise.all([
      readPolicySnapshot(tx), tx.get(receiptRef), tx.get(historyRef),
    ]);
    if (receiptSnap.exists) {
      const receipt = receiptSnap.data() as any;
      if (receipt.payloadDigest !== canonicalDigest || receipt.actorId !== actorId) throw new Error('REQUEST_ID_CONFLICT');
      return { revision: Number(receipt.revision), auditId: String(receipt.auditId), duplicate: true };
    }
    if (document.revision !== input.expectedRevision) throw new Error('STALE_REVISION');
    const next = structuredClone(document);
    let action: string;
    let targetId: string;
    if (input.action === 'set_global') {
      next.global = input.global;
      action = 'set_global'; targetId = 'global';
    } else {
      const notice = ALL_NOTICE_CARTRIDGES.find((item) => item.slug === input.slug);
      if (!notice) throw new Error('UNKNOWN_TEMPLATE');
      const digest = getNoticeContentDigest(notice);
      if (digest !== input.expectedContentDigest) throw new Error('STALE_CONTENT_DIGEST');
      const existing = next.templates[input.slug] || futureTemplate();
      const review: TemplateReview = input.review ? {
        status: input.review.status, reviewer: input.review.reviewer, reviewedAt: happenedAt,
        reviewBy: input.review.reviewBy, evidenceUrl: input.review.evidenceUrl,
        notes: input.review.notes, contentDigest: digest,
      } : existing.review;
      if (input.review?.status === 'approved') {
        if (!input.review.reviewer.trim() || !input.review.evidenceUrl.trim() || !input.review.reviewBy || !validDate(input.review.reviewBy) || Date.parse(input.review.reviewBy) <= Date.now()) throw new Error('APPROVAL_REVIEW_INVALID');
        if (!validHttpUrl(input.review.evidenceUrl)) throw new Error('APPROVAL_EVIDENCE_INVALID');
      }
      if (input.review && input.review.status !== 'approved' && input.review.evidenceUrl && !validHttpUrl(input.review.evidenceUrl)) throw new Error('REVIEW_EVIDENCE_INVALID');
      next.templates[input.slug] = { ...input.settings, review };
      action = 'set_template'; targetId = input.slug;
    }
    next.revision += 1;
    next.updatedAt = happenedAt;
    next.updatedBy = actorId;
    const auditId = requestKey;
    const historyEntries = Array.isArray((historySnap.data() as any)?.entries) ? (historySnap.data() as any).entries : [];
    const summary = { auditId, revision: next.revision, occurredAt: happenedAt, actorId, reason: input.reason, action, targetId };
    tx.set(policyRef, sanitizeFirestoreData(next) as any);
    tx.create(auditRef, sanitizeFirestoreData({
      schemaVersion: 1, auditId, environment, actorId, occurredAt: happenedAt,
      action, targetId, reason: input.reason, revision: next.revision,
      before: document, after: next, payloadDigest: canonicalDigest,
    }) as any);
    tx.create(receiptRef, { schemaVersion: 1, requestId: input.requestId, actorId, environment, payloadDigest: canonicalDigest, revision: next.revision, auditId, occurredAt: happenedAt } as any);
    tx.set(historyRef, sanitizeFirestoreData({ schemaVersion: 1, environment, entries: [summary, ...historyEntries].slice(0, MAX_HISTORY) }) as any);
    return { revision: next.revision, auditId };
  });
}
