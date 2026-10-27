import type { z } from 'zod';
import { ScopeSchema, MetricSchema } from '../contracts';

export type ReportScope = z.infer<typeof ScopeSchema>;
export interface FactRow {
  factId: string; orderId?: string; environment?: string; currency: string; amountMinor: number;
  kind: string; verification: string; providerMode: string; effectiveAt: string; receivedAt: string;
  classification?: { primary: string };
}
export interface EventRow {
  eventId: string; eventName: string; environment: string; occurredAt: string; receivedAt: string;
  sessionId?: string; journeyId?: string; orderId?: string; noticeId?: string; tier?: string;
  entrySurface?: string; classification?: string | { primary: string }; safeProperties?: Record<string, unknown>;
  acquisition?: { original?: { source?: string; medium?: string; campaignId?: string } };
}
export interface OrderRow {
  id: string; status: string; environment?: string; sessionId?: string; telemetrySessionId?: string;
  noticeId?: string; noticeType?: string; serviceLevel?: string; updatedAt?: number; createdAt?: number;
  lobLetterId?: string; postalMode?: string; freeAuthorizationId?: string; fulfillmentError?: string;
}
export interface PostalRow { factId: string; orderId: string; state: string; lobMode: string; environment?: string; occurredAt: string; receivedAt: string }
export interface CostRow {
  id: string; environment: string; currency: string; orderId?: string; kind: 'supplier' | 'processor' | 'spend';
  amountMinor: number; effectiveAt: string; sourceRef: string; authority?: 'actual'|'estimated';
  coverage: 'complete' | 'partial'; campaignKey?: string;
}
export interface ReportInput {
  scope: ReportScope; asOf: string; facts: FactRow[]; events: EventRow[]; orders: OrderRow[];
  postal: PostalRow[]; costs?: CostRow[]; openObligations?: Array<{ fact: FactRow; order: OrderRow }>;
  sourceComplete: boolean; generationId: string;
}
export const JOURNEY = ['entry_viewed', 'notice_selected', 'details_ready', 'signature_adopted', 'document_locked', 'payment_attempted', 'payment_verified', 'fulfillment_accepted'] as const;
const time = (v: string) => Date.parse(v);
const day = 86400000;
const classify = (value: string | { primary: string } | undefined) => typeof value === 'string' ? value : value?.primary || 'unresolved';
const signForMoney = (kind: string) => kind === 'capture' || kind === 'dispute_reversal' ? 1 : kind === 'refund' || kind === 'dispute_debit' ? -1 : 0;

export function computeReport(input: ReportInput) {
  const scope = ScopeSchema.parse(input.scope);
  const start = time(scope.startUtc), end = time(scope.endUtcExclusive), now = time(input.asOf);
  const inWindow = (at: string) => time(at) >= start && time(at) < end;
  const inConversionWindow = (at: string) => time(at) >= start && time(at) < end + 7 * day;
  const sameEnvironment = (row: { environment?: string }) => row.environment === scope.environment;
  if (!scope.environment) throw new Error('Report environment must be explicit');
  const orderMap = new Map(input.orders.map(o => [o.id, o]));
  const attributionEvents = input.events.filter(e => sameEnvironment(e) && time(e.receivedAt) <= now && time(e.occurredAt) <= now + 300000 &&
    (!scope.noticeId || e.noticeId === scope.noticeId) && (!scope.tier || e.tier === scope.tier) &&
    (!scope.entrySurface || e.entrySurface === scope.entrySurface) && classify(e.classification) === (scope.classification || 'customer'));
  const acquisitionEntries = new Map<string, EventRow>();
  for (const event of attributionEvents.filter(e => e.eventName === 'entry_viewed' && e.sessionId).sort((a,b) => time(a.occurredAt) - time(b.occurredAt))) {
    if (!acquisitionEntries.has(event.sessionId!)) acquisitionEntries.set(event.sessionId!, event);
  }
  const channelKey = (event: EventRow) => {
    const source = event.acquisition?.original;
    return source?.campaignId ? `${source.source || 'unknown'}:${source.medium || 'unknown'}:${source.campaignId}` : source?.source || 'unknown';
  };
  const orderMatches = (orderId?: string) => {
    if (!orderId) return !scope.noticeId && !scope.tier;
    const order = orderMap.get(orderId);
    if (scope.noticeId && order?.noticeId !== scope.noticeId && order?.noticeType !== scope.noticeId) return false;
    const tiers: Record<string, string> = { FIRST_CLASS: 'first_class', CERTIFIED: 'certified', CERTIFIED_RETURN_RECEIPT: 'certified_return_receipt' };
    if (scope.tier && tiers[order?.serviceLevel || ''] !== scope.tier) return false;
    if (scope.channel || scope.entrySurface) {
      const session = order?.sessionId || order?.telemetrySessionId;
      const entry = session ? acquisitionEntries.get(session) : undefined;
      if (!entry) return false;
      if (scope.channel && channelKey(entry) !== scope.channel) return false;
      if (scope.entrySurface && entry.entrySurface !== scope.entrySurface) return false;
    }
    return true;
  };
  const allFacts = [...new Map(input.facts.map(f => [f.factId, f])).values()].filter(f =>
    sameEnvironment(f) && f.verification === 'verified' && Number.isSafeInteger(f.amountMinor) && f.amountMinor >= 0 && time(f.receivedAt) <= now && time(f.effectiveAt) <= now,
  );
  const desiredClass = scope.classification || 'customer';
  const classFacts = allFacts.filter(f => classify(f.classification) === desiredClass && orderMatches(f.orderId));
  const scopedAttribution = Boolean(scope.channel || scope.entrySurface);
  const unattributedOrders = scopedAttribution ? new Set(allFacts.filter(f => inWindow(f.effectiveAt) && signForMoney(f.kind) !== 0 && f.orderId)
    .filter(f => {
      const order = orderMap.get(f.orderId!);
      const session = order?.sessionId || order?.telemetrySessionId;
      return Boolean(order && (!session || !acquisitionEntries.has(session)));
    }).map(f => f.orderId!)) : new Set<string>();
  const reportSourceComplete = input.sourceComplete && unattributedOrders.size === 0;
  const financial = classFacts.filter(f => inWindow(f.effectiveAt) && f.providerMode === 'live' && signForMoney(f.kind) !== 0);
  const captures = financial.filter(f => f.kind === 'capture' && f.amountMinor > 0);
  const paidOrderIds = new Set(captures.map(f => f.orderId).filter(Boolean) as string[]);
  const openFacts = (input.openObligations || (input.facts.filter(f => f.kind === 'capture' && inWindow(f.effectiveAt)).flatMap(f => {
    const order = f.orderId ? orderMap.get(f.orderId) : undefined;
    return order ? [{ fact: f, order }] : [];
  }))).filter(({ fact, order }) =>
    sameEnvironment(fact) && (!order.environment || order.environment === scope.environment) &&
    fact.verification === 'verified' && fact.providerMode === 'live' && fact.kind === 'capture' &&
    time(fact.receivedAt) <= now && time(fact.effectiveAt) <= now &&
    classify(fact.classification) === desiredClass && orderMatches(order.id),
  );
  const unknownCapture = allFacts.filter(f => f.kind === 'capture' && classify(f.classification) === 'unresolved');
  const moneyByCurrency: Record<string, number> = {};
  for (const fact of financial) moneyByCurrency[fact.currency] = (moneyByCurrency[fact.currency] || 0) + signForMoney(fact.kind) * fact.amountMinor;

  const seenEvents = new Set<string>();
  const events = input.events.filter(e => {
    if (seenEvents.has(e.eventId) || !sameEnvironment(e) || time(e.receivedAt) > now || time(e.occurredAt) > now + 300000) return false;
    seenEvents.add(e.eventId);
    if (scope.noticeId && e.noticeId !== scope.noticeId) return false;
    if (scope.tier && e.tier !== scope.tier) return false;
    if (scope.entrySurface && e.entrySurface !== scope.entrySurface) return false;
    if (scope.channel && e.acquisition?.original?.source !== scope.channel) return false;
    return classify(e.classification) === desiredClass;
  });
  const entries = new Map<string, EventRow>();
  for (const e of events.filter(e => e.eventName === 'entry_viewed' && e.sessionId && inWindow(e.occurredAt)).sort((a,b) => time(a.occurredAt) - time(b.occurredAt))) {
    if (!entries.has(e.sessionId!)) entries.set(e.sessionId!, e);
  }
  // Include late captures through the seven-day conversion horizon, independently of the cash window.
  const conversionCaptures = classFacts.filter(f => f.kind === 'capture' && f.providerMode === 'live' && f.amountMinor > 0 && inConversionWindow(f.effectiveAt));
  const converted = new Set<string>();
  const cohortEntryByOrder = new Map<string, number>();
  let unmatchedCaptures = 0;
  for (const fact of conversionCaptures) {
    const order = fact.orderId ? orderMap.get(fact.orderId) : undefined;
    const session = order?.sessionId || order?.telemetrySessionId;
    const entry = session ? entries.get(session) : undefined;
    if (entry && fact.orderId && time(fact.effectiveAt) >= time(entry.occurredAt) && time(fact.effectiveAt) < time(entry.occurredAt) + 7 * day) {
      converted.add(session!);
      cohortEntryByOrder.set(fact.orderId, time(entry.occurredAt));
    }
    else if (inWindow(fact.effectiveAt)) unmatchedCaptures++;
  }

  const postal = [...new Map(input.postal.map(p => [p.factId, p])).values()].filter(p => sameEnvironment(p) && time(p.receivedAt) <= now);
  const latestPostal = new Map<string, PostalRow>();
  for (const p of postal.sort((a,b) => time(a.occurredAt) - time(b.occurredAt) || a.factId.localeCompare(b.factId))) latestPostal.set(p.orderId, p);
  const acceptedStates = new Set(['accepted_by_lob','mailed','in_transit','delivered','returned']);
  const accepted = (id: string) => { const p = latestPostal.get(id); return Boolean(p && p.lobMode === 'live' && acceptedStates.has(p.state)); };
  // Contribution follows the acquired session cohort and its seven-day outcome window,
  // rather than subtracting today's media spend from today's cash receipts.
  const cohortOrders = [...cohortEntryByOrder.keys()];
  const sourceKey = channelKey;
  const costRows = input.costs || [];
  const actualCosts = costRows.filter(c => c.environment === scope.environment && c.authority === 'actual' && c.coverage === 'complete' && c.currency === 'USD' && time(c.effectiveAt) <= now);
  const estimatedCosts = costRows.filter(c => c.environment === scope.environment && c.authority === 'estimated' && c.coverage === 'complete' && c.currency === 'USD');
  const cohortFinancial = classFacts.filter(f => {
    if (!f.orderId || f.providerMode !== 'live' || signForMoney(f.kind) === 0) return false;
    const entryAt = cohortEntryByOrder.get(f.orderId);
    return entryAt !== undefined && time(f.effectiveAt) >= entryAt && time(f.effectiveAt) < entryAt + 7 * day;
  });
  const cohortNetUsd = cohortFinancial.every(f => f.currency === 'USD')
    ? cohortFinancial.reduce((sum, f) => sum + signForMoney(f.kind) * f.amountMinor, 0) : null;
  const costCoverage = (costs: CostRow[]) => cohortOrders.filter(id =>
    costs.some(c => c.orderId === id && c.kind === 'supplier') && costs.some(c => c.orderId === id && c.kind === 'processor'),
  ).length;
  const coveredActual = costCoverage(actualCosts);
  const coveredEstimate = costCoverage(estimatedCosts);
  const beforeAcquisitionMinor = cohortOrders.length && cohortNetUsd !== null && coveredActual === cohortOrders.length
    ? cohortNetUsd - actualCosts.filter(c => c.orderId && cohortOrders.includes(c.orderId) && c.kind !== 'spend').reduce((sum, c) => sum + c.amountMinor, 0)
    : cohortOrders.length && cohortNetUsd !== null && coveredEstimate === cohortOrders.length
      ? cohortNetUsd - estimatedCosts.filter(c => c.orderId && cohortOrders.includes(c.orderId) && c.kind !== 'spend').reduce((sum, c) => sum + c.amountMinor, 0)
      : null;
  const beforeEvidenceClass = coveredActual === cohortOrders.length && cohortOrders.length ? 'verified' : coveredEstimate === cohortOrders.length && cohortOrders.length ? 'estimated' : 'unavailable';
  const spendRows = actualCosts.filter(c => c.kind === 'spend' && inWindow(c.effectiveAt));
  const activeSourceKeys = new Set([...entries.values()].map(sourceKey));
  const spendKnown = spendRows.length > 0 && spendRows.every(c => c.coverage === 'complete') &&
    (activeSourceKeys.size === 0 || [...activeSourceKeys].every(key => spendRows.some(c => c.campaignKey === key)));
  const spendMinor = spendKnown ? spendRows.reduce((sum, c) => sum + c.amountMinor, 0) : null;
  const afterAcquisitionMinor = beforeAcquisitionMinor !== null && spendMinor !== null ? beforeAcquisitionMinor - spendMinor : null;

  const exceptions: Array<{orderId: string; reason: string; priority: number; ageSeconds: number; evidenceRef: string}> = [];
  for (const { fact, order } of openFacts) {
    if (!accepted(order.id)) {
      const p = latestPostal.get(order.id);
      exceptions.push({ orderId: order.id, reason: p?.state === 'uncertain' ? 'SUBMISSION_UNCERTAIN' : 'PAID_NOT_ACCEPTED', priority: p?.state === 'uncertain' ? 0 : 1, ageSeconds: Math.max(0, Math.floor((now - time(fact.effectiveAt)) / 1000)), evidenceRef: fact.factId });
    }
  }
  exceptions.sort((a,b) => a.priority - b.priority || b.ageSeconds - a.ageSeconds);
  const stageSets = JOURNEY.map(() => new Set<string>());
  let missingPrerequisites = 0;
  for (const [session, entry] of entries) {
    const observed = events.filter(e => e.sessionId === session && time(e.occurredAt) >= time(entry.occurredAt) && time(e.occurredAt) < time(entry.occurredAt) + 7 * day).sort((a,b) => time(a.occurredAt) - time(b.occurredAt));
    let prior = -1;
    for (const e of observed) {
      const stage = JOURNEY.indexOf(e.eventName as typeof JOURNEY[number]);
      if (stage < 0) continue;
      stageSets[stage].add(session);
      if (stage > prior + 1) missingPrerequisites++;
      if (stage === prior + 1) prior = stage;
    }
  }
  for (const session of converted) stageSets[6].add(session);
  for (const orderId of paidOrderIds) {
    const order = orderMap.get(orderId); const session = order?.sessionId || order?.telemetrySessionId;
    if (session && entries.has(session) && accepted(orderId)) stageSets[7].add(session);
  }
  const immature = [...entries.values()].filter(e => now < time(e.occurredAt) + 7 * day).length;
  const validTimes = [...allFacts.map(f => time(f.receivedAt)), ...events.map(e => time(e.receivedAt)), ...postal.map(p => time(p.receivedAt))].filter(Number.isFinite);
  const watermark = validTimes.length ? new Date(Math.max(...validTimes)).toISOString() : null;
  const stale = Boolean(watermark && now - time(watermark) > 900000);
  const qualityFlags = ['OBSERVED_BROWSER_COVERAGE_UNKNOWN','PROVIDER_RECONCILIATION_NOT_MEASURED','LEGACY_RECORDS_NOT_BACKFILLED', ...(reportSourceComplete ? [] : ['SOURCE_SCAN_PARTIAL']), ...(unattributedOrders.size ? ['CHANNEL_ATTRIBUTION_INCOMPLETE'] : []), ...(immature ? ['IMMATURE_COHORT'] : []), ...(stale ? ['STALE_EVIDENCE'] : []), ...(input.openObligations === undefined ? ['OPEN_OUTBOX_NOT_MEASURED'] : [])];
  const exclusions: Record<string, number> = { unresolvedCaptures: unknownCapture.length, unmatchedCaptures, unattributedChannelOrders: unattributedOrders.size };
  const evidenceQueryRef = (metric: string) => `/api/admin/console/evidence?generationId=${input.generationId}&metric=${metric}`;
  const metric = (key: string, value: number | null, unit: 'count'|'ratio'|'money_minor', evidenceClass: 'verified'|'observed'|'estimated'|'unavailable', extra: Record<string, unknown> = {}) => MetricSchema.parse({
    key, value, unit, evidenceClass, source: ['payment_facts_v1','business_events_v1','postal_facts_v1'], definitionVersion: 1,
    scope, asOf: input.asOf, watermark, completeness: !reportSourceComplete ? 'partial' : stale ? 'stale' : 'complete_within_scope',
    exclusions, qualityFlags, evidenceQueryRef: evidenceQueryRef(key), ...extra,
  });
  type ChannelRow = {key:string;sessions:number;convertingSessions:number;paidOrders:number;netCollectionsMinor:number|null;spendMinor:number|null;contributionMinor:number|null;joinCoverage:number|null};
  const channels = new Map<string, ChannelRow>();
  for (const [session, event] of entries) { const key = sourceKey(event); const row = channels.get(key) || { key, sessions: 0, convertingSessions: 0, paidOrders: 0, netCollectionsMinor: null, spendMinor: null, contributionMinor: null, joinCoverage: null }; row.sessions++; if (converted.has(session)) row.convertingSessions++; channels.set(key,row); }
  for (const row of channels.values()) {
    const sessions = new Set([...entries].filter(([,e]) => sourceKey(e) === row.key).map(([id]) => id));
    const ids = cohortOrders.filter(id => { const o = orderMap.get(id); return sessions.has(o?.sessionId || o?.telemetrySessionId || ''); });
    row.paidOrders = ids.length;
    const facts = cohortFinancial.filter(f => f.orderId && ids.includes(f.orderId));
    row.netCollectionsMinor = facts.some(f => f.currency !== 'USD') ? null : facts.reduce((sum,f) => sum + signForMoney(f.kind) * f.amountMinor, 0);
    const spend = spendRows.filter(c => c.campaignKey === row.key);
    row.spendMinor = spendKnown && spend.length ? spend.reduce((sum,c) => sum + c.amountMinor, 0) : null;
    const costs = actualCosts.filter(c => c.orderId && ids.includes(c.orderId) && c.kind !== 'spend');
    const covered = ids.length > 0 && ids.every(id => costs.some(c => c.orderId === id && c.kind === 'supplier') && costs.some(c => c.orderId === id && c.kind === 'processor'));
    row.contributionMinor = covered && row.netCollectionsMinor !== null ? row.netCollectionsMinor - costs.reduce((sum,c) => sum + c.amountMinor,0) : null;
    row.joinCoverage = row.paidOrders ? Math.min(1, ids.filter(id => { const o = orderMap.get(id); return Boolean(o?.sessionId || o?.telemetrySessionId); }).length / row.paidOrders) : null;
  }
  const netCollectionsUsd = Object.keys(moneyByCurrency).some(currency => currency !== 'USD') ? null : moneyByCurrency.USD ?? (input.sourceComplete ? 0 : null);
  const paidAccepted = [...paidOrderIds].filter(accepted).length;
  const sourceCount = channels.size;
  return {
    generationId: input.generationId, scope, asOf: input.asOf, watermark, sourceComplete: reportSourceComplete,
    metrics: {
      paidOrders: metric('paid_orders', paidOrderIds.size, 'count', 'verified'),
      netCollections: metric('net_collections', netCollectionsUsd, 'money_minor', netCollectionsUsd === null ? 'unavailable' : 'verified', { currency: 'USD' }),
      accepted: metric('postal_acceptance', paidOrderIds.size ? paidAccepted / paidOrderIds.size : null, 'ratio', paidOrderIds.size ? 'verified' : 'unavailable', { numerator: paidAccepted, denominator: paidOrderIds.size }),
      conversion: metric('paid_session_conversion', entries.size ? converted.size / entries.size : null, 'ratio', entries.size ? 'observed' : 'unavailable', { numerator: converted.size, denominator: entries.size }),
      urgent: metric('open_obligations', exceptions.length, 'count', 'verified'),
      contributionBeforeAcquisition: metric('contribution_before_acquisition', beforeAcquisitionMinor, 'money_minor', beforeEvidenceClass, { currency: 'USD' }),
      contributionAfterAcquisition: metric('contribution_after_acquisition', afterAcquisitionMinor, 'money_minor', afterAcquisitionMinor === null ? 'unavailable' : beforeEvidenceClass, { currency: 'USD' }),
      acquisitionSpend: metric('acquisition_spend', spendMinor, 'money_minor', spendMinor === null ? 'unavailable' : 'verified', { currency: 'USD' }),
    },
    moneyByCurrency, exceptions, journey: JOURNEY.map((name,i) => ({ name, observedSessions: stageSets[i].size, evidenceQueryRef: evidenceQueryRef(name) })), channels: [...channels.values()],
    quality: {
      classificationUnresolved: unknownCapture.length, unmatchedCaptures, immatureSessions: immature, missingPrerequisites,
      eligibleSessions: entries.size, convertingSessions: converted.size,
      costCoverage: cohortOrders.length ? coveredActual / cohortOrders.length : null,
      spendCoverage: sourceCount ? [...channels.values()].filter(c => c.spendMinor !== null).length / sourceCount : null,
      providerReconciliation: 'not_measured', flags: qualityFlags,
    },
    evidence: {
      money: financial.map(f => ({ id:f.factId, orderId:f.orderId, kind:f.kind, amountMinor:f.amountMinor, currency:f.currency, verification:f.verification, effectiveAt:f.effectiveAt, classification:classify(f.classification) })),
      events: events.filter(e => e.sessionId && entries.has(e.sessionId)).map(e => ({ id:e.eventId,eventName:e.eventName,sessionId:e.sessionId,occurredAt:e.occurredAt,receivedAt:e.receivedAt })),
      postal: postal.map(p => ({ id:p.factId,orderId:p.orderId,state:p.state,lobMode:p.lobMode,occurredAt:p.occurredAt })),
    },
  };
}
export type ConsoleReport = ReturnType<typeof computeReport>;
