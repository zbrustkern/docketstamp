import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReport, type ReportInput, type FactRow } from '../lib/admin-console/reporting/compute';
import { observeAcquisition, PILOT_CAMPAIGN, PILOT_KEY } from '../lib/acquisition';
const at='2026-11-10T12:00:00.000Z';
const touch=observeAcquisition({ search:`?utm_source=google&utm_medium=cpc&utm_campaign=${PILOT_CAMPAIGN}`,origin:'https://docketstamp.com',sessionId:'s1',surface:'notice_workspace',now:Date.parse(at),touchId:'touch_1' }).touch!;
const snapshot={schemaVersion:2 as const,firstObserved:touch,currentSession:touch,persistence:'persistent' as const,missingReasons:[]};
const fact=(id:string,kind:string,amountMinor:number,effectiveAt=at):FactRow=>({factId:id,orderId:'o1',kind,amountMinor,effectiveAt,receivedAt:effectiveAt,environment:'production',currency:'USD',verification:'verified',providerMode:'live',classification:{primary:'customer'}});
const input:ReportInput={scope:{startUtc:'2026-11-10T06:00:00.000Z',endUtcExclusive:'2026-11-11T06:00:00.000Z',displayTimezone:'America/Chicago',environment:'production',classification:'customer',reportVersion:2,cohortPolicyVersion:2,channel:PILOT_KEY},asOf:'2026-11-25T12:00:00.000Z',facts:[fact('capture','capture',1995)],events:[],orders:[{id:'o1',status:'PAYMENT_RECEIVED',environment:'production',sessionId:'s1',acquisitionV2:snapshot}],postal:[],costs:[{id:'supplier',environment:'production',currency:'USD',orderId:'o1',kind:'supplier',amountMinor:818,effectiveAt:at,sourceRef:'invoice_1',authority:'actual',coverage:'complete'},{id:'processor',environment:'production',currency:'USD',orderId:'o1',kind:'processor',amountMinor:88,effectiveAt:at,sourceRef:'stripe_1',authority:'actual',coverage:'complete'},{id:'spend',environment:'production',currency:'USD',kind:'spend',amountMinor:300,effectiveAt:'2026-11-10T06:00:00.000Z',sourceRef:'google_export_1',authority:'actual',coverage:'complete',campaignKey:PILOT_KEY,coverageStartUtc:'2026-11-10T06:00:00.000Z',coverageEndUtc:'2026-11-11T06:00:00.000Z'}],sourceComplete:true,generationId:'f'.repeat(32),openObligations:[]};

test('frozen acquisition attributes a paid order without inventing a browser session or funnel stages',()=>{
  const report=computeReport(input);
  assert.equal(report.metrics.paidOrders.value,1);
  assert.equal(report.metrics.conversion.value,null);
  assert.equal(report.channels[0].paidOrders,1);
  assert.equal(report.channels[0].sessions,0);
  assert.equal(report.metrics.contributionAfterAcquisition.value,789);
  assert.equal(report.attribution.orderSnapshots,1);
  assert.deepEqual(report.attribution.firstObservedPaidOrders,{[PILOT_KEY]:1});
});

test('later refunds and provider processor fees reconcile once; duplicates and postal state do not change cash',()=>{
  const refunded={...input,facts:[...input.facts,fact('refund','refund',500,'2026-11-24T12:00:00.000Z'),fact('fee','processor_fee',95)]};
  const report=computeReport(refunded);
  assert.equal(report.metrics.netCollections.value,1995,'cash period excludes the later refund');
  assert.equal(report.metrics.contributionAfterAcquisition.value,282,'cohort includes later refund and provider fee instead of duplicate imported fee');
  const replay=computeReport({...refunded,facts:[...refunded.facts,...refunded.facts],costs:[...input.costs!,...input.costs!]});
  assert.equal(replay.metrics.contributionAfterAcquisition.value,282);
});

test('snapshot wins over stale entry but conflict blocks economics; missing campaign never becomes pilot',()=>{
  const event={eventId:'e1',eventName:'entry_viewed',environment:'production',occurredAt:at,receivedAt:at,sessionId:'s1',classification:'customer',acquisition:{original:{source:'direct',medium:'none'}}};
  const conflict=computeReport({...input,events:[event]});
  assert.equal(conflict.metrics.paidOrders.value,1);
  assert.equal(conflict.metrics.costPerAttributableOrder.value,null);
  assert.equal(conflict.attribution.conflicts,1);
  const unknown={...snapshot,currentSession:{...touch,campaignId:undefined,platformCampaignId:undefined}};
  const report=computeReport({...input,orders:[{...input.orders[0],acquisitionV2:unknown}]});
  assert.equal(report.metrics.paidOrders.value,0);
  assert.equal(report.metrics.costPerAttributableOrder.value,null);
  assert.ok(report.quality.flags.includes('CHANNEL_ATTRIBUTION_INCOMPLETE'));
});

test('incomplete spend or costs never produces a profitable acquisition claim',()=>{
  assert.equal(computeReport({...input,sourceComplete:false}).metrics.costPerAttributableOrder.value,null);
  assert.equal(computeReport({...input,costs:input.costs!.filter(c=>c.kind!=='supplier')}).metrics.contributionAfterAcquisition.value,null);
  assert.equal(computeReport({...input,costs:input.costs!.map(c=>c.kind==='spend'?{...c,coverage:'partial' as const}:c)}).metrics.costPerAttributableOrder.value,null);
  const none=computeReport({...input,facts:[],orders:[],costs:input.costs!.filter(c=>c.kind==='spend')});
  assert.equal(none.channels[0].paidOrders,0);
  assert.equal(none.channels[0].spendMinor,300);
  assert.equal(none.metrics.costPerAttributableOrder.value,null);
});

test('spend intervals must cover the cohort; an incomplete day cannot produce CAC',()=>{
  const gap=computeReport({...input,costs:input.costs!.map(c=>c.kind==='spend'?{...c,coverageEndUtc:'2026-11-10T18:00:00.000Z'}:c)});
  assert.equal(gap.metrics.observedSpend.value,300);
  assert.equal(gap.metrics.acquisitionSpend.value,null);
  assert.equal(gap.metrics.costPerAttributableOrder.value,null);
});
