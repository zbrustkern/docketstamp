import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '@/lib/firebase-admin';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import {
  executeOutboundEmail,
  OUTBOUND_EMAIL_FROM,
  OUTBOUND_EMAIL_RATE_LIMIT,
  OUTBOUND_EMAIL_RATE_WINDOW_MS,
  OUTBOUND_EMAIL_REPLY_TO,
  OutboundEmailInputSchema,
  OutboundEmailRecord,
  OutboundEmailStore,
  ReserveResult,
} from '@/lib/admin-console/outbound-email';

const COLLECTION = 'admin_outbound_email_v1';
const RATE_COLLECTION = 'admin_outbound_email_rate_v1';
const opaqueId = (...parts: string[]) => createHash('sha256').update(parts.join(':')).digest('hex');

const store: OutboundEmailStore = {
  async reserve(input): Promise<ReserveResult> {
    const sendRef = firestoreDb.collection(COLLECTION).doc(opaqueId(input.environment, input.requestId));
    const windowStart = Math.floor(Date.parse(input.now) / OUTBOUND_EMAIL_RATE_WINDOW_MS) * OUTBOUND_EMAIL_RATE_WINDOW_MS;
    const rateRef = firestoreDb.collection(RATE_COLLECTION).doc(opaqueId(input.environment, input.actorId, String(windowStart)));
    return firestoreDb.runTransaction(async (tx) => {
      const sendSnap = await tx.get(sendRef);
      if (sendSnap.exists) {
        const existing = sendSnap.data() as OutboundEmailRecord & { contentDigest?: string };
        if (existing.actorId !== input.actorId || existing.contentDigest !== input.contentDigest) return { kind: 'conflict' };
        return { kind: 'duplicate', record: existing };
      }
      const rateSnap = await tx.get(rateRef);
      const count = Number(rateSnap.data()?.count || 0);
      if (count >= OUTBOUND_EMAIL_RATE_LIMIT) return { kind: 'rate_limited' };
      const record: OutboundEmailRecord & { contentDigest: string } = {
        requestId: input.requestId,
        environment: input.environment,
        recipient: input.recipient,
        subject: input.subject,
        contentDigest: input.contentDigest,
        status: 'pending',
        actorId: input.actorId,
        createdAt: input.now,
        updatedAt: input.now,
      };
      tx.create(sendRef, record);
      tx.set(rateRef, { environment: input.environment, actorId: input.actorId, windowStart: new Date(windowStart).toISOString(), count: count + 1 });
      return { kind: 'reserved', record };
    });
  },
  async complete(requestId, environment, status, providerId) {
    await firestoreDb.collection(COLLECTION).doc(opaqueId(environment, requestId)).update({
      status,
      ...(providerId ? { providerId } : {}),
      updatedAt: new Date().toISOString(),
    });
  },
};

async function sendViaResend(params: { apiKey: string; to: string; subject: string; message: string; idempotencyKey: string }) {
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        from: OUTBOUND_EMAIL_FROM,
        reply_to: OUTBOUND_EMAIL_REPLY_TO,
        to: [params.to],
        subject: params.subject,
        text: params.message,
      }),
    });
  } catch {
    return { status: 'uncertain' as const };
  }
  const data = await response.json().catch(() => ({})) as { id?: unknown };
  if (response.ok && typeof data.id === 'string' && data.id.length <= 200) {
    return { status: 'accepted' as const, providerId: data.id };
  }
  if (response.status >= 500 || response.status === 408 || response.status === 429 || response.status === 409) {
    return { status: 'uncertain' as const };
  }
  return { status: 'rejected' as const };
}

function accessError(error: unknown) {
  return NextResponse.json({ error: error instanceof AdminAccessError ? error.code : 'OUTBOUND_EMAIL_UNAVAILABLE' }, {
    status: error instanceof AdminAccessError ? error.status : 503,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const actor = requireCapability(req, 'outreach.send');
    if (actor.actorKind !== 'human' || actor.role !== 'owner') throw new AdminAccessError(403, 'ADMIN_HUMAN_OWNER_REQUIRED');
    const environment = serverEnvironment();
    const snapshot = await firestoreDb.collection(COLLECTION)
      .where('environment', '==', environment)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    const history = snapshot.docs.map((doc) => {
      const { requestId, recipient, subject, status, providerId, createdAt } = doc.data() as OutboundEmailRecord;
      return { requestId, recipient, subject, status, providerId: providerId || null, createdAt };
    });
    return NextResponse.json({ environment, history }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return accessError(error);
  }
}

export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  try {
    const actor = requireCapability(req, 'outreach.send', true);
    if (actor.actorKind !== 'human' || actor.role !== 'owner') throw new AdminAccessError(403, 'ADMIN_HUMAN_OWNER_REQUIRED');
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey?.trim()) return NextResponse.json({ error: 'OUTBOUND_EMAIL_NOT_CONFIGURED' }, { status: 503 });
    const parsed = OutboundEmailInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'OUTBOUND_EMAIL_INPUT_INVALID' }, { status: 400 });
    const input = parsed.data;
    const command = await beginCommand(req, {
      capability: 'outreach.send',
      action: 'email.send',
      targetType: 'email_message',
      targetId: input.requestId,
      requestId: input.requestId,
      reason: 'Operator initiated outgoing correspondence',
      effectSummary: 'Send one plain-text email through Resend',
    });
    auditId = command.auditId;
    const result = await executeOutboundEmail({
      input,
      environment: serverEnvironment(),
      actorId: actor.actorId,
      now: new Date().toISOString(),
      apiKey,
      store,
      send: sendViaResend,
    });
    if (!result.duplicate || result.status === 'pending') {
      await finishCommand(auditId, result.status === 'accepted' ? 'succeeded' : result.status === 'uncertain' ? 'uncertain' : 'failed', `EMAIL_${result.status.toUpperCase()}`);
    }
    return NextResponse.json({ status: result.status, duplicate: result.duplicate, providerId: result.providerId || null }, {
      status: result.status === 'rejected' ? 502 : result.status === 'uncertain' || result.status === 'pending' ? 202 : 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (auditId) await finishCommand(auditId, error instanceof Error && error.message === 'OUTBOUND_EMAIL_RATE_LIMITED' ? 'failed' : 'uncertain', error instanceof Error && /^OUTBOUND_EMAIL_/.test(error.message) ? error.message.replace(/[^A-Z0-9_]/g, '_').slice(0, 80) : 'EMAIL_SEND_UNCERTAIN').catch(() => undefined);
    if (error instanceof Error && error.message === 'OUTBOUND_EMAIL_RATE_LIMITED') {
      return NextResponse.json({ error: 'OUTBOUND_EMAIL_RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (error instanceof Error && error.message === 'OUTBOUND_EMAIL_REQUEST_CONFLICT') {
      return NextResponse.json({ error: 'OUTBOUND_EMAIL_REQUEST_CONFLICT' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } });
    }
    return accessError(error);
  }
}
