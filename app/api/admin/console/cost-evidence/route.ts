import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { CostEvidenceSchema, costEvidenceId } from '@/lib/admin-console/reporting/cost-evidence';
import { localDateKey } from '@/lib/admin-console/reporting/scope';
import { getRegisteredCampaign } from '@/lib/admin-console/advertising/campaigns';
const schema = z.object({requestId:z.string().min(8).max(128),reason:z.string().min(8).max(240),records:z.array(CostEvidenceSchema).min(1).max(100)}).strict();
export async function POST(req:NextRequest) {
  let auditId:string|undefined;
  try {
    requireCapability(req,'controls.manage');
    const text=await req.text();
    if(Buffer.byteLength(text)>65536)return NextResponse.json({error:'BODY_TOO_LARGE'},{status:413});
    const body=schema.parse(JSON.parse(text));
    const environment=serverEnvironment();
    const command=await beginCommand(req,{capability:'controls.manage',action:'reports.import_cost_evidence',targetType:'report',targetId:`${environment}:${crypto.createHash('sha256').update(JSON.stringify(body.records)).digest('hex')}`,requestId:body.requestId,reason:body.reason,effectSummary:'First-party costs and spend only; no payment, dispatch, email or advertising changes'});
    auditId=command.auditId;
    if(command.duplicate)return NextResponse.json({duplicate:true,status:command.status});
    const importedAt=new Date().toISOString();
    const rows=body.records.map(row=>({...row,environment,id:costEvidenceId(row,environment),receivedAt:importedAt}));
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('DUPLICATE_EVIDENCE');
    let priorExistsForResult:boolean[]=[];
    await firestoreDb.runTransaction(async tx=>{
      const refs=rows.map(row=>firestoreDb.collection('cost_records_v1').doc(row.id));
      const prior=await Promise.all(refs.map(ref=>tx.get(ref)));
      priorExistsForResult=prior.map(doc=>doc.exists);
      const campaigns=[...new Set(rows.filter(r=>r.kind==='spend').map(r=>r.campaignKey!))];
      const existingSpend=await Promise.all(campaigns.map(campaignKey=>tx.get(firestoreDb.collection('cost_records_v1').where('environment','==',environment).where('kind','==','spend').where('campaignKey','==',campaignKey))));
      const existingRows=existingSpend.flatMap(snapshot=>snapshot.docs.map(doc=>doc.data()));
      const orderCostPairs=[...new Map(rows.filter(r=>r.kind!=='spend').map(r=>[`${r.orderId}:${r.kind}`,{orderId:r.orderId!,kind:r.kind}])).values()];
      const existingOrderCosts=await Promise.all(orderCostPairs.map(pair=>tx.get(firestoreDb.collection('cost_records_v1').where('environment','==',environment).where('orderId','==',pair.orderId).where('kind','==',pair.kind))));
      const allExistingCostRows=[...existingRows,...existingOrderCosts.flatMap(snapshot=>snapshot.docs.map(doc=>doc.data()))];
      const orderIds=[...new Set(rows.flatMap(row=>row.orderId?[row.orderId]:[]))];
      const orders=await Promise.all(orderIds.map(id=>tx.get(firestoreDb.collection('orders').doc(id))));
      if(orders.some(doc=>!doc.exists))throw Error('ORDER_NOT_FOUND');
      if(orders.some(doc=>doc.data()?.environment!==environment))throw Error('ORDER_ENVIRONMENT_MISMATCH');
      const freshRows=rows.filter((row,i)=>!prior[i].exists);
      for(const row of rows.filter(r=>r.kind!=='spend')){
        const matches=allExistingCostRows.filter(old=>old.kind===row.kind&&old.orderId===row.orderId&&old.sourceRef===row.sourceRef);
        const maxRevision=Math.max(0,...matches.map(old=>Number(old.revision)||1));
        const exactExisting=prior[rows.indexOf(row)].exists;
        if(!exactExisting&&row.revision!==maxRevision+1)throw Error('REVISION_NOT_NEXT');
      }
      for(const row of rows.filter(r=>r.kind==='spend')){
        const start=Date.parse(row.coverageStartUtc!),end=Date.parse(row.coverageEndUtc!);
        const intervalRows=existingRows.filter(old=>old.campaignKey===row.campaignKey && old.coverageStartUtc && old.coverageEndUtc && Date.parse(old.coverageStartUtc)===start);
        const maxRevision=Math.max(0,...intervalRows.map(old=>Number(old.revision)||1));
        const exactExisting=prior[rows.indexOf(row)].exists;
        if(!exactExisting && row.revision!==maxRevision+1)throw Error('REVISION_NOT_NEXT');
        const overlap=existingRows.some(old=>old.campaignKey===row.campaignKey && old.coverageStartUtc && old.coverageEndUtc && Date.parse(old.coverageStartUtc)!==start && Date.parse(old.coverageStartUtc)<end && Date.parse(old.coverageEndUtc)>start);
        if(overlap)throw Error('SPEND_INTERVAL_OVERLAP');
      }
      const newIntervals=freshRows.filter(r=>r.kind==='spend');
      for(let i=0;i<newIntervals.length;i++)for(let j=i+1;j<newIntervals.length;j++){
        const a=newIntervals[i],b=newIntervals[j];
        if(a.campaignKey===b.campaignKey && Date.parse(a.coverageStartUtc!)<Date.parse(b.coverageEndUtc!) && Date.parse(b.coverageStartUtc!)<Date.parse(a.coverageEndUtc!))throw Error('SPEND_INTERVAL_OVERLAP');
      }
      for(const [i,row]of rows.entries()){
        if(Date.parse(row.effectiveAt)>Date.now() || (row.coverageEndUtc && Date.parse(row.coverageEndUtc)>Date.now()))throw Error('FUTURE_EVIDENCE');
        if(prior[i].exists){
          const existing=prior[i].data()!;
          if(Object.entries(row).some(([key,value])=>key==='receivedAt'?false:(key!=='revision' || existing.revision!==undefined ? existing[key]!==value : value!==1)))throw Error('EVIDENCE_CONFLICT');
        } else tx.create(refs[i],sanitizeFirestoreData(row));
      }
    });
    await finishCommand(auditId,'succeeded','COST_EVIDENCE_IMPORTED');
    const spend=rows.filter(row=>row.kind==='spend');
    const days=[...new Set(spend.map(row=>localDateKey(new Date(row.coverageStartUtc!), getRegisteredCampaign(row.campaignKey!)?.timezone || 'UTC')))].sort();
    const missingDates:string[]=[];
    for(let i=1;i<days.length&&missingDates.length<100;i++){let next=new Date(`${days[i-1]}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);while(next.toISOString().slice(0,10)<days[i]&&missingDates.length<100){missingDates.push(next.toISOString().slice(0,10));next.setUTCDate(next.getUTCDate()+1);}}
    return NextResponse.json({accepted:rows.length,sourceDates:days,importedTotalMinor:rows.reduce((sum,row)=>sum+row.amountMinor,0),spendTotalMinor:spend.reduce((sum,row)=>sum+row.amountMinor,0),currency:'USD',duplicates:rows.filter((_,i)=>priorExistsForResult[i]).length,corrections:rows.filter(row=>row.revision>1).length,missingDates});
  } catch(error) {
    if(auditId)await finishCommand(auditId,'failed','COST_EVIDENCE_REJECTED');
    return NextResponse.json({error:error instanceof AdminAccessError?error.code:error instanceof z.ZodError?'INVALID_COST_EVIDENCE':error instanceof Error && ['FUTURE_EVIDENCE','EVIDENCE_CONFLICT','ORDER_NOT_FOUND','ORDER_ENVIRONMENT_MISMATCH','DUPLICATE_EVIDENCE','REVISION_NOT_NEXT','SPEND_INTERVAL_OVERLAP'].includes(error.message)?error.message:'COST_EVIDENCE_REJECTED'},{status:error instanceof AdminAccessError?error.status:400});
  }
}
