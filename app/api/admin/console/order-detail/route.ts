import {NextRequest,NextResponse} from 'next/server';
import {firestoreDb} from '@/lib/firebase-admin';
import {beginCommand,finishCommand} from '@/lib/admin-console/commands/audit';
import {AdminAccessError,serverEnvironment} from '@/lib/admin-console/commands/access';
export async function POST(req:NextRequest){
  let auditId:string|undefined;
  try{
    const body=await req.json();
    if(!/^[A-Za-z0-9_:-]{1,128}$/.test(body.orderId))throw new AdminAccessError(400,'ORDER_ID_INVALID');
    const command=await beginCommand(req,{capability:'evidence.private',action:'order.reveal',targetType:'order',targetId:body.orderId,requestId:body.requestId,reason:body.reason,effectSummary:'Reveal protected order evidence; no supplier request or fulfillment'});
    auditId=command.auditId;
    const order=await firestoreDb.collection('orders').doc(body.orderId).get();
    if(!order.exists)throw new AdminAccessError(404,'ORDER_NOT_FOUND');
    const o=order.data()!;
    if(o.environment&&o.environment!==serverEnvironment())throw new AdminAccessError(403,'ENVIRONMENT_SCOPE_DENIED');
    const [money,postal,attempts]=await Promise.all([firestoreDb.collection('payment_facts_v1').where('orderId','==',body.orderId).limit(100).get(),firestoreDb.collection('postal_facts_v1').where('orderId','==',body.orderId).limit(100).get(),firestoreDb.collection('dispatch_attempts_v1').where('orderId','==',body.orderId).limit(100).get()]);
    const {viewToken,documentHtml,frozen_html_payload,...summary}=o;
    // Private letter content requires a deliberate reveal, never a table response.
    const detail={...summary,...(body.revealDocument===true?{documentHtml:documentHtml||frozen_html_payload}:{}),statusTokenPresent:Boolean(viewToken),environmentEvidence:o.environment?'recorded':'legacy_unknown'};
    const result={order:detail,money:money.docs.map(d=>d.data()),postal:postal.docs.map(d=>d.data()),attempts:attempts.docs.map(d=>d.data()),evidenceLimit:100};
    await finishCommand(auditId,'succeeded','EVIDENCE_REVEALED');
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){if(auditId)await finishCommand(auditId,'failed','EVIDENCE_DENIED');return NextResponse.json({error:error instanceof AdminAccessError?error.code:'ORDER_DETAIL_UNAVAILABLE'},{status:error instanceof AdminAccessError?error.status:503});}
}
