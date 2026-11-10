import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { beginCommand, finishCommand } from '@/lib/admin-console/commands/audit';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { googleConversionOutboxId, GOOGLE_CONVERSION_OUTBOX, currentConsentGrantMatches } from '@/lib/admin-console/advertising/outbox';
import { getApprovedGoogleDestination } from '@/lib/admin-console/advertising/destination';
import { eligibleGoogleCsvRow, buildGoogleOfflineConversionCsv } from '@/lib/admin-console/advertising/manual-csv';
import { clickDigest, type RawClick } from '@/lib/acquisition';

const schema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_.:-]{8,128}$/),
  reason: z.string().trim().min(8).max(240),
  orderIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.orderIds).size !== value.orderIds.length) ctx.addIssue({ code: 'custom', path: ['orderIds'], message: 'orderIds must be unique' });
});

function iso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate(): Date }).toDate().toISOString();
  return '';
}
function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }
function privateError(error: unknown) {
  if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'INVALID_GOOGLE_EXPORT_REQUEST' }, { status: 400 });
  const code = error instanceof Error && ['GOOGLE_EXPORT_DISABLED', 'GOOGLE_EXPORT_NOT_ELIGIBLE', 'GOOGLE_DELIVERY_MODE_CONFLICT', 'GOOGLE_CONSENT_CHANGED', 'GOOGLE_OUTBOX_NOT_READY'].includes(error.message) ? error.message : 'GOOGLE_EXPORT_FAILED';
  return NextResponse.json({ error: code }, { status: code === 'GOOGLE_EXPORT_DISABLED' ? 409 : 400 });
}
function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function POST(req: NextRequest) {
  let auditId: string | undefined;
  try {
    const actor = requireCapability(req, 'controls.manage', true);
    const bodyText = await req.text();
    if (Buffer.byteLength(bodyText) > 12_000) return noStore(NextResponse.json({ error: 'BODY_TOO_LARGE' }, { status: 413 }));
    const body = schema.parse(JSON.parse(bodyText));
    const environment = serverEnvironment();
    const destination = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
    if (environment !== 'production' || !destination) throw new Error('GOOGLE_EXPORT_DISABLED');
    const requestDigest = hash(JSON.stringify(body.orderIds));
    const command = await beginCommand(req, {
      capability: 'controls.manage', action: 'google_conversions.csv_prepare', targetType: 'google_conversion_batch',
      targetId: `${environment}:${requestDigest}`, requestId: body.requestId, reason: body.reason,
      effectSummary: 'Prepare a gated Google offline conversion CSV; download is not upload or acceptance',
    });
    auditId = command.auditId;
    const batchId = hash(`google-csv:${environment}:${actor.actorId}:${body.requestId}:${requestDigest}`);
    const prepared: Array<{ outboxId: string; orderId: string; paymentFactId: string; clickEvidenceRef: string; amountMinor: number; currency: string; effectiveAt: string; sessionBinding: string; grantId: string; clickDigest: string; eligible: ReturnType<typeof eligibleGoogleCsvRow> }> = [];
    for (const orderId of body.orderIds) {
      const outboxId = googleConversionOutboxId(environment, orderId);
      const [outboxSnap, orderSnap] = await Promise.all([
        firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(outboxId).get(),
        firestoreDb.collection('orders').doc(orderId).get(),
      ]);
      if (!outboxSnap.exists || !orderSnap.exists) throw new Error('GOOGLE_EXPORT_NOT_ELIGIBLE');
      const outbox = outboxSnap.data() as Record<string, any>;
      const order = orderSnap.data() as Record<string, any>;
      if (outbox.orderId !== orderId || outbox.environment !== environment || !outbox.paymentFactId || !outbox.clickEvidenceRef) throw new Error('GOOGLE_EXPORT_NOT_ELIGIBLE');
      const paymentSnap = await firestoreDb.collection('payment_facts_v1').doc(String(outbox.paymentFactId)).get();
      const clickRef = String(outbox.clickEvidenceRef).split('/');
      if (clickRef.length !== 2 || clickRef[0] !== 'acquisition_click_evidence_v2') throw new Error('GOOGLE_EXPORT_NOT_ELIGIBLE');
      const [clickSnap, consentOkay] = await Promise.all([
        firestoreDb.collection('acquisition_click_evidence_v2').doc(clickRef[1]).get(),
        currentConsentGrantMatches(String(outbox.consentSessionBinding || ''), String(outbox.consentGrantId || '')),
      ]);
      if (!paymentSnap.exists || !clickSnap.exists) throw new Error('GOOGLE_EXPORT_NOT_ELIGIBLE');
      const paymentFact = paymentSnap.data() as Record<string, any>;
      const rawClick = clickSnap.data() as Record<string, unknown>;
      if (!consentOkay) throw new Error('GOOGLE_CONSENT_CHANGED');
      const click: RawClick = { type: rawClick.type as RawClick['type'], value: String(rawClick.value || ''), observedAt: iso(rawClick.observedAt), expiresAt: iso(rawClick.expiresAt) };
      const consent = order.marketingConsentEvidence as Record<string, any> | undefined;
      const result = eligibleGoogleCsvRow({
        order: { ...order, id: orderId, marketingConsentEvidence: consent as any },
        paymentFact: paymentFact as any,
        click,
        consent: consent as any,
        now: Date.now(), environment,
        destinationApproved: destination.approved,
      }, destination);
      if (!result.eligible) throw new Error('GOOGLE_EXPORT_NOT_ELIGIBLE');
      prepared.push({ outboxId, orderId, paymentFactId: String(outbox.paymentFactId), clickEvidenceRef: String(outbox.clickEvidenceRef), amountMinor: paymentFact.amountMinor, currency: paymentFact.currency, effectiveAt: paymentFact.effectiveAt, sessionBinding: String(outbox.consentSessionBinding), grantId: String(outbox.consentGrantId), clickDigest: clickDigest(click.value), eligible: result });
    }
    const batchRef = firestoreDb.collection('google_conversion_export_batches_v1').doc(batchId);
    const outboxRefs = prepared.map(item => firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(item.outboxId));
    await firestoreDb.runTransaction(async tx => {
      const [batchSnap, ...outboxSnaps] = await Promise.all([tx.get(batchRef), ...outboxRefs.map(ref => tx.get(ref))]);
      const consentRefs = prepared.map(item => firestoreDb.collection('google_conversion_consent_v1').doc(item.sessionBinding));
      const orderRefs = prepared.map(item => firestoreDb.collection('orders').doc(item.orderId));
      const paymentRefs = prepared.map(item => firestoreDb.collection('payment_facts_v1').doc(item.paymentFactId));
      const clickRefs = prepared.map(item => {
        const [collection, doc] = item.clickEvidenceRef.split('/');
        if (collection !== 'acquisition_click_evidence_v2' || !doc) throw new Error('GOOGLE_OUTBOX_NOT_READY');
        return firestoreDb.collection(collection).doc(doc);
      });
      const [consentSnaps, orderSnaps, paymentSnaps, clickSnaps] = await Promise.all([
        Promise.all(consentRefs.map(ref => tx.get(ref))), Promise.all(orderRefs.map(ref => tx.get(ref))),
        Promise.all(paymentRefs.map(ref => tx.get(ref))), Promise.all(clickRefs.map(ref => tx.get(ref))),
      ]);
      for (let index = 0; index < prepared.length; index++) {
        const row = outboxSnaps[index].data() as Record<string, any> | undefined;
        const consent = consentSnaps[index].data() as Record<string, any> | undefined;
        const order = orderSnaps[index].data() as Record<string, any> | undefined;
        const payment = paymentSnaps[index].data() as Record<string, any> | undefined;
        const clickRow = clickSnaps[index].data() as Record<string, any> | undefined;
        const item = prepared[index];
        if (!row || row.environment !== environment || row.orderId !== prepared[index].orderId || row.clickExpiresAt && Date.parse(iso(row.clickExpiresAt)) <= Date.now()) throw new Error('GOOGLE_OUTBOX_NOT_READY');
        if (!order || !payment || !clickRow || row.paymentFactId !== item.paymentFactId || row.clickEvidenceRef !== item.clickEvidenceRef || row.amountMinor !== item.amountMinor || row.currency !== item.currency || row.effectiveAt !== item.effectiveAt || payment.factId !== item.paymentFactId || payment.amountMinor !== item.amountMinor || payment.currency !== item.currency || payment.effectiveAt !== item.effectiveAt || clickDigest(String(clickRow.value || '')) !== item.clickDigest || iso(clickRow.expiresAt) !== row.clickExpiresAt || order.marketingConsentEvidence?.grantId !== item.grantId || order.marketingConsentEvidence?.sessionBinding !== item.sessionBinding) throw new Error('GOOGLE_OUTBOX_NOT_READY');
        const consentAt = Date.parse(String(consent?.recordedAt || ''));
        if (!consent || consent.status !== 'granted' || consent.gpc === true || consent.grantId !== item.grantId || consent.grantId !== row.consentGrantId || consent.sessionBinding !== item.sessionBinding || consent.environment !== environment || !Number.isFinite(consentAt) || consentAt > Date.now() || Date.now() - consentAt > 30 * 86400000) throw new Error('GOOGLE_CONSENT_CHANGED');
        if (row.deliveryMode && !(row.deliveryMode === 'csv' && row.exportBatchId === batchId)) throw new Error('GOOGLE_DELIVERY_MODE_CONFLICT');
        if (!row.deliveryMode && !['held', 'ready'].includes(row.status)) throw new Error('GOOGLE_OUTBOX_NOT_READY');
      }
      if (batchSnap.exists && (batchSnap.data()?.rowCount !== prepared.length || batchSnap.data()?.orderSetDigest !== requestDigest)) throw new Error('GOOGLE_DELIVERY_MODE_CONFLICT');
      prepared.forEach((item, index) => {
        const ref = outboxRefs[index];
        const prior = outboxSnaps[index].data() as Record<string, any>;
        if (prior.deliveryMode === 'csv' && prior.exportBatchId === batchId) return;
        tx.update(ref, {
          deliveryMode: 'csv', exportBatchId: batchId, status: 'csv_prepared',
          csvPreparedAt: new Date().toISOString(), diagnosticCodes: ['CSV_PREPARED_NOT_UPLOADED'],
        });
      });
      if (!batchSnap.exists) tx.create(batchRef, sanitizeFirestoreData({
        schemaVersion: 1, environment, batchId, destinationKey: destination.key,
        status: 'csv_prepared', rowCount: prepared.length, orderSetDigest: requestDigest, requestId: body.requestId,
        actorId: actor.actorId, createdAt: new Date().toISOString(),
        uploadState: 'not_reported', diagnosticCodes: ['DOWNLOAD_IS_NOT_UPLOAD'],
      }));
    });
    await finishCommand(auditId, 'succeeded', 'GOOGLE_CSV_PREPARED');
    const csvRows = prepared.map(item => (item.eligible as any).row);
    const csv = buildGoogleOfflineConversionCsv(csvRows);
    return noStore(new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="google-offline-conversions-${new Date().toISOString().slice(0, 10)}.csv"`,
        'X-DocketStamp-Export-State': 'csv_prepared',
        'X-DocketStamp-Upload-State': 'not_reported',
      },
    }));
  } catch (error) {
    if (auditId) await finishCommand(auditId, 'failed', 'GOOGLE_CSV_PREPARATION_FAILED');
    return noStore(privateError(error));
  }
}
