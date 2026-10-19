import crypto from 'node:crypto';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { EventEnvelopeSchema, AttributionTouchSchema, DiagnosticSchema } from '@/lib/admin-console/contracts';

export type BusinessEvent = ReturnType<typeof EventEnvelopeSchema.parse>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function eventDigest(event: BusinessEvent): string {
  const { receivedAt: _receivedAt, requestId: _requestId, ...logicalEvent } = event;
  return crypto.createHash('sha256').update(stableJson(logicalEvent)).digest('hex');
}

export async function acceptBusinessEvent(
  input: BusinessEvent,
  context: {
    classification: { primary: 'customer' | 'founder' | 'employee' | 'automated_test' | 'comp' | 'free_promo' | 'suspected_bot' | 'unresolved'; evidenceClass: 'observed' | 'inferred'; policyVersion: 1; evidenceRef: string };
    acquisition?: { original?: unknown; subsequentTouches?: unknown[] };
  },
): Promise<'accepted' | 'duplicate' | 'conflict'> {
  const event = EventEnvelopeSchema.parse(input);
  const digest = eventDigest(event);
  const acquisition = context.acquisition ? {
    original: context.acquisition.original ? AttributionTouchSchema.parse(context.acquisition.original) : undefined,
    subsequentTouches: (context.acquisition.subsequentTouches || []).slice(-20).map((touch) => AttributionTouchSchema.parse(touch)),
  } : undefined;
  const ref = firestoreDb.collection('business_events_v1').doc(event.eventId);
  return firestoreDb.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      return existing.data()?.logicalDigest === digest ? 'duplicate' : 'conflict';
    }
    tx.set(ref, sanitizeFirestoreData({ ...event, logicalDigest: digest, classification: context.classification, acquisition }));
    return 'accepted';
  });
}

export async function recordServerBusinessEvent(params: {
  eventName: string;
  idempotencyKey?: string;
  sessionId?: string;
  journeyId?: string;
  noticeId?: string;
  orderId?: string;
  correlationId?: string;
  safeProperties?: Record<string, string | number | boolean | null>;
  classification?: 'automated_test' | 'unresolved';
}): Promise<'accepted' | 'duplicate' | 'conflict'> {
  const now = new Date().toISOString();
  const event = EventEnvelopeSchema.parse({
    schemaVersion: 1,
    product: 'docketstamp',
    environment: process.env.ENVIRONMENT === 'staging' ? 'staging' : process.env.NODE_ENV === 'production' ? 'production' : 'local',
    eventId: params.idempotencyKey || crypto.randomUUID(),
      eventName: params.eventName,
    eventVersion: 1,
    occurredAt: now,
    receivedAt: now,
    emitter: 'server',
    sessionId: params.sessionId,
    journeyId: params.journeyId,
    noticeId: params.noticeId,
    orderId: params.orderId,
    correlationId: params.correlationId,
      safeProperties: params.safeProperties || {},
  });
  return acceptBusinessEvent(event, {
    classification: {
      primary: params.classification || 'unresolved',
      evidenceClass: 'observed',
      policyVersion: 1,
      evidenceRef: 'server_event_emitter_v1',
    },
  });
}

export async function recordMeasurementDiagnostic(input: {
  code: 'CLOCK_SKEW' | 'DUPLICATE_CONFLICT' | 'RATE_LIMITED' | 'VALIDATION_FAILED' | 'STORAGE_UNAVAILABLE' | 'REDACTED';
  severity: 'info' | 'warning' | 'error';
  correlationId?: string;
  retryable: boolean;
  detailsRedacted?: string;
}): Promise<void> {
  const diagnostic = DiagnosticSchema.parse({
    ...input,
    component: 'measurement_ingestion',
    occurredAt: new Date().toISOString(),
  });
  const diagnosticId = crypto.randomUUID();
  await firestoreDb.collection('business_diagnostics_v1').doc(diagnosticId).set(
    sanitizeFirestoreData({ diagnosticId, ...diagnostic })
  );
}
