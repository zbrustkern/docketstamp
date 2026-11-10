import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { CostEvidenceSchema, costEvidenceId } from '@/lib/admin-console/reporting/cost-evidence';
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
    const rows=body.records.map(row=>({...row,environment,id:costEvidenceId(row,environment)}));
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('DUPLICATE_EVIDENCE');
    await firestoreDb.runTransaction(async tx=>{
      const refs=rows.map(row=>firestoreDb.collection('cost_records_v1').doc(row.id));
      const prior=await Promise.all(refs.map(ref=>tx.get(ref)));
      const orderIds=[...new Set(rows.flatMap(row=>row.orderId?[row.orderId]:[]))];
      const orders=await Promise.all(orderIds.map(id=>tx.get(firestoreDb.collection('orders').doc(id))));
      if(orders.some(doc=>!doc.exists))throw Error('ORDER_NOT_FOUND');
      for(const [i,row]of rows.entries()){
        if(Date.parse(row.effectiveAt)>Date.now() || (row.coverage==='complete' && row.coverageEndUtc && Date.parse(row.coverageEndUtc)>Date.now()))throw Error('FUTURE_EVIDENCE');
        if(prior[i].exists){
          const existing=prior[i].data()!;
          if(Object.entries(row).some(([key,value])=>existing[key]!==value))throw Error('EVIDENCE_CONFLICT');
        } else tx.create(refs[i],sanitizeFirestoreData(row));
      }
    });
    await finishCommand(auditId,'succeeded','COST_EVIDENCE_IMPORTED');
    return NextResponse.json({accepted:rows.length});
  } catch(error) {
    if(auditId)await finishCommand(auditId,'failed','COST_EVIDENCE_REJECTED');
    return NextResponse.json({error:error instanceof AdminAccessError?error.code:error instanceof z.ZodError?'INVALID_COST_EVIDENCE':error instanceof Error && ['FUTURE_EVIDENCE','EVIDENCE_CONFLICT','ORDER_NOT_FOUND','DUPLICATE_EVIDENCE'].includes(error.message)?error.message:'COST_EVIDENCE_REJECTED'},{status:error instanceof AdminAccessError?error.status:400});
  }
}
