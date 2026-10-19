import {NextRequest,NextResponse} from 'next/server';
import {requireCapability,AdminAccessError,serverEnvironment} from '@/lib/admin-console/commands/access';
import {readEvidence} from '@/lib/admin-console/reporting/store';
export async function GET(req:NextRequest){
  try{
    requireCapability(req,'evidence.private');
    const q=req.nextUrl.searchParams;
    const metric=q.get('metric')||'';
    const kind=q.get('kind')||(['paid_orders','net_collections'].includes(metric)?'money':metric==='open_obligations'?'exceptions':metric==='postal_acceptance'?'postal':'events');
    const evidence=await readEvidence(q.get('generationId')||'',kind,Number(q.get('page')||0));
    if(!evidence)return NextResponse.json({error:'EVIDENCE_NOT_FOUND'},{status:404});
    if(evidence.scope.environment!==serverEnvironment())throw new AdminAccessError(403,'ENVIRONMENT_SCOPE_DENIED');
    return NextResponse.json(evidence,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof AdminAccessError?error.code:'INVALID_EVIDENCE_QUERY'},{status:error instanceof AdminAccessError?error.status:400});}
}
