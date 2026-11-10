import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { repairGoogleConversionOutbox } from '@/lib/admin-console/advertising/outbox';

const schema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_.:-]{8,128}$/),
  reason: z.string().trim().min(8).max(240),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
}).strict();
function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
function errorResponse(error: unknown) {
  if (error instanceof AdminAccessError) return noStore(NextResponse.json({ error: error.code }, { status: error.status }));
  if (error instanceof z.ZodError) return noStore(NextResponse.json({ error: 'INVALID_GOOGLE_REPAIR_REQUEST' }, { status: 400 }));
  const code = error instanceof Error && ['GOOGLE_REPAIR_SCOPE_INVALID', 'GOOGLE_CAPTURE_NOT_VERIFIED'].includes(error.message) ? error.message : 'GOOGLE_OUTBOX_REPAIR_FAILED';
  return noStore(NextResponse.json({ error: code }, { status: code === 'GOOGLE_REPAIR_SCOPE_INVALID' ? 409 : 400 }));
}

/** Repairs only a missing local conversion outbox row from durable live Stripe authority. */
export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  try {
    const actor = requireCapability(req, 'controls.manage', true);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 3000) return noStore(NextResponse.json({ error: 'BODY_TOO_LARGE' }, { status: 413 }));
    const body = schema.parse(JSON.parse(raw));
    const environment = serverEnvironment();
    if (environment !== 'production') throw new Error('GOOGLE_REPAIR_SCOPE_INVALID');
    const command = await beginCommand(req, {
      capability: 'controls.manage', action: 'google_conversions.outbox_repair', targetType: 'google_conversion',
      targetId: `production:${body.orderId}`, requestId: body.requestId, reason: body.reason,
      effectSummary: 'Repair a local Google conversion outbox reference from verified Stripe facts; no external request',
    });
    auditId = command.auditId;
    const result = await repairGoogleConversionOutbox(body.orderId, environment);
    await finishCommand(auditId, 'succeeded', result.status === 'created' ? 'GOOGLE_OUTBOX_REPAIRED' : 'GOOGLE_OUTBOX_ALREADY_PRESENT');
    return noStore(NextResponse.json({ accepted: true, status: result.status, outboxId: result.status === 'created' ? result.outboxId : undefined }));
  } catch (error) {
    if (auditId) await finishCommand(auditId, 'failed', 'GOOGLE_OUTBOX_REPAIR_FAILED');
    return errorResponse(error);
  }
}
