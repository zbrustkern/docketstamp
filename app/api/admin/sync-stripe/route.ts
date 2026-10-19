import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { getOrderById } from '@/lib/firebase-admin';
import { resolvePaymentMode } from '@/lib/payment-mode';
import { AdminAccessError, requireCapability } from '@/lib/admin-console/commands/access';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { reconcileStripeEvidencePage } from '@/lib/admin-console/finance/reconcile';
import { recordPaymentAuthority } from '@/lib/admin-console/finance/authority';

export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  try {
    requireCapability(req, 'money.reconcile', true);
    const body = await req.json();
    const mode = resolvePaymentMode();
    if (mode === 'local_mock') throw new AdminAccessError(503, 'STRIPE_RECONCILIATION_UNCONFIGURED');
    const command = await beginCommand(req, { capability: 'money.reconcile', action: 'stripe.reconcile', targetType: 'stripe_evidence', targetId: body.orderId || 'event_window', requestId: body.requestId, reason: body.reason, effectSummary: 'Read provider evidence and persist facts; does not initiate mailing, payment, refund or outreach' });
    auditId = command.auditId;
    if (command.duplicate) return NextResponse.json({ duplicate: true, status: command.status });
    const stripe = getStripeClient();
    if (body.orderId) {
      if (!/^[A-Za-z0-9_:-]{1,128}$/.test(body.orderId)) throw new AdminAccessError(400, 'ORDER_ID_INVALID');
      const order = await getOrderById(body.orderId);
      if (!order?.stripePaymentId) throw new AdminAccessError(404, 'PAYMENT_INTENT_NOT_RECORDED');
      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentId, { expand: ['latest_charge'] });
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      if (pi.metadata?.orderId !== body.orderId) throw new AdminAccessError(409, 'PAYMENT_ORDER_MISMATCH');
      if (pi.status !== 'succeeded' || !charge?.created) {
        await finishCommand(auditId, 'succeeded', 'PAYMENT_NOT_YET_VERIFIED');
        return NextResponse.json({ success: false, paymentStatus: pi.status, evidence: 'capture_not_verified', dispatchInitiated: false });
      }
      const result = await recordPaymentAuthority(pi, { eventId: `reconcile-retrieve:${pi.id}`, eventType: 'payment_intent.retrieve.reconcile', eventLivemode: pi.livemode, occurredAt: charge.created * 1000, receivedAt: Date.now() });
      await finishCommand(auditId, result.accepted ? 'reconciled' : 'failed', result.accepted ? 'PAYMENT_RECONCILED' : 'PAYMENT_QUARANTINED');
      return NextResponse.json({ success: result.accepted, ...result, dispatchInitiated: false });
    }
    const limit = body.limit ?? 100;
    const startAtSeconds = body.startAt ? Math.floor(Date.parse(body.startAt) / 1000) : undefined;
    const endAtSeconds = body.endAt ? Math.floor(Date.parse(body.endAt) / 1000) : undefined;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || Boolean(body.startAt) !== Boolean(body.endAt) || (body.startAt && (!Number.isFinite(startAtSeconds) || !Number.isFinite(endAtSeconds))) || (body.startingAfter && !/^[A-Za-z0-9_:-]{1,160}$/.test(body.startingAfter))) throw new AdminAccessError(400, 'RECONCILIATION_SCOPE_INVALID');
    const result = await reconcileStripeEvidencePage({ limit, startAtSeconds, endAtSeconds, startingAfter: body.startingAfter }, stripe);
    await finishCommand(auditId, 'reconciled', 'EVENT_PAGE_RECONCILED');
    return NextResponse.json({ success: true, ...result, dispatchInitiated: false });
  } catch (error) {
    if (auditId) await finishCommand(auditId, 'failed', 'STRIPE_RECONCILIATION_FAILED');
    return NextResponse.json({ error: error instanceof AdminAccessError ? error.code : 'STRIPE_RECONCILIATION_UNAVAILABLE' }, { status: error instanceof AdminAccessError ? error.status : 503 });
  }
}
