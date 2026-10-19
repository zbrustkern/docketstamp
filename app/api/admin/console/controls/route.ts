import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { ClassificationSchema } from '@/lib/admin-console/contracts';
import { getFeatureFlagsState, updateFeatureFlag } from '@/lib/feature-flags';

const registry = [{key:'ceoConsoleV1',consumer:null,effect:'Reserved for S7; no active console consumer yet',active:false},{key:'reworkV3Experience',consumer:null,effect:'Historical flag; no active notice-page consumer',active:false}];
const collections={decisions:'business_decisions_v1',costs:'cost_records_v1',classifications:'identity_classifications_v1'};
export async function GET(req:NextRequest){
  try{
    requireCapability(req,'reports.read');
    const environment=serverEnvironment();
    const [flags,decisions,costs]=await Promise.all([getFeatureFlagsState(),firestoreDb.collection(collections.decisions).where('environment','==',environment).orderBy('createdAt','desc').limit(50).get(),firestoreDb.collection(collections.costs).where('environment','==',environment).orderBy('effectiveAt','desc').limit(50).get()]);
    return NextResponse.json({environment,flags,registry,decisions:decisions.docs.map(d=>d.data()),costs:costs.docs.map(d=>d.data()),sampleLimit:50},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof AdminAccessError?error.code:'CONTROLS_UNAVAILABLE'},{status:error instanceof AdminAccessError?error.status:503});}
}
export async function POST(req:NextRequest){
  let auditId:string|undefined;
  try{
    const body=await req.json(),environment=serverEnvironment();
    const actions=['set_flag','record_decision','record_cost','classify_order'];
    if(!actions.includes(body.action))throw new AdminAccessError(400,'CONTROL_ACTION_INVALID');
    const targetId=String(body.orderId||body.flagKey||body.requestId||'');
    const command=await beginCommand(req,{capability:'controls.manage',action:body.action,targetType:'console_control',targetId,requestId:body.requestId,reason:body.reason,effectSummary:'Record scoped configuration or evidence; no external financial/postal action'});
    auditId=command.auditId;
    if(command.duplicate)return NextResponse.json({duplicate:true,status:command.status});
    const now=new Date().toISOString();
    if(body.action==='set_flag'){
      const entry=registry.find(f=>f.key===body.flagKey&&f.active);
      if(!entry||typeof body.enabled!=='boolean')throw new AdminAccessError(400,'FLAG_HAS_NO_ACTIVE_CONSUMER');
      const current=await getFeatureFlagsState();
      if((current.updatedAt||0)!==body.expectedVersion)throw new AdminAccessError(409,'STALE_VERSION');
      await updateFeatureFlag(entry.key,body.enabled,command.actor.actorId);
    }else if(body.action==='record_decision'){
      const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max?v.trim():null;
      const hypothesis=text(body.hypothesis,240),primaryMetric=text(body.primaryMetric,80),guardrail=text(body.guardrail,240);
      if(!hypothesis||!primaryMetric||!guardrail||!Number.isFinite(Date.parse(body.evaluateAt)))throw new AdminAccessError(400,'DECISION_INVALID');
      await firestoreDb.collection(collections.decisions).doc(body.requestId).set({id:body.requestId,environment,hypothesis,primaryMetric,guardrail,evaluateAt:body.evaluateAt,owner:command.actor.actorId,status:'planned',createdAt:now,auditId});
    }else if(body.action==='record_cost'){
      if(!['supplier','processor','spend'].includes(body.kind)||!Number.isSafeInteger(body.amountMinor)||body.amountMinor<0||!Number.isFinite(Date.parse(body.effectiveAt))||!/^[A-Z]{3}$/.test(body.currency)||!['actual','estimated'].includes(body.authority)||!['complete','partial'].includes(body.coverage)||typeof body.sourceRef!=='string'||body.sourceRef.length<3||body.sourceRef.length>240)throw new AdminAccessError(400,'COST_RECORD_INVALID');
      await firestoreDb.collection(collections.costs).doc(body.requestId).set(sanitizeFirestoreData({id:body.requestId,environment,kind:body.kind,amountMinor:body.amountMinor,currency:body.currency,effectiveAt:body.effectiveAt,sourceRef:body.sourceRef,authority:body.authority,coverage:body.coverage,orderId:body.orderId,campaignKey:body.campaignKey,createdAt:now,auditId}));
    }else{
      const primary=ClassificationSchema.parse(body.classification);
      const order=await firestoreDb.collection('orders').doc(targetId).get();
      if(!order.exists)throw new AdminAccessError(404,'ORDER_NOT_FOUND');
      if(order.data()?.environment&&order.data()?.environment!==environment)throw new AdminAccessError(403,'ENVIRONMENT_SCOPE_DENIED');
      const id=crypto.createHash('sha256').update(`${environment}:${targetId}`).digest('hex');
      const ref=firestoreDb.collection(collections.classifications).doc(id);
      await firestoreDb.runTransaction(async tx=>{
        const prior=await tx.get(ref);
        if((prior.data()?.version||0)!==body.expectedVersion)throw new AdminAccessError(409,'STALE_VERSION');
        tx.set(ref,{id,environment,orderId:targetId,primary,version:(prior.data()?.version||0)+1,policyVersion:1,evidenceRef:auditId,classifiedAt:now,actor:command.actor.actorId});
      });
    }
    await finishCommand(auditId,'succeeded','CONTROL_RECORDED');
    return NextResponse.json({success:true,auditId});
  }catch(error){if(auditId)await finishCommand(auditId,'failed','CONTROL_FAILED');return NextResponse.json({error:error instanceof AdminAccessError?error.code:'CONTROL_INVALID'},{status:error instanceof AdminAccessError?error.status:400});}
}
