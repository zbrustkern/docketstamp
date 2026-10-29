import { NextRequest, NextResponse } from 'next/server';
import { requireCapability, AdminAccessError, serverEnvironment } from '@/lib/admin-console/commands/access';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { ScopeSchema } from '@/lib/admin-console/contracts';
import { prepareGeneration, publishGeneration, readGeneration, rollbackGeneration } from '@/lib/admin-console/reporting/store';
import { calendarScope, type CalendarRange } from '@/lib/admin-console/reporting/scope';
function errorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof AdminAccessError ? error.code : 'CONSOLE_REQUEST_FAILED' }, { status: error instanceof AdminAccessError ? error.status : 400 });
}
export async function GET(req: NextRequest) {
  try {
    requireCapability(req,'reports.read');
    const raw=req.nextUrl.searchParams.get('scope');
    const range = req.nextUrl.searchParams.get('range') || '7d';
    const validRange = ['today','yesterday','7d','30d','custom'].includes(range) ? range as CalendarRange : '7d';
    const scope=ScopeSchema.parse(raw ? JSON.parse(raw) : {
      ...calendarScope(serverEnvironment(), new Date(), req.nextUrl.searchParams.get('timezone') || 'America/Chicago', validRange,
        req.nextUrl.searchParams.get('start') || undefined, req.nextUrl.searchParams.get('end') || undefined),
      ...(req.nextUrl.searchParams.get('channel') ? { channel: req.nextUrl.searchParams.get('channel')! } : {}),
      ...(req.nextUrl.searchParams.get('classification') ? { classification: req.nextUrl.searchParams.get('classification')! } : {}),
      ...(req.nextUrl.searchParams.get('noticeId') ? { noticeId: req.nextUrl.searchParams.get('noticeId')! } : {}),
      ...(req.nextUrl.searchParams.get('tier') ? { tier: req.nextUrl.searchParams.get('tier')! } : {}),
      ...(req.nextUrl.searchParams.get('entrySurface') ? { entrySurface: req.nextUrl.searchParams.get('entrySurface')! } : {}),
    });
    if(scope.environment!==serverEnvironment()) throw new AdminAccessError(403,'ENVIRONMENT_SCOPE_DENIED');
    const report=await readGeneration(scope);
    return NextResponse.json({report,scope,state:report?'available':'not_measured',message:report?null:'No published report for this scope. An authorized projection-only rebuild is required.'},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error){return errorResponse(error);}
}
export async function POST(req: NextRequest) {
  let auditId:string|undefined;
  try {
    const body=await req.json(); const scope=ScopeSchema.parse(body.scope);
    if(scope.environment!==serverEnvironment()) throw new AdminAccessError(403,'ENVIRONMENT_SCOPE_DENIED');
    const action=body.action==='rollback'?'rollback':'rebuild';
    const command=await beginCommand(req,{capability:'controls.manage',action:`reports.${action}`,targetType:'report',targetId:scope.environment!,requestId:body.requestId,reason:body.reason,effectSummary:'Projection only; never mail, charge, refund, email or export ads'});
    auditId=command.auditId;
    if(command.duplicate)return NextResponse.json({duplicate:true,status:command.status});
    if(action==='rollback'){
      const generationId=await rollbackGeneration(scope,body.expectedActive);
      await finishCommand(auditId,'succeeded','GENERATION_ROLLED_BACK');return NextResponse.json({generationId});
    }
    const prepared=await prepareGeneration(scope,body.asOf);
    if(body.dryRun!==false){await finishCommand(auditId,'succeeded','DRY_RUN_COMPLETE');return NextResponse.json({mode:prepared.mode,generationId:prepared.report.generationId,reportHash:prepared.reportHash,sourceComplete:prepared.report.sourceComplete});}
    const result=await publishGeneration(prepared,body.expectedActive);
    await finishCommand(auditId,'succeeded','GENERATION_PUBLISHED');return NextResponse.json(result);
  }catch(error){if(auditId)await finishCommand(auditId,'failed','REPORT_FAILED');return errorResponse(error);}
}
