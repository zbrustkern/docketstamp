import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability } from '@/lib/admin-console/commands/access';
import { deliverGoogleConversion, refreshGoogleProcessing } from '@/lib/admin-console/advertising/delivery';
const schema = z.object({ requestId: z.string().min(8).max(128), reason: z.string().min(8).max(240), outboxId: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(['deliver','refresh_processing']) }).strict();
export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    requireCapability(req, 'controls.manage', true);
    const body = schema.parse(await req.json());
    const command = await beginCommand(req, { capability: 'controls.manage', action: `google.${body.action}`, targetType: 'google_conversion', targetId: body.outboxId, requestId: body.requestId, reason: body.reason, effectSummary: 'Separately gated Google conversion delivery or processing reconciliation; no postal or payment action' });
    auditId = command.auditId;
    if (command.duplicate) return NextResponse.json({ status: command.status, duplicate: true }, { headers });
    const result = body.action === 'deliver' ? await deliverGoogleConversion(body.outboxId) : await refreshGoogleProcessing(body.outboxId);
    await finishCommand(auditId, 'succeeded', result.status === 'disabled' ? 'GOOGLE_DELIVERY_DISABLED' : 'GOOGLE_DELIVERY_CHECKED');
    return NextResponse.json(result, { status: result.status === 'disabled' ? 409 : 200, headers });
  } catch (error) {
    if (auditId) await finishCommand(auditId, 'failed', 'GOOGLE_DELIVERY_FAILED');
    return NextResponse.json({ error: error instanceof AdminAccessError ? error.code : 'GOOGLE_DELIVERY_FAILED' }, { status: error instanceof AdminAccessError ? error.status : 400, headers });
  }
}
