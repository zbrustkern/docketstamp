'use client';
import { acquisitionSurface, observeAcquisition, sanitizeAcquisition, sanitizeRawClicks, type AcquisitionSnapshot, type RawClick } from './acquisition';
import { getBusinessSessionId } from './admin-console/measurement/session';

export const FIRST_KEY = 'docketstamp_first_touch_v2';
export const CURRENT_KEY = 'docketstamp_current_touch_v2';
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
  try { return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || localStorage.getItem('docketstamp_marketing_consent_v1') === 'denied'; } catch { return true; }
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
