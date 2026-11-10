import { AcquisitionSnapshotSchema, acquisitionKey, type AcquisitionSnapshot } from '@/lib/acquisition';
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
  acquisitionV2?: AcquisitionSnapshot;
  acquisition?: { original?: { source?: string; medium?: string; campaignId?: string } };
}
export interface OrderRow {
  acquisitionV2?: AcquisitionSnapshot;
  entrySource?: string;
  id: string; status: string; environment?: string; sessionId?: string; telemetrySessionId?: string;
  noticeId?: string; noticeType?: string; serviceLevel?: string; updatedAt?: number; createdAt?: number;
  classification?: string | { primary: string };
  lobLetterId?: string; postalMode?: string; freeAuthorizationId?: string; fulfillmentError?: string;
}
export interface PostalRow { factId: string; orderId: string; state: string; lobMode: string; environment?: string; occurredAt: string; receivedAt: string }
export interface CostRow {
  id: string; environment: string; currency: string; orderId?: string; kind: 'supplier' | 'processor' | 'spend';
  amountMinor: number; effectiveAt: string; sourceRef: string; authority?: 'actual'|'estimated';
  coverage: 'complete' | 'partial'; campaignKey?: string; coverageStartUtc?: string; coverageEndUtc?: string;
}
export interface ReportInput {
  scope: ReportScope; asOf: string; facts: FactRow[]; events: EventRow[]; orders: OrderRow[];
  postal: PostalRow[]; costs?: CostRow[]; openObligations?: Array<{ fact: FactRow; order: OrderRow }>;
  sourceComplete: boolean; generationId: string;
}
export const JOURNEY = ['entry_viewed', 'notice_selected', 'workspace_viewed', 'details_ready', 'signature_adopted', 'document_locked', 'payment_form_ready', 'payment_attempted', 'payment_verified', 'fulfillment_accepted'] as const;
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
  // Scope is applied after collecting the entry evidence. A landing event often has no
  // selected notice or mail tier yet, so filtering it first breaks the session join and
  // makes a valid campaign appear to have paid orders but no traffic.
  const candidateEvents = [...new Map(input.events.map(e => [e.eventId, e])).values()].filter(e =>
    sameEnvironment(e) && time(e.receivedAt) <= now && time(e.occurredAt) <= now + 300000 &&
    classify(e.classification) === (scope.classification || 'customer'));
  const acquisitionEntries = new Map<string, EventRow>();
  for (const event of candidateEvents.filter(e => e.eventName === 'entry_viewed' && e.sessionId).sort((a,b) => time(a.occurredAt) - time(b.occurredAt))) {
    if (!acquisitionEntries.has(event.sessionId!)) acquisitionEntries.set(event.sessionId!, event);
  }
  const snapshot = (value: unknown) => {
    const parsed = AcquisitionSnapshotSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  };
  const channelKey = (event: EventRow) => {
    if (event.acquisitionV2) return acquisitionKey(snapshot(event.acquisitionV2)?.currentSession);
    const source = event.acquisition?.original;
    return source?.campaignId ? `${source.source || 'unknown'}:${source.medium || 'unknown'}:${source.campaignId}` : source?.medium === 'cpc' ? `${source.source || 'unknown'}:cpc:unknown` : source?.source || 'unknown';
  };
  const orderAcquisition = (order?: OrderRow) => {
    const session = order?.sessionId || order?.telemetrySessionId;
    const entry = session ? acquisitionEntries.get(session) : undefined;
    if (order?.acquisitionV2) {
      const touch = snapshot(order.acquisitionV2)?.currentSession;
      return { key: acquisitionKey(touch), at: touch?.observedAt, surface: touch?.entrySurface, provenance: touch ? 'order_snapshot' : 'unknown', entry };
    }
    return { key: entry ? channelKey(entry) : 'unknown', at: entry?.occurredAt, surface: entry?.entrySurface, provenance: entry ? 'session_join_fallback' : 'unknown', entry };
  };
  const orderMatches = (orderId?: string) => {
    if (!orderId) return !scope.noticeId && !scope.tier && !scope.channel && !scope.entrySurface;
    const order = orderMap.get(orderId);
    if (scope.noticeId && order?.noticeId !== scope.noticeId && order?.noticeType !== scope.noticeId) return false;
    const tiers: Record<string, string> = { FIRST_CLASS: 'first_class', CERTIFIED: 'certified', CERTIFIED_RETURN_RECEIPT: 'certified_return_receipt' };
    if (scope.tier && tiers[order?.serviceLevel || ''] !== scope.tier) return false;
    if (scope.channel || scope.entrySurface) {
      const acquisition = orderAcquisition(order);
      if (scope.channel && acquisition.key !== scope.channel) return false;
      if (scope.entrySurface && acquisition.surface !== scope.entrySurface) return false;
    }
    return true;
  };
  const sessionOrders = new Map<string, OrderRow[]>();
  for (const order of input.orders.filter(o => !o.environment || sameEnvironment(o))) {
    const session = order.sessionId || order.telemetrySessionId;
    if (!session) continue;
    sessionOrders.set(session, [...(sessionOrders.get(session) || []), order]);
  }
  const sessionMatches = (session: string) => {
    const entry = acquisitionEntries.get(session);
    const sessionEvents = candidateEvents.filter(e => e.sessionId === session);
    const ordersForSession = sessionOrders.get(session) || [];
    if (scope.channel && (!entry || channelKey(entry) !== scope.channel)) return false;
    if (scope.entrySurface && (!entry || entry.entrySurface !== scope.entrySurface)) return false;
    if (scope.noticeId && !sessionEvents.some(e => e.noticeId === scope.noticeId) &&
      !ordersForSession.some(o => o.noticeId === scope.noticeId || o.noticeType === scope.noticeId)) return false;
    const tierValues: Record<string, string> = { FIRST_CLASS: 'first_class', CERTIFIED: 'certified', CERTIFIED_RETURN_RECEIPT: 'certified_return_receipt' };
    if (scope.tier && !sessionEvents.some(e => e.tier === scope.tier) &&
      !ordersForSession.some(o => tierValues[o.serviceLevel || ''] === scope.tier)) return false;
    return true;
  };
  const scopedSessions = new Set([...new Set(candidateEvents.map(e => e.sessionId).filter((v): v is string => Boolean(v)))].filter(sessionMatches));
  const allFacts = [...new Map(input.facts.map(f => [f.factId, f])).values()].filter(f =>
    sameEnvironment(f) && f.verification === 'verified' && Number.isSafeInteger(f.amountMinor) && f.amountMinor >= 0 && time(f.receivedAt) <= now && time(f.effectiveAt) <= now,
  );
  const desiredClass = scope.classification || 'customer';
  const classFacts = allFacts.filter(f => classify(f.classification) === desiredClass && orderMatches(f.orderId));
  const scopedAttribution = Boolean(scope.channel || scope.entrySurface);
  const unattributedOrders = scopedAttribution ? new Set(allFacts.filter(f => classify(f.classification) === desiredClass && inWindow(f.effectiveAt) && signForMoney(f.kind) !== 0 && f.orderId)
    .filter(f => {
      const order = orderMap.get(f.orderId!);
      const session = order?.sessionId || order?.telemetrySessionId;
      const key = orderAcquisition(order).key;
      return key === 'unknown' || key.endsWith(':unknown');
    }).map(f => f.orderId!)) : new Set<string>();
  const attributionConflicts = input.orders.filter(o => { const a = orderAcquisition(o); return a.provenance === 'order_snapshot' && a.entry && a.key !== channelKey(a.entry); }).length;
  const reportSourceComplete = input.sourceComplete && unattributedOrders.size === 0 && attributionConflicts === 0;
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
  const excludedByClassification = Object.fromEntries((['founder','employee','automated_test','comp','free_promo','suspected_bot','unresolved'] as const).map(kind => {
    const paidOrders = new Set(allFacts.filter(f => f.kind === 'capture' && classify(f.classification) === kind && f.orderId).map(f => f.orderId!));
    const sessions = new Set(input.events.filter(e => e.eventName === 'entry_viewed' && e.sessionId && classify(e.classification) === kind && inWindow(e.occurredAt)).map(e => e.sessionId!));
    return [kind, { paidOrders: paidOrders.size, sessions: sessions.size }];
  }));
  const moneyByCurrency: Record<string, number> = {};
  for (const fact of financial) moneyByCurrency[fact.currency] = (moneyByCurrency[fact.currency] || 0) + signForMoney(fact.kind) * fact.amountMinor;

  const seenEvents = new Set<string>();
  const events = candidateEvents.filter(e => {
    if (seenEvents.has(e.eventId)) return false;
    seenEvents.add(e.eventId);
    // Keep the whole journey for a session selected through its entry, selected order,
    // or an explicit event label. Event stages need not repeat filters such as tier.
    if (e.sessionId) return scopedSessions.has(e.sessionId);
    return !scope.noticeId && !scope.tier && !scope.channel && !scope.entrySurface;
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
    const acquisition = orderAcquisition(order);
    const at = acquisition.at ? time(acquisition.at) : NaN;
    if (fact.orderId && at >= start && at < end && time(fact.effectiveAt) >= at && time(fact.effectiveAt) < at + 7 * day) {
      if (session && entries.has(session) && channelKey(entries.get(session)!) === acquisition.key) converted.add(session);
      cohortEntryByOrder.set(fact.orderId, at);
    } else if (inWindow(fact.effectiveAt)) unmatchedCaptures++;

  }

  const postal = [...new Map(input.postal.map(p => [p.factId, p])).values()].filter(p => sameEnvironment(p) && time(p.receivedAt) <= now);
  const latestPostal = new Map<string, PostalRow>();
  for (const p of postal.sort((a,b) => time(a.occurredAt) - time(b.occurredAt) || a.factId.localeCompare(b.factId))) latestPostal.set(p.orderId, p);
  const acceptedStates = new Set(['accepted_by_lob','mailed','in_transit','delivered','returned']);
  const accepted = (id: string) => { const p = latestPostal.get(id); return Boolean(p && p.lobMode === 'live' && acceptedStates.has(p.state)); };
  const visiblePostalOrderIds = new Set([...classFacts.map(f => f.orderId), ...openFacts.map(({ order }) => order.id)].filter((id): id is string => Boolean(id)));
  const visiblePostal = postal.filter(p => visiblePostalOrderIds.has(p.orderId));
  const liveLatestPostal = [...latestPostal.values()].filter(p => p.lobMode === 'live' && paidOrderIds.has(p.orderId));
  const hasPostalState = (states: readonly string[]) => liveLatestPostal.filter(p => states.includes(p.state)).length;
  const postalStages = {
    lobAccepted: hasPostalState(['accepted_by_lob','mailed','in_transit','delivered','returned']),
    mailed: hasPostalState(['mailed','in_transit','delivered','returned']),
    inTransit: hasPostalState(['in_transit']),
    delivered: hasPostalState(['delivered']),
    returned: hasPostalState(['returned']),
  };
  // Contribution follows the acquired session cohort and its seven-day outcome window,
  // rather than subtracting today's media spend from today's cash receipts.
  const cohortOrders = [...cohortEntryByOrder.keys()];
  const sourceKey = channelKey;
  const feeFacts = classFacts.filter(f => f.kind === 'processor_fee' && f.providerMode === 'live' && f.currency === 'USD');
  const feeOrders = new Set(feeFacts.map(f => f.orderId));
  const providerFees: CostRow[] = feeFacts.map(f => ({ id: f.factId, environment: scope.environment!, currency: f.currency, orderId: f.orderId, kind: 'processor', amountMinor: f.amountMinor, effectiveAt: f.effectiveAt, sourceRef: f.factId, authority: 'actual', coverage: 'complete' }));
  const costRows = [...new Map([...(input.costs || []).filter(c => c.kind !== 'processor' || !feeOrders.has(c.orderId)), ...providerFees].map(c => [c.id, c])).values()].filter(c => Number.isSafeInteger(c.amountMinor) && c.amountMinor >= 0);
  const actualCosts = costRows.filter(c => c.environment === scope.environment && c.authority === 'actual' && c.coverage === 'complete' && c.currency === 'USD' && time(c.effectiveAt) <= now);
  const estimatedCosts = costRows.filter(c => c.environment === scope.environment && c.authority === 'estimated' && c.coverage === 'complete' && c.currency === 'USD' && time(c.effectiveAt) <= now);
  const cohortFinancial = classFacts.filter(f => {
    if (!f.orderId || f.providerMode !== 'live' || signForMoney(f.kind) === 0) return false;
    const entryAt = cohortEntryByOrder.get(f.orderId);
    return entryAt !== undefined && time(f.effectiveAt) >= entryAt && (f.kind !== 'capture' || time(f.effectiveAt) < entryAt + 7 * day);
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
  const allSpendRowsInWindow = costRows.filter(c =>
    c.environment === scope.environment &&
    c.kind === 'spend' &&
    c.currency === 'USD' &&
    time(c.effectiveAt) <= now &&
    inWindow(c.effectiveAt) &&
    (!scope.channel || c.campaignKey === scope.channel)
  );
  const spendRows = allSpendRowsInWindow.filter(c => c.authority === 'actual' && c.coverage === 'complete');
  const spendCoversRange = (rows: CostRow[]) => {
    if (scope.reportVersion < 2) return true; // Historical reports retain their original definition.
    const groups = new Map<string, CostRow[]>();
    for (const row of rows) groups.set(row.campaignKey || 'unknown', [...(groups.get(row.campaignKey || 'unknown') || []), row]);
    if (!groups.size) return false;
    return [...groups].every(([key, group]) => {
      const pilot = key === 'google:cpc:ds_search_deposit_demand_pilot_01';
      const from = pilot ? Math.max(start, time('2026-11-10T06:00:00.000Z')) : start;
      const until = pilot ? Math.min(end, now, time('2026-11-17T06:00:00.000Z')) : Math.min(end, now);
      let cursor = from;
      for (const row of group.sort((a,b)=>time(a.coverageStartUtc || '')-time(b.coverageStartUtc || ''))) {
        const a=time(row.coverageStartUtc || ''), b=time(row.coverageEndUtc || '');
        if (!Number.isFinite(a) || !Number.isFinite(b) || a !== cursor || b <= a || b > until) return false;
        cursor=b;
      }
      return cursor === until;
    });
  };

  const activeSourceKeys = new Set([...entries.values()].map(sourceKey));
  const spendKnown = spendCoversRange(spendRows) && (scope.channel
    ? allSpendRowsInWindow.length > 0 && allSpendRowsInWindow.every(c => c.authority === 'actual' && c.coverage === 'complete')
    : allSpendRowsInWindow.length > 0 &&
      allSpendRowsInWindow.every(c => c.authority === 'actual' && c.coverage === 'complete') &&
      (activeSourceKeys.size === 0 || [...activeSourceKeys].every(key => spendRows.some(c => c.campaignKey === key))));
  const spendMinor = spendKnown ? spendRows.reduce((sum, c) => sum + c.amountMinor, 0) : null;
  const cohortAttributionComplete = cohortOrders.every(id => { const key = orderAcquisition(orderMap.get(id)).key; return key !== 'unknown' && !key.endsWith(':unknown'); });
  const afterAcquisitionMinor = cohortAttributionComplete && reportSourceComplete && beforeEvidenceClass === 'verified' && beforeAcquisitionMinor !== null && spendMinor !== null ? beforeAcquisitionMinor - spendMinor : null;
  const costPerAttributableOrderMinor = cohortAttributionComplete && reportSourceComplete && spendMinor !== null && cohortOrders.length > 0
    ? Math.round(spendMinor / cohortOrders.length)
    : null;

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
  for (const session of converted) stageSets[8].add(session);
  for (const orderId of paidOrderIds) {
    const order = orderMap.get(orderId); const session = order?.sessionId || order?.telemetrySessionId;
    if (session && entries.has(session) && accepted(orderId)) stageSets[9].add(session);
  }
  const immature = [...entries.values()].filter(e => now < time(e.occurredAt) + 7 * day).length;
  const validTimes = [...allFacts.map(f => time(f.receivedAt)), ...events.map(e => time(e.receivedAt)), ...postal.map(p => time(p.receivedAt))].filter(Number.isFinite);
  const watermark = validTimes.length ? new Date(Math.max(...validTimes)).toISOString() : null;
  const stale = Boolean(watermark && now - time(watermark) > 900000);
  const qualityFlags = [
    'OBSERVED_BROWSER_COVERAGE_UNKNOWN',
    'PROVIDER_RECONCILIATION_NOT_MEASURED',
    'LEGACY_RECORDS_NOT_BACKFILLED',
    ...(reportSourceComplete ? [] : ['SOURCE_SCAN_PARTIAL']),
    ...(unattributedOrders.size ? ['CHANNEL_ATTRIBUTION_INCOMPLETE'] : []),
    ...(attributionConflicts ? ['ATTRIBUTION_CONFLICT'] : []),
    ...(!cohortAttributionComplete ? ['CHANNEL_ATTRIBUTION_INCOMPLETE'] : []),
    ...(cohortOrders.some(id => orderAcquisition(orderMap.get(id)).provenance === 'session_join_fallback') ? ['SESSION_JOIN_FALLBACK'] : []),
    ...(immature ? ['IMMATURE_COHORT'] : []),
    ...(stale ? ['STALE_EVIDENCE'] : []),
    ...(input.openObligations === undefined ? ['OPEN_OUTBOX_NOT_MEASURED'] : []),
    ...(!spendKnown ? ['SPEND_COVERAGE_INCOMPLETE'] : []),
    ...(cohortOrders.length > 0 && coveredActual < cohortOrders.length ? ['COST_COVERAGE_INCOMPLETE'] : []),
  ];
  const exclusions: Record<string, number> = { unresolvedCaptures: unknownCapture.length, unmatchedCaptures, unattributedChannelOrders: unattributedOrders.size };
  const evidenceQueryRef = (metric: string) => `/api/admin/console/evidence?generationId=${input.generationId}&metric=${metric}`;
  const metric = (key: string, value: number | null, unit: 'count'|'ratio'|'money_minor', evidenceClass: 'verified'|'observed'|'estimated'|'unavailable', extra: Record<string, unknown> = {}) => MetricSchema.parse({
    key, value, unit, evidenceClass, source: ['payment_facts_v1','business_events_v1','postal_facts_v1'], definitionVersion: 2,
    scope, asOf: input.asOf, watermark, completeness: !reportSourceComplete ? 'partial' : stale ? 'stale' : 'complete_within_scope',
    exclusions, qualityFlags, evidenceQueryRef: evidenceQueryRef(key), ...extra,
  });
  type ChannelRow = {key:string;sessions:number;convertingSessions:number;paidOrders:number;netCollectionsMinor:number|null;spendMinor:number|null;contributionMinor:number|null;joinCoverage:number|null;afterAcquisitionMinor?:number|null;costPerPaidOrderMinor?:number|null};
  const channels = new Map<string, ChannelRow>();
  for (const [session, event] of entries) { const key = sourceKey(event); const row = channels.get(key) || { key, sessions: 0, convertingSessions: 0, paidOrders: 0, netCollectionsMinor: null, spendMinor: null, contributionMinor: null, joinCoverage: null }; row.sessions++; if (converted.has(session)) row.convertingSessions++; channels.set(key,row); }
  for (const key of [...cohortOrders.map(id => orderAcquisition(orderMap.get(id)).key), ...allSpendRowsInWindow.map(c => c.campaignKey || 'unknown')]) {
    if (!channels.has(key)) channels.set(key, { key, sessions: 0, convertingSessions: 0, paidOrders: 0, netCollectionsMinor: null, spendMinor: null, contributionMinor: null, joinCoverage: null });
  }
  for (const row of channels.values()) {
    const sessions = new Set([...entries].filter(([,e]) => sourceKey(e) === row.key).map(([id]) => id));
    const ids = cohortOrders.filter(id => orderAcquisition(orderMap.get(id)).key === row.key);
    row.paidOrders = ids.length;
    const facts = cohortFinancial.filter(f => f.orderId && ids.includes(f.orderId));
    row.netCollectionsMinor = facts.some(f => f.currency !== 'USD') ? null : facts.reduce((sum,f) => sum + signForMoney(f.kind) * f.amountMinor, 0);
    const channelSpendRows = allSpendRowsInWindow.filter(c => c.campaignKey === row.key);
    const channelSpendKnown = spendCoversRange(channelSpendRows) && channelSpendRows.length > 0 && channelSpendRows.every(c => c.authority === 'actual' && c.coverage === 'complete');
    row.spendMinor = channelSpendKnown ? channelSpendRows.reduce((sum, c) => sum + c.amountMinor, 0) : null;
    const costs = actualCosts.filter(c => c.orderId && ids.includes(c.orderId) && c.kind !== 'spend');
    const covered = ids.length > 0 && ids.every(id => costs.some(c => c.orderId === id && c.kind === 'supplier') && costs.some(c => c.orderId === id && c.kind === 'processor'));
    row.contributionMinor = covered && row.netCollectionsMinor !== null ? row.netCollectionsMinor - costs.reduce((sum,c) => sum + c.amountMinor,0) : null;
    row.joinCoverage = row.paidOrders ? ids.filter(id => orderAcquisition(orderMap.get(id)).provenance !== 'unknown').length / row.paidOrders : null;
    row.afterAcquisitionMinor = row.key !== 'unknown' && !row.key.endsWith(':unknown') && reportSourceComplete && row.contributionMinor !== null && row.spendMinor !== null ? row.contributionMinor - row.spendMinor : null;
    row.costPerPaidOrderMinor = row.key !== 'unknown' && !row.key.endsWith(':unknown') && reportSourceComplete && row.spendMinor !== null && row.paidOrders ? Math.round(row.spendMinor / row.paidOrders) : null;
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
      observedSpend: metric('observed_spend', allSpendRowsInWindow.length ? allSpendRowsInWindow.filter(c => c.authority === 'actual').reduce((sum,c) => sum+c.amountMinor,0) : null, 'money_minor', 'observed', {currency:'USD'}),
      acquisitionSpend: metric('acquisition_spend', spendMinor, 'money_minor', spendMinor === null ? 'unavailable' : 'verified', { currency: 'USD' }),
      costPerAttributableOrder: metric('cost_per_attributable_order', costPerAttributableOrderMinor, 'money_minor', costPerAttributableOrderMinor === null ? 'unavailable' : 'verified', { currency: 'USD', denominator: cohortOrders.length }),
    },
    attribution: {
      orderSnapshots: cohortOrders.filter(id => orderAcquisition(orderMap.get(id)).provenance === 'order_snapshot').length,
      sessionJoinFallbacks: cohortOrders.filter(id => orderAcquisition(orderMap.get(id)).provenance === 'session_join_fallback').length,
      unknownPaidOrders: [...paidOrderIds].filter(id => { const key = orderAcquisition(orderMap.get(id)).key; return key === 'unknown' || key.endsWith(':unknown'); }).length,
      conflicts: attributionConflicts,
      firstObservedPaidOrders: [...paidOrderIds].reduce<Record<string, number>>((counts, id) => {
        const key = acquisitionKey(snapshot(orderMap.get(id)?.acquisitionV2)?.firstObserved);
        counts[key] = (counts[key] || 0) + 1; return counts;
      }, {}),
    },
    moneyByCurrency, exceptions, postalStages, journey: JOURNEY.map((name,i) => ({ name, observedSessions: stageSets[i].size, evidenceQueryRef: evidenceQueryRef(name) })), channels: [...channels.values()],
    quality: {
      classificationUnresolved: unknownCapture.length, unmatchedCaptures, immatureSessions: immature, missingPrerequisites,
      excludedByClassification,
      eligibleSessions: entries.size, convertingSessions: converted.size,
      costCoverage: cohortOrders.length ? coveredActual / cohortOrders.length : null,
      spendCoverage: sourceCount ? [...channels.values()].filter(c => c.spendMinor !== null).length / sourceCount : null,
      providerReconciliation: 'not_measured', flags: qualityFlags,
    },
    evidence: {
      money: financial.map(f => ({ id:f.factId, orderId:f.orderId, kind:f.kind, amountMinor:f.amountMinor, currency:f.currency, verification:f.verification, effectiveAt:f.effectiveAt, classification:classify(f.classification) })),
      events: events.filter(e => e.sessionId && entries.has(e.sessionId)).map(e => {
        const linkedOrders = sessionOrders.get(e.sessionId!) || [];
        return { id:e.eventId,eventName:e.eventName,sessionId:e.sessionId,orderId:e.orderId || (linkedOrders.length === 1 ? linkedOrders[0].id : undefined),occurredAt:e.occurredAt,receivedAt:e.receivedAt };
      }),
      postal: visiblePostal.map(p => ({ id:p.factId,orderId:p.orderId,state:p.state,lobMode:p.lobMode,occurredAt:p.occurredAt })),
    },
  };
}
export type ConsoleReport = ReturnType<typeof computeReport>;
