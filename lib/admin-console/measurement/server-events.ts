import crypto from 'node:crypto';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { EventEnvelopeSchema } from '@/lib/admin-console/contracts';

type EventEnvelope = ReturnType<typeof EventEnvelopeSchema.parse>;
type Classification = 'customer' | 'founder' | 'employee' | 'automated_test' | 'comp' | 'free_promo' | 'suspected_bot' | 'unresolved';

export type ServerBusinessEventInput = {
  eventId: string;
  eventName: EventEnvelope['eventName'];
  environment: EventEnvelope['environment'];
  occurredAt?: string;
  sessionId?: string;
  journeyId?: string;
  draftRevision?: number;
  checkoutAttemptId?: string;
  orderId?: string;
  noticeId?: string;
  tier?: EventEnvelope['tier'];
  entrySurface?: string;
  experienceVersion?: string;
  classification?: Classification;
  classificationEvidenceRef?: string;
  safeProperties?: Record<string, string | number | boolean | null>;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Build a privacy-safe server fact with a stable event identity for an authoritative transition. */
export function buildServerBusinessEvent(input: ServerBusinessEventInput) {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const event = EventEnvelopeSchema.parse({
    schemaVersion: 1,
    product: 'docketstamp',
    environment: input.environment,
    eventId: input.eventId,
    eventName: input.eventName,
    eventVersion: 1,
    occurredAt,
    receivedAt: occurredAt,
    emitter: 'server',
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.journeyId ? { journeyId: input.journeyId } : {}),
    ...(input.draftRevision !== undefined ? { draftRevision: input.draftRevision } : {}),
    ...(input.checkoutAttemptId ? { checkoutAttemptId: input.checkoutAttemptId } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.noticeId ? { noticeId: input.noticeId } : {}),
    ...(input.tier ? { tier: input.tier } : {}),
    ...(input.entrySurface ? { entrySurface: input.entrySurface } : {}),
    ...(input.experienceVersion ? { experienceVersion: input.experienceVersion } : {}),
    ...(input.classificationEvidenceRef ? { classificationEvidenceRef: input.classificationEvidenceRef } : {}),
    safeProperties: input.safeProperties || {},
  });
  const classification = {
    primary: input.classification || 'unresolved',
    evidenceClass: 'observed' as const,
    policyVersion: 1 as const,
    evidenceRef: input.classificationEvidenceRef || 'server_authoritative_transition_v1',
  };
  const logicalDigest = crypto.createHash('sha256').update(stableJson(event)).digest('hex');
  return { event, classification, logicalDigest };
}

/** Append the event inside the caller's Firestore transaction with the state transition. */
export function appendServerBusinessEvent(tx: FirebaseFirestore.Transaction | any, input: ServerBusinessEventInput): void {
  const built = buildServerBusinessEvent(input);
  const ref = firestoreDb.collection('business_events_v1').doc(built.event.eventId);
  tx.create(ref, sanitizeFirestoreData({ ...built.event, logicalDigest: built.logicalDigest, classification: built.classification }));
}
