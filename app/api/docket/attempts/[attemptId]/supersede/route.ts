import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { supersedeAttempt } from '@/src/lib/checkout-attempts/supersession';

export async function POST(req: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId } = await context.params;
    const body = await req.json();
    const authorization = req.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const decoded = token ? await verifyFirebaseIdToken(token) : null;
    const capability = typeof body?.checkoutCapability === 'string' ? body.checkoutCapability : undefined;
    const result = await supersedeAttempt({
      attemptId,
      ownerUid: decoded?.uid,
      capability,
      draftId: String(body?.draftId || ''),
      nextRevision: Number(body?.draftRevision),
    });
    return NextResponse.json({
      attemptId: result.attempt.attemptId,
      state: result.attempt.state,
      outcome: result.outcome,
      replacementAllowed: result.attempt.state === 'superseded' || result.attempt.state === 'cancelled',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CHECKOUT_SUPERSESSION_FAILED';
    if (code === 'CHECKOUT_ATTEMPT_NOT_FOUND') return NextResponse.json({ error: 'Checkout attempt was not found.', code }, { status: 404 });
    if (code === 'CHECKOUT_REVISION_MISMATCH') return NextResponse.json({ error: 'The draft revision does not match this checkout attempt.', code }, { status: 409 });
    if (code === 'CHECKOUT_ALREADY_PAID') return NextResponse.json({ error: 'Payment was already completed for this frozen document.', code }, { status: 409 });
    if (code === 'CHECKOUT_ATTEMPT_BUSY') return NextResponse.json({ error: 'Checkout initialization is still in progress. Retry after its status resolves.', code }, { status: 409 });
    console.error('[checkout-attempt-supersede]', error);
    return NextResponse.json({ error: 'Checkout status could not be safely resolved.', code: 'CHECKOUT_OUTCOME_UNRESOLVED' }, { status: 409 });
  }
}
