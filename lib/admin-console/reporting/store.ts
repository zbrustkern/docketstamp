import crypto from 'node:crypto';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { ScopeSchema } from '../contracts';
import { computeReport, type ReportScope, type ReportInput, type ConsoleReport } from './compute';

export const scopeKey = (scope: ReportScope) => crypto.createHash('sha256').update(JSON.stringify(ScopeSchema.parse(scope))).digest('hex');
const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_ROWS = 10000;
const PAGE_SIZE = 500;
type SourceRows = { rows: Record<string, any>[]; complete: boolean };

// Explicit rebuild only. Every high-volume source query is environment and event-time bounded.
async function scanRange(collection: string, timeField: string, environment: string, start: string, end: string): Promise<SourceRows> {
  const rows: Record<string, any>[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (rows.length < MAX_ROWS) {
    const pageLimit = Math.min(PAGE_SIZE, MAX_ROWS - rows.length);
    let query = firestoreDb.collection(collection).where('environment', '==', environment)
      .where(timeField, '>=', start).where(timeField, '<', end)
      .orderBy(timeField).orderBy('__name__').limit(pageLimit);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    rows.push(...page.docs.map(doc => ({ ...doc.data(), _documentId: doc.id })));
    if (page.size < pageLimit) return { rows, complete: true };
    cursor = page.docs.at(-1);
  }
  return { rows, complete: false };
}

async function scanOpenOutbox(): Promise<SourceRows> {
  const rows: Record<string, any>[] = [];
  let complete = true;
  for (const status of ['pending', 'processing', 'attention_required']) {
    const query = await firestoreDb.collection('business_outbox_v1').where('kind', '==', 'payment_obligation')
      .where('status', '==', status).orderBy('createdAt').limit(MAX_ROWS + 1).get();
    rows.push(...query.docs.slice(0, MAX_ROWS).map(doc => ({ ...doc.data(), _documentId: doc.id })));
    if (query.size > MAX_ROWS) complete = false;
  }
  return { rows: rows.slice(0, MAX_ROWS), complete: complete && rows.length <= MAX_ROWS };
}

async function getManyDocuments(collection: string, ids: string[]): Promise<SourceRows> {
  const unique = [...new Set(ids.filter(Boolean))];
  const complete = unique.length <= MAX_ROWS;
  const rows: Record<string, any>[] = [];
  for (const id of unique.slice(0, MAX_ROWS)) {
    const doc = await firestoreDb.collection(collection).doc(id).get();
    if (doc.exists) rows.push({ ...doc.data(), id: doc.id, _documentId: doc.id });
  }
  return { rows, complete };
}

async function queryByOrderIds(collection: string, environment: string, ids: string[]): Promise<SourceRows> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: Record<string, any>[] = [];
  let complete = unique.length <= MAX_ROWS;
  for (let i = 0; i < Math.min(unique.length, MAX_ROWS) && rows.length < MAX_ROWS; i += 30) {
    const limit = Math.min(PAGE_SIZE, MAX_ROWS - rows.length);
    const page = await firestoreDb.collection(collection).where('environment', '==', environment)
      .where('orderId', 'in', unique.slice(i, i + 30)).limit(limit + 1).get();
    rows.push(...page.docs.slice(0, limit).map(doc => ({ ...doc.data(), _documentId: doc.id })));
    if (page.size > limit) complete = false;
    if (rows.length >= MAX_ROWS && i + 30 < unique.length) complete = false;
  }
  return { rows, complete };
}

async function queryEntryEventsBySessions(environment: string, sessionIds: string[]): Promise<SourceRows> {
  const unique = [...new Set(sessionIds.filter(Boolean))];
  const rows: Record<string, any>[] = [];
  let complete = unique.length <= MAX_ROWS;
  for (let i = 0; i < Math.min(unique.length, MAX_ROWS) && rows.length < MAX_ROWS; i += 30) {
    const limit = Math.min(PAGE_SIZE, MAX_ROWS - rows.length);
    const page = await firestoreDb.collection('business_events_v1').where('environment', '==', environment)
      .where('sessionId', 'in', unique.slice(i, i + 30)).where('eventName', '==', 'entry_viewed').limit(limit + 1).get();
    rows.push(...page.docs.slice(0, limit).map(doc => ({ ...doc.data(), _documentId: doc.id })));
    if (page.size > limit) complete = false;
    if (rows.length >= MAX_ROWS && i + 30 < unique.length) complete = false;
  }
  return { rows, complete };
}

export async function prepareGeneration(scopeInput: unknown, asOf = new Date().toISOString()) {
  const scope = ScopeSchema.parse(scopeInput);
  if (!scope.environment) throw new Error('Explicit environment required');
  const conversionEnd = new Date(Date.parse(scope.endUtcExclusive) + 7 * 86400000).toISOString();
  const [money, events, postalInWindow, spend] = await Promise.all([
    scanRange('payment_facts_v1', 'effectiveAt', scope.environment, scope.startUtc, conversionEnd),
    scanRange('business_events_v1', 'occurredAt', scope.environment, scope.startUtc, conversionEnd),
    scanRange('postal_facts_v1', 'occurredAt', scope.environment, scope.startUtc, scope.endUtcExclusive),
    scanRange('cost_records_v1', 'effectiveAt', scope.environment, scope.startUtc, scope.endUtcExclusive),
  ]);
  const outbox = await scanOpenOutbox();
  const scopedOpen: Array<{ fact: Record<string, any>; order: Record<string, any>; outbox: Record<string, any> }> = [];
  let joinsComplete = true;
  for (const item of outbox.rows) {
    if (typeof item.paymentFactId !== 'string' || typeof item.orderId !== 'string') { joinsComplete = false; continue; }
    const factSnap = await firestoreDb.collection('payment_facts_v1').doc(item.paymentFactId).get();
    if (!factSnap.exists) { joinsComplete = false; continue; }
    if (factSnap.data()?.environment !== scope.environment) continue;
    const orderSnap = await firestoreDb.collection('orders').doc(item.orderId).get();
    if (!orderSnap.exists || (orderSnap.data()?.environment && orderSnap.data()?.environment !== scope.environment)) { joinsComplete = false; continue; }
    scopedOpen.push({ fact: factSnap.data() as Record<string, any>, order: { ...(orderSnap.data() as Record<string, any>), id: orderSnap.id }, outbox: item });
  }
  const orderIds = [...new Set([
    ...money.rows.map(row => row.orderId), ...events.rows.map(row => row.orderId), ...scopedOpen.map(row => row.order.id),
  ].filter((id): id is string => typeof id === 'string'))];
  const [orders, targetedPostal, targetedCosts, classificationRows] = await Promise.all([
    getManyDocuments('orders', orderIds),
    queryByOrderIds('postal_facts_v1', scope.environment, scopedOpen.map(row => row.order.id)),
    queryByOrderIds('cost_records_v1', scope.environment, orderIds),
    queryByOrderIds('identity_classifications_v1', scope.environment, orderIds),
  ]);
  const authorityOrderIds = new Set([...money.rows, ...scopedOpen.map(row => row.fact)].map(row => row.orderId));
  const scopedOrders = orders.rows.filter(row => {
    const allowed = row.environment === scope.environment || (!row.environment && authorityOrderIds.has(row.id));
    if (!allowed) joinsComplete = false;
    return allowed;
  });
  const orderMap = new Map(scopedOrders.map(row => [String(row.id || row._documentId), row]));
  for (const open of scopedOpen) orderMap.set(open.order.id, open.order);
  const sessions = [...new Set([...orderMap.values()].flatMap(order => [order.sessionId, order.telemetrySessionId]).filter((id): id is string => typeof id === 'string'))];
  const historicalEntries = await queryEntryEventsBySessions(scope.environment, sessions);
  const allEvents = [...new Map([...events.rows, ...historicalEntries.rows].map(row => [row.eventId || row._documentId, row])).values()];
  const classifications = new Map(classificationRows.rows.map(row => [row.orderId, row]));
  const factsById = new Map<string, Record<string, any>>();
  for (const fact of [...money.rows, ...scopedOpen.map(row => row.fact)]) factsById.set(fact.factId, fact);
  const facts = [...factsById.values()].map(row => classifications.has(row.orderId)
    ? { ...row, classification: { primary: classifications.get(row.orderId)!.primary }, classificationOverrideRef: classifications.get(row.orderId)!._documentId }
    : row);
  const costs = [...new Map([...spend.rows, ...targetedCosts.rows].map(row => [row.id || row._documentId, row])).values()];
  const postal = [...new Map([...postalInWindow.rows, ...targetedPostal.rows].map(row => [row.factId || row._documentId, row])).values()];
  const openObligations = scopedOpen.map(({ fact, order }) => ({ fact, order }));
  const sourceComplete = [money, events, historicalEntries, postalInWindow, spend, outbox, orders, targetedPostal, targetedCosts, classificationRows].every(source => source.complete) && joinsComplete;
  const generationId = digest({ scope, asOf, facts, events: allEvents, orders: [...orderMap.values()], postal, costs, outbox: scopedOpen }).slice(0,32);
  const report = computeReport({ scope, asOf, generationId, facts, events: allEvents, orders: [...orderMap.values()], postal, costs, openObligations, sourceComplete } as ReportInput);
  return { report, reportHash: digest(report), mode: 'projection_only' as const };
}

export async function publishGeneration(prepared: Awaited<ReturnType<typeof prepareGeneration>>, expectedActive?: string) {
  const { report, reportHash } = prepared;
  const { evidence, exceptions, channels, ...summary } = report;
  const groups = { money: evidence.money, events: evidence.events, postal: evidence.postal, exceptions, channels };
  const counts: Record<string, number> = {};
  const partitions = firestoreDb.collection('report_partitions_v1');
  for (const [kind, rows] of Object.entries(groups)) {
    counts[kind] = rows.length;
    for (let offset = 0; offset < rows.length; offset += 100) {
      await partitions.doc(`${report.generationId}_${kind}_${offset / 100}`).set(sanitizeFirestoreData({ generationId: report.generationId, kind, page: offset / 100, rows: rows.slice(offset, offset + 100), environment: report.scope.environment }));
    }
  }
  const generations = firestoreDb.collection('report_generations_v1');
  const active = generations.doc(`active_${scopeKey(report.scope)}`);
  await firestoreDb.runTransaction(async tx => {
    const prior = await tx.get(active);
    const previousGenerationId = prior.data()?.generationId;
    if (expectedActive !== undefined && previousGenerationId !== expectedActive) throw new Error('REPORT_GENERATION_CONFLICT');
    tx.set(generations.doc(report.generationId), sanitizeFirestoreData({ ...summary, reportHash, counts, exceptions: exceptions.slice(0,10), channels: channels.slice(0,25), previousGenerationId, publication: 'published', generatedAt: report.asOf }));
    tx.set(active, sanitizeFirestoreData({ generationId: report.generationId, previousGenerationId, environment: report.scope.environment, updatedAt: report.asOf }));
  });
  return { generationId: report.generationId, reportHash, counts };
}

export async function readGeneration(scope: ReportScope) {
  const pointer = await firestoreDb.collection('report_generations_v1').doc(`active_${scopeKey(scope)}`).get();
  if (!pointer.exists) return null;
  const doc = await firestoreDb.collection('report_generations_v1').doc(pointer.data()!.generationId).get();
  return doc.exists ? doc.data() : null;
}

export async function readEvidence(generationId: string, kind: string, page = 0) {
  if (!/^[a-f0-9]{32}$/.test(generationId) || !['money','events','postal','exceptions','channels'].includes(kind) || !Number.isInteger(page) || page < 0 || page > 100) throw new Error('INVALID_EVIDENCE_QUERY');
  const meta = await firestoreDb.collection('report_generations_v1').doc(generationId).get();
  if (!meta.exists || meta.data()?.publication !== 'published') return null;
  const doc = await firestoreDb.collection('report_partitions_v1').doc(`${generationId}_${kind}_${page}`).get();
  return { scope: meta.data()!.scope, asOf: meta.data()!.asOf, kind, rows: doc.data()?.rows || [], total: meta.data()!.counts[kind], nextPage: (page+1)*100 < meta.data()!.counts[kind] ? page+1 : null };
}

export async function rollbackGeneration(scope: ReportScope, expectedActive: string) {
  const collection = firestoreDb.collection('report_generations_v1');
  const pointer = collection.doc(`active_${scopeKey(scope)}`);
  return firestoreDb.runTransaction(async tx => {
    const prior = await tx.get(pointer);
    const current = prior.data();
    if (current?.generationId !== expectedActive || !current.previousGenerationId) throw new Error('ROLLBACK_GENERATION_CONFLICT');
    const old = await tx.get(collection.doc(current.previousGenerationId));
    if (!old.exists || old.data()?.publication !== 'published') throw new Error('ROLLBACK_GENERATION_UNAVAILABLE');
    tx.set(pointer, { generationId: current.previousGenerationId, previousGenerationId: expectedActive, environment: scope.environment, updatedAt: new Date().toISOString() });
    return current.previousGenerationId as string;
  });
}
