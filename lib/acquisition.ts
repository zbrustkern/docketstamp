import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export const FIRST_TOUCH_MS = 30 * 86400000;
export const CLICK_EVIDENCE_MS = 7 * 86400000;
export const PILOT_CAMPAIGN = 'ds_search_deposit_demand_pilot_01';
export const PILOT_KEY = `google:cpc:${PILOT_CAMPAIGN}`;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const instant = z.string().datetime();
const reason = z.enum(['campaign_missing', 'campaign_unrecognized', 'invalid_parameters', 'conflicting_parameters', 'entry_not_observed', 'storage_unavailable', 'expired', 'session_mismatch', 'legacy_role_unknown']);
export const ClickEvidenceSchema = z.object({
  type: z.enum(['gclid', 'gbraid', 'wbraid']), digest: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: instant,
});
export const AcquisitionTouchSchema = z.object({
  touchId: id, sessionId: id, observedAt: instant,
  source: z.enum(['google', 'bing', 'meta', 'direct', 'referral', 'unknown']),
  medium: z.enum(['cpc', 'organic', 'social', 'referral', 'none', 'unknown']),
  campaignId: z.literal(PILOT_CAMPAIGN).optional(),
  platformCampaignId: z.literal('24457739017').optional(),
  creativeId: z.string().regex(/^\d{1,24}$/).optional(),
  entrySurface: z.enum(['home', 'notice_workspace', 'company_directory', 'notice_directory', 'public_information']),
  evidence: z.enum(['campaign_parameters', 'click_identifier', 'referrer', 'no_referrer', 'unknown']),
  issues: z.array(reason).max(9),
  clicks: z.array(ClickEvidenceSchema).max(3),
});
export const AcquisitionSnapshotSchema = z.object({
  schemaVersion: z.literal(2), firstObserved: AcquisitionTouchSchema.nullable(), currentSession: AcquisitionTouchSchema.nullable(),
  persistence: z.enum(['persistent', 'session_only', 'memory_only', 'unavailable']),
  missingReasons: z.array(reason).max(9),
});
export type AcquisitionTouch = z.infer<typeof AcquisitionTouchSchema>;
export type AcquisitionSnapshot = z.infer<typeof AcquisitionSnapshotSchema>;
export type RawClick = { type: 'gclid' | 'gbraid' | 'wbraid'; value: string; observedAt: string; expiresAt: string };
export const clickDigest = (value: string) => bytesToHex(sha256(value));

export function acquisitionSurface(path: string): AcquisitionTouch['entrySurface'] | null {
  if (path === '/') return 'home';
  if (path.startsWith('/notices/')) return 'notice_workspace';
  if (path === '/companies') return 'company_directory';
  if (path === '/letters') return 'notice_directory';
  if (path === '/pricing' || path === '/how-it-works') return 'public_information';
  return null;
}

/** Only the reviewed pilot label is accepted. Unknown labels are never stored as free text. */
export function observeAcquisition(input: { search: string; referrer?: string; origin: string; sessionId: string; surface: AcquisitionTouch['entrySurface']; now: number; touchId: string; restricted?: boolean }) {
  const params = new URLSearchParams(input.search);
  const issues: AcquisitionTouch['issues'] = [];
  const get = (key: string) => {
    const values = params.getAll(key);
    if (values.length > 1) { issues.push('conflicting_parameters'); return undefined; }
    const value = values[0];
    if (value !== undefined && (!value || value.length > 255 || !/^[A-Za-z0-9_.~-]+$/.test(value))) { issues.push('invalid_parameters'); return undefined; }
    return value;
  };
  const rawSource = get('utm_source'), rawMedium = get('utm_medium'), campaign = get('utm_campaign'), creative = get('utm_content');
  const rawClicks: RawClick[] = [];
  for (const type of ['gclid', 'gbraid', 'wbraid'] as const) {
    const value = get(type);
    if (value && !input.restricted) rawClicks.push({ type, value, observedAt: new Date(input.now).toISOString(), expiresAt: new Date(input.now + CLICK_EVIDENCE_MS).toISOString() });
  }
  let source: AcquisitionTouch['source'] = 'unknown', medium: AcquisitionTouch['medium'] = 'unknown';
  let evidence: AcquisitionTouch['evidence'] = 'unknown';
  const hasParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid'].some(key => params.has(key));
  if (hasParams) {
    source = rawSource === 'google' || rawSource === 'bing' || rawSource === 'meta' ? rawSource : rawClicks.length ? 'google' : 'unknown';
    medium = rawMedium === 'cpc' || rawMedium === 'organic' || rawMedium === 'social' ? rawMedium : rawClicks.length ? 'cpc' : 'unknown';
    evidence = rawSource || campaign ? 'campaign_parameters' : rawClicks.length ? 'click_identifier' : 'unknown';
    if (campaign && campaign !== PILOT_CAMPAIGN) issues.push('campaign_unrecognized');
    if (medium === 'cpc' && !campaign) issues.push('campaign_missing');
    if (source === 'unknown' || medium === 'unknown' || (rawClicks.length && (source !== 'google' || medium !== 'cpc'))) issues.push('conflicting_parameters');
  } else if (input.referrer) {
    try {
      const ref = new URL(input.referrer);
      const host = ref.hostname.toLowerCase();
      if (ref.origin === input.origin) return { touch: null, rawClicks: [] };
      source = /(^|\.)google\.[a-z.]+$/.test(host) ? 'google' : /(^|\.)bing\.com$/.test(host) ? 'bing' : 'referral';
      medium = source === 'referral' ? 'referral' : 'organic'; evidence = 'referrer';
    } catch { issues.push('invalid_parameters'); }
  } else { source = 'direct'; medium = 'none'; evidence = 'no_referrer'; }
  if (issues.includes('conflicting_parameters') || issues.includes('invalid_parameters')) { source = 'unknown'; medium = 'unknown'; }
  const knownCampaign = source === 'google' && medium === 'cpc' && campaign === PILOT_CAMPAIGN;
  const touch: AcquisitionTouch = {
    touchId: input.touchId, sessionId: input.sessionId, observedAt: new Date(input.now).toISOString(), source, medium,
    ...(knownCampaign ? { campaignId: PILOT_CAMPAIGN, platformCampaignId: '24457739017' as const } : {}),
    ...(creative && /^\d{1,24}$/.test(creative) ? { creativeId: creative } : {}),
    entrySurface: input.surface, evidence, issues: [...new Set(issues)],
    clicks: rawClicks.map(({type,value,expiresAt}) => ({type,digest:clickDigest(value),expiresAt})),
  };
  return { touch, rawClicks };
}

/** This is an observation, never payment authority or an advertising-consent grant. */
export function sanitizeAcquisition(raw: unknown, sessionId?: string, now = Date.now()): AcquisitionSnapshot {
  const parsed = AcquisitionSnapshotSchema.safeParse(raw);
  if (!parsed.success) return { schemaVersion: 2, firstObserved: null, currentSession: null, persistence: 'unavailable', missingReasons: [raw ? 'invalid_parameters' : 'entry_not_observed'] };
  const result = parsed.data;
  for (const role of ['firstObserved', 'currentSession'] as const) {
    const touch = result[role];
    if (!touch) continue;
    const at = Date.parse(touch.observedAt);
    if (at > now + 300000 || at < now - FIRST_TOUCH_MS) { result[role] = null; result.missingReasons.push('expired'); continue; }
    if (role === 'currentSession' && sessionId !== undefined && touch.sessionId !== sessionId) { result[role] = null; result.missingReasons.push('session_mismatch'); continue; }
    // Re-derive registry fields; a client-supplied platform ID is not independent verification.
    if (touch.source !== 'google' || touch.medium !== 'cpc') { delete touch.campaignId; delete touch.platformCampaignId; }
    else if (touch.campaignId === PILOT_CAMPAIGN) touch.platformCampaignId = '24457739017';
    else { delete touch.platformCampaignId; touch.issues = [...new Set([...touch.issues, 'campaign_missing' as const])]; }
    touch.clicks = touch.clicks.filter(c => Date.parse(c.expiresAt) > now && Date.parse(c.expiresAt) <= at + CLICK_EVIDENCE_MS);
  }
  result.missingReasons = [...new Set(result.missingReasons)];
  return result;
}

export function sanitizeRawClicks(raw: unknown, snapshot: AcquisitionSnapshot, now: number): RawClick[] {
  if (!Array.isArray(raw)) return [];
  const evidence = [snapshot.firstObserved, snapshot.currentSession].flatMap(t => t?.clicks || []);
  return raw.slice(0, 6).flatMap(c => {
    if (!c || !['gclid','gbraid','wbraid'].includes(c.type) || typeof c.value !== 'string' || !/^[A-Za-z0-9_.~-]{1,255}$/.test(c.value)) return [];
    const match = evidence.find(e => e.type === c.type && e.digest === clickDigest(c.value) && e.expiresAt === c.expiresAt);
    const at = Date.parse(c.observedAt);
    return match && Number.isFinite(at) && at <= now + 300000 && Date.parse(match.expiresAt) <= at + CLICK_EVIDENCE_MS && Date.parse(match.expiresAt) > now
      ? [{ type: c.type, value: c.value, observedAt: new Date(at).toISOString(), expiresAt: match.expiresAt }] : [];
  });
}

export function acquisitionKey(touch?: Pick<AcquisitionTouch, 'source' | 'medium' | 'campaignId'> | null): string {
  if (!touch || touch.source === 'unknown') return 'unknown';
  return touch.campaignId ? `${touch.source}:${touch.medium}:${touch.campaignId}` : touch.medium === 'cpc' ? `${touch.source}:cpc:unknown` : touch.source;
}
