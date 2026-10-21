import { US_STATE_CODES, type PublicAvailabilityResponse, type PublicTemplateAvailability, type GeoRule } from './template-policy';

const supportedStates = new Set<string>(US_STATE_CODES);

function isRule(value: unknown): value is GeoRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as GeoRule;
  return ['all', 'allowlist', 'blocklist'].includes(rule.mode) && Array.isArray(rule.states) &&
    rule.states.length <= 51 && rule.states.every(state => supportedStates.has(state)) &&
    new Set(rule.states).size === rule.states.length && (rule.mode !== 'all' || rule.states.length === 0);
}

export function isPublicAvailability(value: unknown): value is PublicAvailabilityResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as PublicAvailabilityResponse;
  return Number.isSafeInteger(data.revision) && data.revision >= 0 && Array.isArray(data.templates) && data.templates.every((item: PublicTemplateAvailability) =>
    item && typeof item.slug === 'string' && typeof item.title === 'string' && typeof item.category === 'string' &&
    typeof item.contentDigest === 'string' && /^[a-f0-9]{64}$/.test(item.contentDigest) && typeof item.available === 'boolean' &&
    (item.reason === null || typeof item.reason === 'string') && (item.reasonCode === null || typeof item.reasonCode === 'string') &&
    typeof item.requiresResidence === 'boolean' && typeof item.requiresProperty === 'boolean' &&
    Array.isArray(item.residenceRules) && item.residenceRules.every(isRule) && Array.isArray(item.propertyRules) && item.propertyRules.every(isRule));
}

export async function fetchTemplateAvailability(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<PublicAvailabilityResponse> {
  const response = await fetchImpl('/api/docket/availability', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('We couldn’t check letter availability. Please try again.');
  const data: unknown = await response.json();
  if (!isPublicAvailability(data)) throw new Error('We couldn’t check letter availability. Please try again.');
  return data;
}
