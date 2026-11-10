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

test('cost revisions supersede their source fact without stacking corrected amounts',()=>{
  const revised=[...input.costs!.filter(c=>c.kind!=='supplier'),
    {...input.costs!.find(c=>c.kind==='supplier')!,id:'supplier-r1',sourceRef:'invoice_1',revision:1,amountMinor:818},
    {...input.costs!.find(c=>c.kind==='supplier')!,id:'supplier-r2',sourceRef:'invoice_1',revision:2,amountMinor:900},
  ];
  const report=computeReport({...input,costs:revised});
  assert.equal(report.metrics.contributionBeforeAcquisition.value,1007,'The revised $9.00 supplier cost replaces the original $8.18 line');
  assert.equal(report.metrics.contributionAfterAcquisition.value,707);
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

test('zero-order spend loss requires a mature provider-reconciled customer cohort',()=>{
  const zero={...input,facts:[],orders:[],events:[],costs:input.costs!.filter(c=>c.kind==='spend')};
  const unverified=computeReport(zero);
  assert.equal(unverified.metrics.acquisitionSpend.value,300);
  assert.equal(unverified.metrics.costPerAttributableOrder.value,null);
  assert.equal(unverified.metrics.contributionAfterAcquisition.value,null,'A full Firestore scan is not provider proof of zero orders');
  const reconciled=computeReport({...zero,paymentCoverageComplete:true});
  assert.equal(reconciled.metrics.contributionAfterAcquisition.value,-300,'Mature, complete provider reconciliation with known spend shows acquisition loss');
  assert.equal(reconciled.channels.find(row=>row.key===PILOT_KEY)?.afterAcquisitionMinor,-300);
  assert.equal(computeReport({...zero,paymentCoverageComplete:true,asOf:'2026-11-13T12:00:00.000Z'}).metrics.contributionAfterAcquisition.value,null,'Immature acquisition windows cannot claim zero orders');
  assert.equal(computeReport({...zero,paymentCoverageComplete:true,scope:{...zero.scope,tier:'certified'}}).metrics.contributionAfterAcquisition.value,null,'Product subsets cannot subtract full campaign spend');
});

test('first-touch assists remain separated from current-session paid order counts',()=>{
  const direct=observeAcquisition({search:'',origin:'https://docketstamp.com',sessionId:'s0',surface:'home',now:Date.parse(at),touchId:'touch_direct'}).touch!;
  const assistedSnapshot={...snapshot,firstObserved:direct,currentSession:touch};
  const report=computeReport({...input,orders:[{...input.orders[0],acquisitionV2:assistedSnapshot}]});
  assert.equal(report.channels.find(row=>row.key===PILOT_KEY)?.paidOrders,1);
  assert.equal(report.attribution.firstTouchAssists.direct,1);
  assert.equal(Object.values(report.attribution.firstTouchAssists).reduce((a,b)=>a+b,0),1,'Assist counts stay outside current-session purchase count');
});

test('spend intervals must cover the cohort; an incomplete day cannot produce CAC',()=>{
  const gap=computeReport({...input,costs:input.costs!.map(c=>c.kind==='spend'?{...c,coverageEndUtc:'2026-11-10T18:00:00.000Z'}:c)});
  assert.equal(gap.metrics.observedSpend.value,300);
  assert.equal(gap.metrics.acquisitionSpend.value,null);
  assert.equal(gap.metrics.costPerAttributableOrder.value,null);
});

test('report rebuild retrieves refunds beyond the acquisition query window',async()=>{
  const {firestoreDb}=await import('../lib/firebase-admin');
  const {prepareGeneration}=await import('../lib/admin-console/reporting/store');
  await firestoreDb.collection('orders').doc('o1').set(input.orders[0]);
  for(const row of [...input.facts,fact('late_refund','refund',500,'2026-11-24T12:00:00.000Z'),fact('actual_fee','processor_fee',95)]) {
    await firestoreDb.collection('payment_facts_v1').doc(row.factId).set(row);
  }
  for(const row of input.costs!) await firestoreDb.collection('cost_records_v1').doc(row.id!).set(row);
  await firestoreDb.collection('orders').doc('legacy_unpaid').set({id:'legacy_unpaid',status:'PENDING_PAYMENT'});
  await firestoreDb.collection('business_events_v1').doc('legacy_lock').set({eventId:'legacy_lock',environment:'production',eventName:'document_locked',emitter:'server',orderId:'legacy_unpaid',occurredAt:at,receivedAt:at});
  const {report}=await prepareGeneration(input.scope,input.asOf);
  assert.equal(report.metrics.contributionAfterAcquisition.value,282);
  assert.equal(report.metrics.netCollections.value,1995);
  assert.equal(report.sourceComplete,true,'server lock scopes legacy unpaid order');
  await firestoreDb.collection('business_events_v1').doc('legacy_lock').set({eventId:'legacy_lock',environment:'production',eventName:'document_locked',emitter:'client',orderId:'legacy_unpaid',occurredAt:at,receivedAt:at});
  assert.equal((await prepareGeneration(input.scope,input.asOf)).report.sourceComplete,false,'client event cannot scope a legacy order');
});
