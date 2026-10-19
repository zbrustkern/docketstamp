'use client';

import { EventEnvelopeSchema } from '@/lib/admin-console/contracts';
import { readAttributionLedger } from './attribution';

const QUEUE_KEY = 'docketstamp_business_events_v1';
const MILESTONES_KEY = 'docketstamp_business_milestones_v1';
const MAX_QUEUE = 100;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const memoryQueue: Array<Record<string, unknown>> = [];
const memoryMilestones = new Map<string, Record<string, unknown>>();
let memorySessionId: string | undefined;
const memoryJourneys = new Map<string, string>();

function randomId(prefix: string): string {
  try { return `${prefix}_${crypto.randomUUID()}`; }
  catch { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`; }
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem('smn_telemetry_session');
    if (existing) return existing;
    const id = randomId('sess');
    sessionStorage.setItem('smn_telemetry_session', id);
    return id;
  } catch {
    return memorySessionId || (memorySessionId = randomId('sess'));
  }
}

function getJourneyId(noticeId?: string): string {
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

function readQueue(): Array<Record<string, unknown>> {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  } catch {
    return memoryQueue;
  }
}

function writeQueue(rows: Array<Record<string, unknown>>) {
  const bounded = rows.slice(-MAX_QUEUE);
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
  const sessionId = getOrCreateSessionId();
  const journeyId = getJourneyId(params.noticeId);
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
    ...(attribution ? { acquisition: { original: attribution.originalAcquisition, subsequentTouches: attribution.subsequentTouches } } : {}),
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
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const now = Date.now();
  let queue = readQueue().filter((row) => typeof row.queuedAt === 'number' && now - Number(row.queuedAt) <= MAX_AGE_MS);
  while (queue.length) {
    const item = queue[0];
    try {
      const response = await fetch('/api/telemetry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.envelope), keepalive: true,
      });
      if (response.status >= 500 || response.status === 429) break;
      const result = await response.json().catch(() => ({}));
      if (!response.ok && result.code !== 'CLOCK_SKEW' && result.code !== 'AUTOMATED_TRAFFIC') break;
      queue.shift();
      writeQueue(queue);
    } catch {
      break;
    }
  }
}

export function emitBusinessEvent(params: Parameters<typeof eventForMilestone>[0]): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope = eventForMilestone(params);
    const queue = readQueue();
    if (queue.some((item) => (item.envelope as { eventId?: string })?.eventId === envelope.eventId)) {
      void flushBusinessEventQueue();
      return;
    }
    queue.push({ envelope, queuedAt: Date.now() });
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
