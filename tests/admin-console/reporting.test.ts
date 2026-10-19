import assert from 'node:assert/strict';
import {computeReport,type FactRow,type EventRow} from '../../lib/admin-console/reporting/compute';
import {calendarScope} from '../../lib/admin-console/reporting/scope';
import {firestoreDb} from '../../lib/firebase-admin';
import {prepareGeneration,publishGeneration,readGeneration,readEvidence,rollbackGeneration} from '../../lib/admin-console/reporting/store';

async function run(){
  const scope={startUtc:'2026-10-12T05:00:00.000Z',endUtcExclusive:'2026-10-20T05:00:00.000Z',environment:'local' as const,displayTimezone:'America/Chicago',classification:'customer' as const,reportVersion:1,cohortPolicyVersion:1};
  const fact=(id:string,orderId:string,amount:number,extra:Partial<FactRow>={}):FactRow=>({factId:id,orderId,environment:'local',currency:'USD',amountMinor:amount,kind:'capture',verification:'verified',providerMode:'live',effectiveAt:'2026-10-18T09:00:00.000Z',receivedAt:'2026-10-18T09:00:01.000Z',classification:{primary:'customer'},...extra});
  const event=(id:string,sessionId:string,name:string,at:string):EventRow=>({eventId:id,eventName:name,environment:'local',sessionId,occurredAt:at,receivedAt:at,classification:'customer',safeProperties:{}});
  const facts=[fact('f1','o1',1295),fact('f2','o2',1995),fact('f3','o3',2795),fact('founder','founder',1995,{classification:{primary:'founder'}}),fact('test','test',1995,{providerMode:'test'}),fact('unknown','unknown',1995,{classification:{primary:'unresolved'}}),fact('refund','o1',500,{kind:'refund'})];
  const events=[event('e1','s1','entry_viewed','2026-10-12T09:00:00.000Z'),event('e2','s2','entry_viewed','2026-10-12T10:00:00.000Z'),event('e3','s1','payment_attempted','2026-10-18T08:00:00.000Z')];
  const orders=[{id:'o1',status:'DELIVERED',environment:'local',sessionId:'s1'},{id:'o2',status:'RETURNED_TO_SENDER',environment:'local',sessionId:'s1'},{id:'o3',status:'QUEUED_FOR_FULFILLMENT',environment:'local',sessionId:'s2'}];
  const postal=[{factId:'p1',orderId:'o1',state:'delivered',lobMode:'live',environment:'local',occurredAt:'2026-10-19T00:00:00.000Z',receivedAt:'2026-10-19T00:00:00.000Z'},{factId:'p2',orderId:'o2',state:'returned',lobMode:'live',environment:'local',occurredAt:'2026-10-19T00:00:00.000Z',receivedAt:'2026-10-19T00:00:00.000Z'}];
  const input={scope,asOf:'2026-10-20T04:00:00.000Z',facts,events,orders,postal,sourceComplete:true,generationId:'a'.repeat(32)};
  const report=computeReport(input);
  assert.equal(report.metrics.paidOrders.value,3);
  assert.equal(report.metrics.netCollections.value,5585);
  assert.equal(report.metrics.conversion.numerator,2);
  assert.equal(report.metrics.conversion.denominator,2);
  assert.equal(report.journey[1].observedSessions,0,'Payment cannot synthesize letter selection');
  assert.equal(report.exceptions.length,1);
  assert.equal(report.exceptions[0].orderId,'o3');
  assert.equal(report.quality.classificationUnresolved,1);
  const changed=computeReport({...input,orders:orders.map(o=>({...o,status:'FAILED'}))});
  assert.equal(changed.metrics.netCollections.value,report.metrics.netCollections.value,'Postal status cannot erase cash');
  const empty=computeReport({...input,facts:[],events:[],orders:[],postal:[]});
  assert.equal(empty.metrics.conversion.value,null);
  assert.equal(empty.metrics.paidOrders.value,0);
  const mixed=computeReport({...input,facts:[...facts,fact('eur','eur',1000,{currency:'EUR'})]});
  assert.equal(mixed.metrics.netCollections.value,null,'No implicit currency combining');
  const dst=calendarScope('local',new Date('2026-11-02T14:00:00.000Z'));
  assert.equal(dst.startUtc,'2026-10-27T05:00:00.000Z');
  assert.equal(dst.endUtcExclusive,'2026-11-03T06:00:00.000Z');

  for(const f of facts)await firestoreDb.collection('payment_facts_v1').doc(f.factId).set(f);
  for(const e of events)await firestoreDb.collection('business_events_v1').doc(e.eventId).set(e);
  for(const o of orders)await firestoreDb.collection('orders').doc(o.id).set(o);
  for(const p of postal)await firestoreDb.collection('postal_facts_v1').doc(p.factId).set(p);
  const a=await prepareGeneration(scope,input.asOf),b=await prepareGeneration(scope,input.asOf);
  assert.equal(a.reportHash,b.reportHash,'Projection replay must be deterministic');
  await publishGeneration(a);
  assert.equal((await readGeneration(scope))?.generationId,a.report.generationId);
  assert.equal((await readEvidence(a.report.generationId,'money'))?.total,4);
  const next=await prepareGeneration(scope,'2026-10-20T04:01:00.000Z');await publishGeneration(next,a.report.generationId);
  assert.equal(await rollbackGeneration(scope,next.report.generationId),a.report.generationId);
  console.log('Reporting oracle, no synthetic milestones, postal-independent money, DST, replay and generation rollback passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
