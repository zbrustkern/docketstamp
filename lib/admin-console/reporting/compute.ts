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
export interface PostalRow {
  factId: string; orderId: string; state: string; lobMode: string; environment?: string; occurredAt: string; receivedAt: string;
}
export interface CostRow { id: string; environment: string; currency: string; orderId?: string; kind: 'supplier' | 'processor' | 'spend'; amountMinor: number; effectiveAt: string; sourceRef: string; authority?: 'actual'|'estimated'; coverage: 'complete' | 'partial'; campaignKey?: string }
export interface ReportInput {
  scope: ReportScope; asOf: string; facts: FactRow[]; events: EventRow[]; orders: OrderRow[];
  postal: PostalRow[]; costs?: CostRow[]; sourceComplete: boolean; generationId: string;
}
export const JOURNEY = ['entry_viewed', 'notice_selected', 'details_ready', 'signature_adopted', 'document_locked', 'payment_attempted', 'payment_verified', 'fulfillment_accepted'] as const;
const time = (v: string) => Date.parse(v);
const day = 86400000;
const classify = (value: string | { primary: string } | undefined) => typeof value === 'string' ? value : value?.primary || 'unresolved';

export function computeReport(input: ReportInput) {
  const scope = ScopeSchema.parse(input.scope);
  const start = time(scope.startUtc), end = time(scope.endUtcExclusive), now = time(input.asOf);
  const inWindow = (at: string) => time(at) >= start && time(at) < end;
  const sameEnvironment = (row: { environment?: string }) => row.environment === scope.environment;
  if (!scope.environment) throw new Error('Report environment must be explicit');
  const orderMap = new Map(input.orders.map(o => [o.id, o]));
  const orderMatches = (orderId?: string) => {
    const order = orderId ? orderMap.get(orderId) : undefined;
    if (scope.noticeId && order?.noticeId !== scope.noticeId && order?.noticeType !== scope.noticeId) return false;
    const tiers: Record<string, string> = { FIRST_CLASS: 'first_class', CERTIFIED: 'certified', CERTIFIED_RETURN_RECEIPT: 'certified_return_receipt' };
    return !scope.tier || tiers[order?.serviceLevel || ''] === scope.tier;
  };
  const allFacts = [...new Map(input.facts.map(f => [f.factId, f])).values()].filter(f => sameEnvironment(f) && f.verification === 'verified' && Number.isSafeInteger(f.amountMinor) && f.amountMinor >= 0 && time(f.receivedAt) <= now);
  const desiredClass = scope.classification || 'customer';
  const classFacts = allFacts.filter(f => classify(f.classification) === desiredClass && orderMatches(f.orderId));
  const financial = classFacts.filter(f => inWindow(f.effectiveAt) && f.providerMode === "live");
  const captures = financial.filter(f => f.kind === 'capture' && f.providerMode === 'live' && f.amountMinor > 0);
  const paidOrderIds = new Set(captures.map(f => f.orderId).filter(Boolean) as string[]);
  const allCaptures = classFacts.filter(f => f.kind === 'capture' && f.providerMode === 'live' && f.amountMinor > 0);
  const unknownCapture = allFacts.filter(f => f.kind === 'capture' && classify(f.classification) === 'unresolved');
  const moneyByCurrency: Record<string, number> = {};
  for (const f of financial.filter(f => f.providerMode === 'live')) {
    const sign = f.kind === 'capture' || f.kind === 'dispute_reversal' ? 1 : f.kind === 'refund' || f.kind === 'dispute_debit' ? -1 : 0;
    moneyByCurrency[f.currency] = (moneyByCurrency[f.currency] || 0) + sign * f.amountMinor;
  }
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
  const converted = new Set<string>();
  let unmatchedCaptures = 0;
  for (const f of allCaptures) {
    const order = f.orderId ? orderMap.get(f.orderId) : undefined;
    const sid = order?.sessionId || order?.telemetrySessionId;
    const entry = sid ? entries.get(sid) : undefined;
    if (entry && time(f.effectiveAt) >= time(entry.occurredAt) && time(f.effectiveAt) < time(entry.occurredAt) + 7 * day) converted.add(sid!);
    else if (inWindow(f.effectiveAt)) unmatchedCaptures++;
  }
  const postal = [...new Map(input.postal.map(p => [p.factId,p])).values()].filter(p => sameEnvironment(p) && time(p.receivedAt) <= now);
  const latestPostal = new Map<string, PostalRow>();
  for (const p of postal.sort((a,b) => time(a.occurredAt)-time(b.occurredAt) || a.factId.localeCompare(b.factId))) latestPostal.set(p.orderId,p);
  const acceptedStates = new Set(['accepted_by_lob','mailed','in_transit','delivered','returned']);
  const accepted = (id: string) => { const p = latestPostal.get(id); return Boolean(p && p.lobMode === 'live' && acceptedStates.has(p.state)); };
  const paidAccepted = [...paidOrderIds].filter(accepted).length;
  const exceptions: Array<{orderId: string; reason: string; priority: number; ageSeconds: number; evidenceRef: string}> = [];
  for (const orderId of new Set(allCaptures.map(f=>f.orderId).filter(Boolean) as string[])) {
    if (!accepted(orderId)) {
      const fact = allCaptures.find(f=>f.orderId===orderId)!;
      const p=latestPostal.get(orderId);
      exceptions.push({ orderId, reason: p?.lobMode === 'mock' ? 'LIVE_PAYMENT_SIMULATED_POSTAL' : p?.state === 'uncertain' ? 'SUBMISSION_UNCERTAIN' : 'PAID_NOT_ACCEPTED', priority: p?.lobMode === 'mock' ? 0 : 1, ageSeconds: Math.max(0,Math.floor((now-time(fact.effectiveAt))/1000)), evidenceRef: fact.factId });
    }
  }
  exceptions.sort((a,b)=>a.priority-b.priority || b.ageSeconds-a.ageSeconds);
  const stageSets = JOURNEY.map(()=>new Set<string>());
  let missingPrerequisites=0;
  for (const [sid,entry] of entries) {
    const observed=events.filter(e=>e.sessionId===sid && time(e.occurredAt)>=time(entry.occurredAt) && time(e.occurredAt)<time(entry.occurredAt)+7*day).sort((a,b)=>time(a.occurredAt)-time(b.occurredAt));
    let prior=-1;
    for (const e of observed) {
      const stage=JOURNEY.indexOf(e.eventName as typeof JOURNEY[number]);
      if(stage<0) continue;
      stageSets[stage].add(sid);
      if(stage>prior+1) missingPrerequisites++;
      if(stage===prior+1) prior=stage;
    }
  }
  // Authority facts contribute only to their own milestones, never prior stages.
  for(const sid of converted) stageSets[6].add(sid);
  for(const f of allCaptures) {
    const o=f.orderId ? orderMap.get(f.orderId):undefined; const sid=o?.sessionId||o?.telemetrySessionId;
    if(sid && entries.has(sid) && f.orderId && accepted(f.orderId)) stageSets[7].add(sid);
  }
  const immature=[...entries.values()].filter(e=>now<time(e.occurredAt)+7*day).length;
  const validTimes=[...allFacts.map(f=>time(f.receivedAt)),...events.map(e=>time(e.receivedAt)),...postal.map(p=>time(p.receivedAt))].filter(Number.isFinite);
  const watermark=validTimes.length ? new Date(Math.max(...validTimes)).toISOString():null;
  const qualityFlags=['OBSERVED_BROWSER_COVERAGE_UNKNOWN', 'PROVIDER_RECONCILIATION_NOT_MEASURED', 'LEGACY_RECORDS_NOT_BACKFILLED', ...(input.sourceComplete ? []:['SOURCE_SCAN_PARTIAL']), ...(immature ? ['IMMATURE_COHORT']:[]), ...(watermark && now-time(watermark)>900000 ? ['STALE_EVIDENCE']:[])];
  const exclusions: Record<string,number>={unresolvedCaptures:unknownCapture.length, unmatchedCaptures};
  const evidenceQueryRef=(metric:string)=>`/api/admin/console/evidence?generationId=${input.generationId}&metric=${metric}`;
  const metric=(key:string,value:number|null,unit:'count'|'ratio'|'money_minor',evidenceClass:'verified'|'observed'|'unavailable',extra:Record<string,unknown>={})=>MetricSchema.parse({key,value,unit,evidenceClass,source:['payment_facts_v1','business_events_v1','postal_facts_v1'],definitionVersion:1,scope,asOf:input.asOf,watermark,completeness:input.sourceComplete ? (watermark && now-time(watermark)>900000 ? 'stale':'complete_within_scope'):'partial',exclusions,qualityFlags,evidenceQueryRef:evidenceQueryRef(key),...extra});
  type ChannelRow={key:string;sessions:number;convertingSessions:number;paidOrders:number;netCollectionsMinor:number|null;spendMinor:number|null;contributionMinor:number|null;joinCoverage:number|null};
  const channels=new Map<string,ChannelRow>();
  const sourceKey=(e:EventRow)=>{const t=e.acquisition?.original;return t?.campaignId ? `${t.source||'unknown'}:${t.medium||'unknown'}:${t.campaignId}`:t?.source||'unknown';};
  for(const [sid,e] of entries){const key=sourceKey(e);const row=channels.get(key)||{key,sessions:0,convertingSessions:0,paidOrders:0,netCollectionsMinor:null,spendMinor:null,contributionMinor:null,joinCoverage:null};row.sessions++;if(converted.has(sid))row.convertingSessions++;channels.set(key,row);}
  const actualCosts=(input.costs||[]).filter(c=>c.environment===scope.environment&&c.authority==='actual'&&c.coverage==='complete'&&c.currency==='USD'&&inWindow(c.effectiveAt));
  for(const row of channels.values()){
    const sessions=new Set([...entries].filter(([,e])=>sourceKey(e)===row.key).map(([sid])=>sid));
    const channelOrderIds=new Set([...paidOrderIds].filter(id=>{const o=orderMap.get(id);return sessions.has(o?.sessionId||o?.telemetrySessionId||'');}));
    row.paidOrders=channelOrderIds.size;
    const relevant=financial.filter(f=>f.orderId&&channelOrderIds.has(f.orderId));
    row.netCollectionsMinor=relevant.some(f=>f.currency!=='USD')?null:relevant.reduce((sum,f)=>sum+(f.kind==='capture'||f.kind==='dispute_reversal'?1:f.kind==='refund'||f.kind==='dispute_debit'?-1:0)*f.amountMinor,0);
    const spend=actualCosts.filter(c=>c.kind==='spend'&&c.campaignKey===row.key);
    row.spendMinor=spend.length?spend.reduce((sum,c)=>sum+c.amountMinor,0):null;
    const costs=actualCosts.filter(c=>c.orderId&&channelOrderIds.has(c.orderId)&&c.kind!=='spend');
    const covered=[...channelOrderIds].every(id=>costs.some(c=>c.orderId===id&&c.kind==='supplier')&&costs.some(c=>c.orderId===id&&c.kind==='processor'));
    row.contributionMinor=channelOrderIds.size&&covered&&row.netCollectionsMinor!==null?row.netCollectionsMinor-costs.reduce((sum,c)=>sum+c.amountMinor,0):null;
    const joined=allCaptures.filter(f=>f.orderId&&channelOrderIds.has(f.orderId)).length;
    row.joinCoverage=row.paidOrders?Math.min(1,joined/row.paidOrders):null;
  }

  return {
    generationId:input.generationId,scope,asOf:input.asOf,watermark,sourceComplete:input.sourceComplete,
    metrics:{ paidOrders:metric('paid_orders',paidOrderIds.size,'count','verified'), netCollections:metric('net_collections',Object.keys(moneyByCurrency).length>1?null:moneyByCurrency.USD??(financial.length?null:0),'money_minor',Object.keys(moneyByCurrency).length>1?'unavailable':'verified',{currency:'USD'}), accepted:metric('postal_acceptance',paidOrderIds.size?paidAccepted/paidOrderIds.size:null,'ratio',paidOrderIds.size?'verified':'unavailable',{numerator:paidAccepted,denominator:paidOrderIds.size}), conversion:metric('paid_session_conversion',entries.size?converted.size/entries.size:null,'ratio',entries.size?'observed':'unavailable',{numerator:converted.size,denominator:entries.size}), urgent:metric('open_obligations',exceptions.length,'count','verified') },
    moneyByCurrency, exceptions, journey:JOURNEY.map((name,i)=>({name,observedSessions:stageSets[i].size,evidenceQueryRef:evidenceQueryRef(name)})), channels:[...channels.values()],
    quality:{classificationUnresolved:unknownCapture.length,unmatchedCaptures,immatureSessions:immature,missingPrerequisites,eligibleSessions:entries.size,convertingSessions:converted.size,costCoverage:null,spendCoverage:null,providerReconciliation:'not_measured',flags:qualityFlags},
    evidence:{ money:financial.map(f=>({id:f.factId,orderId:f.orderId,kind:f.kind,amountMinor:f.amountMinor,currency:f.currency,verification:f.verification,effectiveAt:f.effectiveAt,classification:classify(f.classification)})),events:events.filter(e=>e.sessionId&&entries.has(e.sessionId)).map(e=>({id:e.eventId,eventName:e.eventName,sessionId:e.sessionId,occurredAt:e.occurredAt,receivedAt:e.receivedAt})), postal:postal.map(p=>({id:p.factId,orderId:p.orderId,state:p.state,lobMode:p.lobMode,occurredAt:p.occurredAt})) },
  };
}
export type ConsoleReport = ReturnType<typeof computeReport>;
