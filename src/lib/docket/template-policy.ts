/** Browser-safe contract and deterministic availability evaluator. Keep this file
 * free of server-only imports so client gates and server enforcement agree. */
export type GeoRule = { mode: 'all' | 'allowlist' | 'blocklist'; states: string[] };
export type ReviewStatus = 'unreviewed' | 'in_review' | 'approved' | 'hold';
export type TemplateSource = {
  kind: 'original' | 'official_sample' | 'official_guidance';
  title: string; url: string; jurisdiction: string; retrievedAt: string;
  reuseStatus: 'unverified' | 'permitted' | 'restricted'; notes: string;
};
export type TemplateReview = {
  status: ReviewStatus; reviewer: string; reviewedAt: string | null;
  reviewBy: string | null; evidenceUrl: string; notes: string;
  contentDigest: string | null;
};
export type TemplateSettings = {
  enabled: boolean; requireCurrentReview: boolean;
  residence: GeoRule; property: GeoRule; sources: TemplateSource[];
};
export type TemplatePolicy = TemplateSettings & { review: TemplateReview };
export type GlobalTemplatePolicy = {
  enabled: boolean; requireCurrentReview: boolean;
  residence: GeoRule; property: GeoRule;
};
export type TemplatePolicyDocument = {
  schemaVersion: 1; revision: number; environment: 'local'|'staging'|'production';
  global: GlobalTemplatePolicy; templates: Record<string, TemplatePolicy>;
  updatedAt: string | null; updatedBy: string | null;
};
export type PolicyNexus = { consumerResidenceState?: string; propertyState?: string };
export type PublicTemplateAvailability = {
  slug: string; title: string; category: string; contentDigest: string;
  available: boolean; reasonCode: string | null; reason: string | null;
  requiresResidence: boolean; requiresProperty: boolean;
  residenceRules: GeoRule[]; propertyRules: GeoRule[];
};
export type AvailabilityDecision = {
  allowed: boolean; code: string; message: string; requiredFields: string[];
};
export type PublicAvailabilityResponse = { revision: number; templates: PublicTemplateAvailability[] };
export type AdminTemplateCatalogEntry = {
  slug: string; title: string; category: string; contentDigest: string;
  documentHeaderTitle: string; reLineTemplate: string; bodyParagraphs: string[];
  fields: { key: string; label: string; inputType: string; helperText?: string; options?: {label:string;value:string}[]; maxLength?:number }[];
  policy: TemplatePolicy; availability: PublicTemplateAvailability;
  reviewCurrent: boolean;
};
export type TemplateAuditSummary = {
  auditId: string; revision: number; occurredAt: string; actorId: string;
  reason: string; action: string; targetId: string;
};
export type AdminTemplatesResponse = {
  policy: TemplatePolicyDocument; templates: AdminTemplateCatalogEntry[];
  canManage: boolean; complianceFooter: string; recentChanges: TemplateAuditSummary[];
};

export const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
] as const;
const STATE_SET = new Set<string>(US_STATE_CODES);
const ALLOWED_MESSAGE = 'This notice is currently available for the information provided.';
const UNAVAILABLE_MESSAGE = 'This notice is not currently available.';
const LOCATION_MESSAGE = 'Choose the state where you live to check availability.';
const PROPERTY_MESSAGE = 'Choose the state where the property is located to check availability.';

function cleanState(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return '__INVALID__';
  if (value.trim() === '') return null;
  const normalized = value.trim().toUpperCase();
  return STATE_SET.has(normalized) ? normalized : '__INVALID__';
}

function ruleNeedsState(rule: GeoRule): boolean {
  return rule.mode !== 'all' && rule.states.length > 0;
}

function evaluateRules(rules: GeoRule[], value: string | undefined, field: string): AvailabilityDecision | null {
  const state = cleanState(value);
  if (state === '__INVALID__') {
    return { allowed: false, code: 'INVALID_LOCATION', message: field === 'consumerResidenceState' ? LOCATION_MESSAGE : PROPERTY_MESSAGE, requiredFields: [field] };
  }
  if (rules.some((rule) => rule.mode === 'allowlist' && rule.states.length === 0)) {
    return { allowed: false, code: 'LOCATION_UNAVAILABLE', message: UNAVAILABLE_MESSAGE, requiredFields: [] };
  }
  const relevant = rules.filter(ruleNeedsState);
  if (relevant.length === 0) return null;
  if (!state) {
    return { allowed: false, code: 'LOCATION_REQUIRED', message: field === 'consumerResidenceState' ? LOCATION_MESSAGE : PROPERTY_MESSAGE, requiredFields: [field] };
  }
  for (const rule of relevant) {
    const contains = rule.states.includes(state);
    if ((rule.mode === 'allowlist' && !contains) || (rule.mode === 'blocklist' && contains)) {
      return { allowed: false, code: 'LOCATION_UNAVAILABLE', message: UNAVAILABLE_MESSAGE, requiredFields: [] };
    }
  }
  return null;
}

export function evaluateTemplateAvailability(entry: PublicTemplateAvailability, nexus: PolicyNexus): AvailabilityDecision {
  if (!entry.available) {
    return { allowed: false, code: entry.reasonCode || 'TEMPLATE_UNAVAILABLE', message: entry.reason || UNAVAILABLE_MESSAGE, requiredFields: [] };
  }
  const residence = evaluateRules(entry.residenceRules, nexus.consumerResidenceState, 'consumerResidenceState');
  const property = entry.propertyRules.length
    ? evaluateRules(entry.propertyRules, nexus.propertyState, 'propertyState')
    : null;
  const invalid = [residence, property].filter((item) => item?.code === 'INVALID_LOCATION') as AvailabilityDecision[];
  if (invalid.length) return { ...invalid[0], requiredFields: invalid.flatMap((item) => item.requiredFields) };
  const missing = [residence, property].filter((item) => item?.code === 'LOCATION_REQUIRED') as AvailabilityDecision[];
  if (missing.length) return { ...missing[0], requiredFields: missing.flatMap((item) => item.requiredFields) };
  if (residence) return residence;
  if (property) return property;
  return { allowed: true, code: 'AVAILABLE', message: ALLOWED_MESSAGE, requiredFields: [] };
}
