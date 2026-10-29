import test from 'node:test';
import assert from 'node:assert/strict';
import { compactEventForTransport, MAX_EVENT_BODY_BYTES, flushBusinessEventQueue } from '@/lib/admin-console/measurement/client';

const storageKey = 'docketstamp_business_events_v1';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function event(eventId: string, acquisition?: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    product: 'docketstamp',
    environment: 'staging',
    eventId,
    eventName: 'entry_viewed',
    eventVersion: 1,
    occurredAt: '2026-10-29T12:00:00.000Z',
    receivedAt: '2026-10-29T12:00:00.000Z',
    emitter: 'client',
    sessionId: 'session_fixture',
    journeyId: 'journey_fixture',
    correlationId: 'correlation_fixture',
    entrySurface: 'home',
    safeProperties: {},
    ...(acquisition ? { acquisition } : {}),
  };
}

function touch(touchId: string, kind: 'acquisition' | 'recovery', campaignId: string) {
  return {
    touchId, kind, observedAt: '2026-10-29T12:00:00.000Z', source: 'google',
    medium: 'cpc', campaignId, entrySurface: 'home', consent: 'unknown',
  };
}

test('transport keeps the original and latest acquisition touch, with a bounded body', () => {
  const touches = Array.from({ length: 20 }, (_, index) => touch(`touch_${index}`, index === 0 ? 'acquisition' : 'recovery', `campaign_${index}`));
  const compact = compactEventForTransport(event('event_compact', {
    original: touches[0], subsequentTouches: touches.slice(1),
  }));
  assert.ok(compact);
  const acquisition = compact.acquisition as { original: { touchId: string }; subsequentTouches: Array<{ touchId: string }> };
  assert.equal(acquisition.original.touchId, 'touch_0');
  assert.deepEqual(acquisition.subsequentTouches.map((row) => row.touchId), ['touch_19']);
  assert.ok(new TextEncoder().encode(JSON.stringify(compact)).length <= MAX_EVENT_BODY_BYTES);
});

test('a permanent oversized-item response is removed and does not block the next valid event', async () => {
  const session = new MemoryStorage();
  const listeners: Array<() => void> = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener: (_name: string, listener: () => void) => listeners.push(listener) } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener: () => {}, visibilityState: 'visible' } });
  const sent: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(String(init?.body || ''));
    return new Response('', { status: sent.length === 1 ? 413 : 201 });
  }) as typeof fetch;
  try {
    const oversizedLegacy = event('event_oversized', {
      original: touch('touch_original', 'acquisition', 'campaign'),
      subsequentTouches: Array.from({ length: 20 }, (_, index) => touch(`touch_${index}`, 'recovery', `campaign_${index}`)),
    });
    const valid = event('event_after_poison');
    session.setItem(storageKey, JSON.stringify([
      { envelope: oversizedLegacy, queuedAt: Date.now(), attempts: 0 },
      { envelope: valid, queuedAt: Date.now(), attempts: 0 },
    ]));

    await flushBusinessEventQueue();

    assert.equal(sent.length, 2);
    assert.equal(JSON.parse(sent[0]).eventId, 'event_oversized');
    assert.equal(JSON.parse(sent[1]).eventId, 'event_after_poison');
    assert.deepEqual(JSON.parse(session.getItem(storageKey) || '[]'), []);
    const rejected = JSON.parse(session.getItem('docketstamp_business_events_failed_v1') || '[]');
    assert.deepEqual(rejected.map((row: { eventId: string; reason: string }) => [row.eventId, row.reason]), [['event_oversized', 'http_413']]);
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).sessionStorage;
    delete (globalThis as Record<string, unknown>).navigator;
    delete (globalThis as Record<string, unknown>).document;
  }
});
