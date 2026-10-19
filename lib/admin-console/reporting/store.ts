import crypto from 'node:crypto';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { ScopeSchema } from '../contracts';
import { computeReport, type ReportScope, type ReportInput, type ConsoleReport } from './compute';

export const scopeKey = (scope: ReportScope) => crypto.createHash('sha256').update(JSON.stringify(ScopeSchema.parse(scope))).digest('hex');
const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_ROWS = 10000;

// Explicit rebuild only. A dashboard GET never reads raw collections or rebuilds.
async function scan(collection: string, field: string, environment: string) {
  const rows: Record<string, any>[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (rows.length < MAX_ROWS) {
    let query = firestoreDb.collection(collection).where('environment', '==', environment).orderBy(field).limit(Math.min(500, MAX_ROWS - rows.length));
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    rows.push(...page.docs.map(doc => ({ ...doc.data(), _documentId: doc.id })));
    if (page.size < 500) return { rows, complete: true };
    cursor = page.docs.at(-1);
  }
  return { rows, complete: false };
}

export async function prepareGeneration(scopeInput: unknown, asOf = new Date().toISOString()) {
  const scope = ScopeSchema.parse(scopeInput);
  if (!scope.environment) throw new Error('Explicit environment required');
  const [money, events, orders, postal, costs, classifications] = await Promise.all([
    scan('payment_facts_v1', 'factId', scope.environment), scan('business_events_v1', 'eventId', scope.environment),
    scan('orders', 'id', scope.environment), scan('postal_facts_v1', 'factId', scope.environment), scan('cost_records_v1', 'id', scope.environment), scan('identity_classifications_v1', 'id', scope.environment),
  ]);
  const overrides = new Map(classifications.rows.map(row => [row.orderId, row]));
  const facts = money.rows.map(row => overrides.has(row.orderId) ? { ...row, classification: { primary: overrides.get(row.orderId)!.primary }, classificationOverrideRef: overrides.get(row.orderId)!._documentId } : row);
  // Old order records did not have environment. Join only by an already-scoped
  // authority fact; do not classify unrelated legacy records as current customers.
  const missingOrderIds = [...new Set(facts.map(f=>f.orderId).filter(Boolean))].filter(id=>!orders.rows.some(o=>o.id===id));
  for (const id of missingOrderIds.slice(0,500)) {
    const doc=await firestoreDb.collection('orders').doc(id).get();
    if(doc.exists && (!doc.data()?.environment || doc.data()?.environment===scope.environment)) orders.rows.push({...doc.data(),id,_documentId:doc.id});
  }
  if(missingOrderIds.length>500)orders.complete=false;
  const generationId = digest({ scope, asOf, money: facts, events: events.rows, orders: orders.rows, postal: postal.rows, costs: costs.rows, classifications:classifications.rows }).slice(0,32);
  const report = computeReport({ scope, asOf, generationId, facts, events: events.rows, orders: orders.rows, postal: postal.rows, costs: costs.rows, sourceComplete: [money, events, orders, postal, costs,classifications].every(s => s.complete) } as ReportInput);
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
