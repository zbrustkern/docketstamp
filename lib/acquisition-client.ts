'use client';
import { acquisitionSurface, observeAcquisition, sanitizeAcquisition, sanitizeRawClicks, type AcquisitionSnapshot, type RawClick } from './acquisition';
import { getBusinessSessionId } from './admin-console/measurement/session';

export const FIRST_KEY = 'docketstamp_first_touch_v2';
export const CURRENT_KEY = 'docketstamp_current_touch_v2';
export const GOOGLE_MEASUREMENT_DENIED_KEY = 'docketstamp_google_measurement_denied_v1';
export const GOOGLE_OFFLINE_PREFERENCE_KEY = 'docketstamp_google_offline_preference_set_v1';
export function clearStoredAcquisitionEvidence(blockFutureCapture = false): void {
  const clearRaw = (stored: Stored | null): Stored | null => stored ? {
    snapshot: { ...stored.snapshot, firstObserved: stored.snapshot.firstObserved ? { ...stored.snapshot.firstObserved, clicks: [] } : null, currentSession: stored.snapshot.currentSession ? { ...stored.snapshot.currentSession, clicks: [] } : null },
    rawClicks: [],
  } : null;
  memory = clearRaw(memory);
  try {
    const first = clearRaw(read(FIRST_KEY, true));
    if (first) localStorage.setItem(FIRST_KEY, JSON.stringify(first));
    if (blockFutureCapture) {
      localStorage.setItem(GOOGLE_MEASUREMENT_DENIED_KEY, '1');
      localStorage.setItem(GOOGLE_OFFLINE_PREFERENCE_KEY, '1');
    }
  } catch { /* storage denial is fail-closed in restricted() */ }
  try {
    const current = clearRaw(read(CURRENT_KEY));
    if (current) sessionStorage.setItem(CURRENT_KEY, JSON.stringify(current));
  } catch { /* storage denial is fail-closed */ }
}
export function allowFutureAcquisitionEvidence(): void {
  try { localStorage.removeItem(GOOGLE_MEASUREMENT_DENIED_KEY); } catch { /* storage denial remains fail-closed */ }
}
export function markGoogleOfflinePreferenceExists(): void {
  try { localStorage.setItem(GOOGLE_OFFLINE_PREFERENCE_KEY, '1'); } catch { /* storage denial remains fail-closed */ }
}
type Stored = { snapshot: AcquisitionSnapshot; rawClicks: RawClick[] };
let memory: Stored | null = null;
let observedDocument = false;
let activeDocument: Document | undefined;
function selectDocument() {
  if (activeDocument !== document) { activeDocument = document; observedDocument = false; memory = null; }
}
function read(key: string, local = false): Stored | null {
  try { const raw = (local ? localStorage : sessionStorage).getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key: string, value: Stored, local = false) {
  try { (local ? localStorage : sessionStorage).setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function restricted() {
  try { return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || localStorage.getItem('docketstamp_marketing_consent_v1') === 'denied' || localStorage.getItem(GOOGLE_MEASUREMENT_DENIED_KEY) === '1'; } catch { return true; }
}

export function readCurrentAcquisition(): Stored {
  selectDocument();
  const sessionId = getBusinessSessionId();
  const stored = read(CURRENT_KEY) || memory;
  const snapshot = sanitizeAcquisition(stored?.snapshot, sessionId);
  const rawClicks = restricted() ? [] : sanitizeRawClicks(stored?.rawClicks, snapshot, Date.now());
  if (restricted()) for (const touch of [snapshot.firstObserved, snapshot.currentSession]) if (touch) touch.clicks = [];
  const result = { snapshot, rawClicks };
  if (stored) { memory = result; write(CURRENT_KEY, result); }
  return result;
}

/** Capture before checkout. Never keep raw paths or referrers. */
export function captureCurrentAcquisition(): Stored {
  selectDocument();
  const path = window.location.pathname;
  const surface = acquisitionSurface(path);
  if (!surface) return readCurrentAcquisition();
  const now = Date.now();
  let sessionId = getBusinessSessionId();
  const prior = read(CURRENT_KEY) || memory;
  const priorSnapshot = sanitizeAcquisition(prior?.snapshot, sessionId, now);
  const firstStore = read(FIRST_KEY, true);
  const first = sanitizeAcquisition(firstStore?.snapshot, undefined, now).firstObserved || priorSnapshot.firstObserved;
  const observation = observeAcquisition({ search: window.location.search, referrer: observedDocument ? undefined : document.referrer, origin: window.location.origin, sessionId, surface, now, touchId: `touch_${crypto.randomUUID()}`, restricted: restricted() });
  const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const isNewArrival = !observedDocument && navigation?.type !== 'reload' && navigation?.type !== 'back_forward';
  const sameEvidence = (a: typeof observation.touch, b: typeof observation.touch) => JSON.stringify(a && [a.source,a.medium,a.campaignId,a.creativeId,a.clicks.map(c=>c.digest)]) === JSON.stringify(b && [b.source,b.medium,b.campaignId,b.creativeId,b.clicks.map(c=>c.digest)]);
  const explicitCampaign = observation.touch?.evidence === 'campaign_parameters' || observation.touch?.evidence === 'click_identifier';
  let current = priorSnapshot.currentSession;
  if (current && observation.touch && !sameEvidence(current, observation.touch) && (isNewArrival || explicitCampaign)) {
    sessionId = getBusinessSessionId(true);
    current = null;
  }
  if (!current) current = observation.touch ? { ...observation.touch, sessionId } : null;
  observedDocument = true;
  const snapshot: AcquisitionSnapshot = {
    schemaVersion: 2, firstObserved: first || current, currentSession: current,
    persistence: 'persistent', missingReasons: current ? [] : ['entry_not_observed'],
  };
  const retained = [prior?.rawClicks, firstStore?.rawClicks].flatMap(value => Array.isArray(value) ? value : []).filter(c => c && typeof c === 'object');
  const candidates = [...new Map([...observation.rawClicks, ...retained].map(c => [`${c.type}:${c.value}`, c])).values()];
  const rawClicks = restricted() ? [] : sanitizeRawClicks(candidates, snapshot, now);
  const unique = [...new Map(rawClicks.map(c => [`${c.type}:${c.value}`, c])).values()];
  const result = { snapshot, rawClicks: unique };
  if (restricted()) for (const touch of [snapshot.firstObserved, snapshot.currentSession]) if (touch) touch.clicks = [];
  const firstResult = { snapshot: { ...snapshot, currentSession: null }, rawClicks: sanitizeRawClicks(unique, { ...snapshot, currentSession: null }, now) };
  const localOk = write(FIRST_KEY, firstResult, true);
  const sessionOk = write(CURRENT_KEY, result);
  snapshot.persistence = localOk && sessionOk ? 'persistent' : sessionOk ? 'session_only' : 'memory_only';
  if (!localOk || !sessionOk) snapshot.missingReasons.push('storage_unavailable');
  memory = result;
  write(CURRENT_KEY, result);
  return result;
}
