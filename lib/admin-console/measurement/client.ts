'use client';

import { AttributionTouchSchema, EventEnvelopeSchema } from '@/lib/admin-console/contracts';
import { readAttributionLedger } from './attribution';

const QUEUE_KEY = 'docketstamp_business_events_v1';
const DEAD_LETTER_KEY = 'docketstamp_business_events_failed_v1';
const MILESTONES_KEY = 'docketstamp_business_milestones_v1';
const SESSION_KEY = 'docketstamp_telemetry_session_v1';
const LEGACY_SESSION_KEY = 'smn_telemetry_session';
const MAX_QUEUE = 100;
export const MAX_EVENT_BODY_BYTES = 3500;
const MAX_QUEUE_BYTES = 64 * 1024;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 8;
const memoryQueue: Array<Record<string, unknown>> = [];
const memoryMilestones = new Map<string, Record<string, unknown>>();
let memorySessionId: string | undefined;
const memoryJourneys = new Map<string, string>();
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

type QueueItem = { envelope: Record<string, unknown>; queuedAt: number; attempts?: number; nextAttemptAt?: number };

function byteLength(value: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length;
}

function compactTouch(value: unknown) {
  const parsed = AttributionTouchSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const touch = parsed.data;
  return AttributionTouchSchema.parse({
    touchId: touch.touchId,
    kind: touch.kind,
    observedAt: touch.observedAt,
    source: touch.source?.slice(0, 48),
    medium: touch.medium?.slice(0, 48),
    campaignId: touch.campaignId?.slice(0, 48),
    entrySurface: touch.entrySurface?.slice(0, 48),
    consent: touch.consent,
  });
}

/** Keep the first acquisition and one most recent touch, within the server byte limit. */
export function compactEventForTransport(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const candidate = input as Record<string, unknown>;
  const { acquisition: rawAcquisition, ...rawEvent } = candidate;
  const parsed = EventEnvelopeSchema.safeParse(rawEvent);
  if (!parsed.success) return null;
  const event = parsed.data as unknown as Record<string, unknown>;
  const acquisition = rawAcquisition && typeof rawAcquisition === 'object' && !Array.isArray(rawAcquisition)
    ? rawAcquisition as Record<string, unknown>
    : undefined;
  const original = compactTouch(acquisition?.original);
  const subsequent = Array.isArray(acquisition?.subsequentTouches)
    ? compactTouch(acquisition.subsequentTouches.at(-1))
    : undefined;
  let result: Record<string, unknown> = {
    ...event,
    ...(original ? { acquisition: { original, ...(subsequent ? { subsequentTouches: [subsequent] } : {}) } } : {}),
  };
  if (byteLength(JSON.stringify(result)) <= MAX_EVENT_BODY_BYTES) return result;
  if (result.acquisition) {
    result = { ...event, acquisition: { original } };
    if (byteLength(JSON.stringify(result)) <= MAX_EVENT_BODY_BYTES) return result;
  }
  result = event;
  return byteLength(JSON.stringify(result)) <= MAX_EVENT_BODY_BYTES ? result : null;
}

function normalizeQueueRows(rows: unknown[]): QueueItem[] {
  const now = Date.now();
  const valid: QueueItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const candidate = row as Record<string, unknown>;
    const queuedAt = Number(candidate.queuedAt);
    if (!Number.isFinite(queuedAt) || now - queuedAt > MAX_AGE_MS || queuedAt > now + 60_000) continue;
    const envelope = compactEventForTransport(candidate.envelope);
    if (!envelope) continue;
    valid.push({
      envelope,
      queuedAt,
      attempts: Number.isInteger(candidate.attempts) ? Math.max(0, Number(candidate.attempts)) : 0,
      nextAttemptAt: Number.isFinite(candidate.nextAttemptAt) ? Number(candidate.nextAttemptAt) : undefined,
    });
  }
  return valid;
}

function boundedQueue(rows: QueueItem[]): QueueItem[] {
  const kept: QueueItem[] = [];
  let bytes = 0;
  for (const item of rows.slice(-MAX_QUEUE).reverse()) {
    const size = byteLength(JSON.stringify(item));
    if (bytes + size > MAX_QUEUE_BYTES) continue;
    kept.push(item);
    bytes += size;
  }
  return kept.reverse();
}

function scheduleRetry(at: number) {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.max(0, Math.min(5 * 60_000, at - Date.now()));
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void flushBusinessEventQueue();
  }, delay);
}

function retryTime(response: Response | undefined, attempts: number): number {
  const exponential = Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
  const header = response?.headers.get('retry-after');
  const seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) * 1000 : NaN;
  return Date.now() + (Number.isFinite(seconds) ? Math.min(5 * 60_000, Math.max(exponential, seconds)) : exponential);
}

function quarantine(item: QueueItem, reason: string) {
  const row = {
    eventId: String(item.envelope.eventId || '').slice(0, 160),
    eventName: String(item.envelope.eventName || '').slice(0, 80),
    reason: reason.slice(0, 40),
    queuedAt: item.queuedAt,
    failedAt: Date.now(),
  };
  try {
    const raw = sessionStorage.getItem(DEAD_LETTER_KEY);
    const old = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(old) ? old.filter((entry) => entry && typeof entry === 'object') : [];
    sessionStorage.setItem(DEAD_LETTER_KEY, JSON.stringify([...rows, row].slice(-50)));
  } catch {
    // Keep the customer journey independent of browser storage availability.
  }
}

function randomId(prefix: string): string {
  try { return `${prefix}_${crypto.randomUUID()}`; }
  catch { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`; }
}

export function getBusinessSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (existing) {
      sessionStorage.setItem(SESSION_KEY, existing);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      return existing;
    }
    const id = randomId('sess');
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return memorySessionId || (memorySessionId = randomId('sess'));
  }
}

export function getBusinessJourneyId(noticeId?: string): string {
  const key = `docketstamp_journey_v1:${noticeId || 'unselected'}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = randomId('journey');
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    const existing = memoryJourneys.get(key);
    if (existing) return existing;
    const id = randomId('journey');
    memoryJourneys.set(key, id);
    return id;
  }
}

function readQueue(): QueueItem[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? normalizeQueueRows(rows) : [];
  } catch {
    return normalizeQueueRows(memoryQueue);
  }
}

function writeQueue(rows: QueueItem[]) {
  const bounded = boundedQueue(rows);
  try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(bounded)); }
  catch {
    memoryQueue.splice(0, memoryQueue.length, ...bounded);
  }
}

function runtimeEnvironment(): 'local' | 'staging' | 'production' {
  const configured = process.env.NEXT_PUBLIC_ENVIRONMENT;
  if (configured === 'staging' || configured === 'production') return configured;
  return process.env.NODE_ENV === 'production' ? 'production' : 'local';
}

function eventForMilestone(params: {
  eventName: string;
  noticeId?: string;
  tier?: string;
  entrySurface?: string;
  draftRevision?: number;
  checkoutAttemptId?: string;
  orderId?: string;
  correlationId?: string;
  safeProperties?: Record<string, string | number | boolean | null>;
  logicalKey?: string;
}) {
  const sessionId = getBusinessSessionId();
  const journeyId = getBusinessJourneyId(params.noticeId);
  const logicalKey = params.logicalKey || `${params.eventName}:${journeyId}:${params.draftRevision ?? 0}:${params.checkoutAttemptId || ''}`;
  const now = Date.now();
  let milestone: Record<string, unknown> | undefined;
  try {
    const raw = sessionStorage.getItem(MILESTONES_KEY);
    const entries = raw ? JSON.parse(raw) : {};
    if (entries && typeof entries === 'object') milestone = entries[logicalKey];
    if (milestone && typeof milestone.expiresAt === 'number' && milestone.expiresAt > now && milestone.envelope) {
      const storedEnvelope = milestone.envelope as Record<string, unknown>;
      const { acquisition, ...wireEnvelope } = storedEnvelope;
      return { ...EventEnvelopeSchema.parse(wireEnvelope), ...(acquisition ? { acquisition } : {}) };
    }
  } catch {
    milestone = memoryMilestones.get(logicalKey);
  }

  const occurredAt = new Date(now).toISOString();
  const contractEnvelope = EventEnvelopeSchema.parse({
    schemaVersion: 1,
    product: 'docketstamp',
    environment: runtimeEnvironment(),
    eventId: randomId('evt'),
    eventName: params.eventName,
    eventVersion: 1,
    occurredAt,
    receivedAt: occurredAt,
    emitter: 'client',
    sessionId,
    journeyId,
    draftRevision: params.draftRevision,
    checkoutAttemptId: params.checkoutAttemptId,
    orderId: params.orderId,
    correlationId: params.correlationId || randomId('corr'),
    noticeId: params.noticeId,
    tier: params.tier,
    entrySurface: params.entrySurface,
    safeProperties: params.safeProperties || {},
  });

  const attribution = readAttributionLedger();
  const envelope = {
    ...contractEnvelope,
    ...(attribution ? { acquisition: { original: attribution.originalAcquisition, subsequentTouches: attribution.subsequentTouches.slice(-1) } } : {}),
  };
  const record = { envelope, expiresAt: now + MAX_AGE_MS };
  try {
    const raw = sessionStorage.getItem(MILESTONES_KEY);
    const entries = raw && typeof JSON.parse(raw) === 'object' ? JSON.parse(raw) : {};
    entries[logicalKey] = record;
    const keys = Object.keys(entries);
    for (const key of keys.slice(0, Math.max(0, keys.length - 1000))) delete entries[key];
    sessionStorage.setItem(MILESTONES_KEY, JSON.stringify(entries));
  } catch {
    memoryMilestones.set(logicalKey, record);
  }
  return envelope;
}

export async function flushBusinessEventQueue(): Promise<void> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.onLine || flushing) return;
  flushing = true;
  try {
    writeQueue(readQueue());
    while (true) {
      // Events can be enqueued while fetch is pending. Always start from the
      // current persisted queue so completing an older request cannot replace
      // newer milestones with the stale snapshot captured before the await.
      const queue = readQueue();
      if (!queue.length) break;
      const now = Date.now();
      const index = queue.findIndex((row) => !row.nextAttemptAt || row.nextAttemptAt <= now);
      if (index < 0) {
        const next = Math.min(...queue.map((row) => row.nextAttemptAt || now));
        scheduleRetry(next);
        break;
      }
      const item = queue[index];
      const eventId = String(item.envelope.eventId || '');
      let response: Response | undefined;
      try {
        const body = JSON.stringify(item.envelope);
        if (byteLength(body) > MAX_EVENT_BODY_BYTES) {
          writeQueue(readQueue().filter((row) => String(row.envelope.eventId || '') !== eventId));
          continue;
        }
        response = await fetch('/api/telemetry', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
        });
      } catch {
        const latest = readQueue();
        const current = latest.find((row) => String(row.envelope.eventId || '') === eventId);
        if (!current) continue;
        current.attempts = (current.attempts || 0) + 1;
        if (current.attempts >= MAX_RETRY_ATTEMPTS) {
          quarantine(current, 'retry_limit_network');
          writeQueue(latest.filter((row) => String(row.envelope.eventId || '') !== eventId));
        }
        else {
          current.nextAttemptAt = retryTime(undefined, current.attempts);
          writeQueue(latest);
          scheduleRetry(current.nextAttemptAt);
        }
        break;
      }

      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        const latest = readQueue();
        const current = latest.find((row) => String(row.envelope.eventId || '') === eventId);
        if (!current) continue;
        current.attempts = (current.attempts || 0) + 1;
        if (current.attempts >= MAX_RETRY_ATTEMPTS) {
          quarantine(current, `retry_limit_${response.status}`);
          writeQueue(latest.filter((row) => String(row.envelope.eventId || '') !== eventId));
        }
        else {
          current.nextAttemptAt = retryTime(response, current.attempts);
          writeQueue(latest);
          scheduleRetry(current.nextAttemptAt);
        }
        break;
      }

      // Keep a small, payload-free record and drop permanent rejects so one
      // malformed legacy item cannot hold up later valid events.
      if (!response.ok) quarantine(item, `http_${response.status}`);
      writeQueue(readQueue().filter((row) => String(row.envelope.eventId || '') !== eventId));
    }
  } finally {
    flushing = false;
  }
}

export function emitBusinessEvent(params: Parameters<typeof eventForMilestone>[0]): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope = compactEventForTransport(eventForMilestone(params));
    if (!envelope) return;
    const queue = readQueue();
    if (queue.some((item) => (item.envelope as { eventId?: string })?.eventId === envelope.eventId)) {
      void flushBusinessEventQueue();
      return;
    }
    queue.push({ envelope, queuedAt: Date.now(), attempts: 0 });
    writeQueue(queue);
    void flushBusinessEventQueue();
  } catch {
    // Analytics is non-authoritative and cannot block the customer journey.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flushBusinessEventQueue(); });
  window.addEventListener('pageshow', () => { void flushBusinessEventQueue(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushBusinessEventQueue();
  });
}
