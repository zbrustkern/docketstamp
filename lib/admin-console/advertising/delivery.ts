import crypto from 'node:crypto';
import { firestoreDb } from '@/lib/firebase-admin';
import { serverEnvironment } from '@/lib/admin-console/commands/access';
import { getApprovedGoogleDestination, isGoogleDeliveryEnabled, type GoogleAdsDestination } from './destination';
import { consentIsCurrentlyGranted } from './consent';
import { evaluateGoogleConversionEligibility, type GoogleConversionCandidate } from './eligibility';
import { sendGoogleDataManagerConversion, type GoogleDataManagerResult } from './google-data-manager';

const COLLECTION = 'google_conversion_outbox_v1';
const MAX_ATTEMPTS = 5;
const iso = (value: unknown): string => typeof value === 'string' ? value : value && typeof (value as any).toDate === 'function' ? (value as any).toDate().toISOString() : '';

export function nextGoogleDeliveryState(result: GoogleDataManagerResult, attempts: number, now: number, expires: number) {
  if (result.status === 'submitted') return result.requestId
    ? { status: 'submitted', nextAttemptAt: null }
    : { status: 'unknown', nextAttemptAt: null, diagnosticCode: 'SUBMISSION_RECEIPT_MISSING' };
  if (result.status === 'unknown') return { status: 'unknown', nextAttemptAt: null };
  if (result.status === 'disabled') return { status: 'held', nextAttemptAt: null };
  const next = now + Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.max(0, attempts - 1));
  if (result.status === 'retryable_failure' && attempts < MAX_ATTEMPTS && next < expires) {
    return { status: 'retry_due', nextAttemptAt: new Date(next).toISOString() };
  }
  return { status: 'failed', nextAttemptAt: null };
}

/** One explicitly invoked delivery; never schedules itself or touches postal obligations. */
export async function deliverGoogleConversion(outboxId: string, send = sendGoogleDataManagerConversion) {
  if (!/^[a-f0-9]{64}$/.test(outboxId)) throw new Error('DELIVERY_ID_INVALID');
  const destination = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
  if (serverEnvironment() !== 'production' || !destination || !isGoogleDeliveryEnabled(destination)) return { status: 'disabled' };
  const ref = firestoreDb.collection(COLLECTION).doc(outboxId);
  const owner = crypto.randomUUID(); const now = Date.now();
  const claimed = await firestoreDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const row = snap.data();
    if (!row || row.environment !== 'production' || row.kind !== 'google_offline_conversion') return null;
    if (row.deliveryMode && row.deliveryMode !== 'api') return null;
    if (row.status === 'leased') {
      const leaseUntil = Date.parse(row.leaseUntil || '');
      if (!Number.isFinite(leaseUntil) || leaseUntil <= now) tx.update(ref, { status: 'unknown', diagnosticCodes: ['LEASE_EXPIRED_OUTCOME_UNKNOWN'], leaseOwner: null, leaseUntil: null });
      return null;
    }
    if (!['held', 'ready', 'retry_due'].includes(row.status) || Number(row.attempts || 0) >= MAX_ATTEMPTS) return null;
    if (row.nextAttemptAt && Date.parse(row.nextAttemptAt) > now) return null;
    if (row.destinationKey && row.destinationKey !== destination.key) return null;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(row.orderId || '') || !/^[a-f0-9]{64}$/.test(row.paymentFactId || '') || !new RegExp(`^acquisition_click_evidence_v2/${row.orderId}_[0-5]$`).test(row.clickEvidenceRef || '')) {
      tx.update(ref, { status: 'held', diagnosticCodes: ['EVIDENCE_REFERENCE_INVALID'] }); return null;
    }
    const [orderSnap, factSnap, clickSnap, moneySnap] = await Promise.all([
      tx.get(firestoreDb.collection('orders').doc(row.orderId)),
      tx.get(firestoreDb.collection('payment_facts_v1').doc(row.paymentFactId)),
      tx.get(firestoreDb.doc(row.clickEvidenceRef)),
      tx.get(firestoreDb.collection('payment_facts_v1').where('orderId', '==', row.orderId)),
    ]);
    const order = orderSnap.data(); const fact = factSnap.data(); const click = clickSnap.data();
    const consent = order?.marketingConsentEvidence;
    if (!order || !fact || fact.factId !== row.paymentFactId || fact.provider !== 'stripe' || !fact.providerAccountId || fact.orderId !== row.orderId || fact.environment !== 'production' || fact.product !== 'docketstamp' || fact.providerMode !== 'live' || fact.kind !== 'capture' || fact.verification !== 'verified' || fact.classification?.primary !== 'customer' || fact.amountMinor !== row.amountMinor || fact.currency !== row.currency || !click || !consent || !/^[a-f0-9]{64}$/.test(consent.sessionBinding || '')) {
      tx.update(ref, { status: 'held', diagnosticCodes: ['ELIGIBILITY_EVIDENCE_MISSING'] }); return null;
    }
    const consentSnap = await tx.get(firestoreDb.collection('google_conversion_consent_v1').doc(consent.sessionBinding));
    const currentConsent = consentSnap.data();
    const currentConsentAt = Date.parse(currentConsent?.recordedAt || '');
    const hasAdjustment = moneySnap.docs.some(doc => {
      const f = doc.data(); return f.provider === 'stripe' && f.orderId === row.orderId && f.environment === 'production' && f.verification === 'verified' && f.providerMode === 'live' && ['refund','dispute_debit','dispute_reversal'].includes(f.kind);
    });
    if (hasAdjustment || row.latestAdjustmentId) {
      tx.update(ref, { status: 'adjustment_pending', diagnosticCodes: ['REFUND_RECONCILIATION_REQUIRED'] }); return null;
    }
    if (currentConsent?.purpose !== 'google_offline_conversion' || currentConsent.consentVersion !== 1 || currentConsent?.status !== 'granted' || currentConsent.grantId !== consent.grantId || currentConsent.grantId !== row.consentGrantId || currentConsent.sessionBinding !== row.consentSessionBinding || currentConsent.gpc || currentConsent.environment !== 'production' || !Number.isFinite(currentConsentAt) || currentConsentAt > now || now - currentConsentAt > 30 * 86400000) {
      tx.update(ref, { status: 'held', diagnosticCodes: ['CONSENT_REQUIRED'] }); return null;
    }
    const result = evaluateGoogleConversionEligibility({
      order: order as GoogleConversionCandidate['order'], paymentFact: fact as GoogleConversionCandidate['paymentFact'],
      click: { type: click.type, value: click.value, observedAt: iso(click.observedAt), expiresAt: iso(click.expiresAt) },
      consent, environment: 'production', destinationApproved: true, now,
    });
    if (!result.eligible || !result.click || !result.transactionId || !result.eventTimestamp || result.conversionValue === undefined) {
      tx.update(ref, { status: 'held', diagnosticCodes: result.reasons }); return null;
    }
    tx.update(ref, { status: 'leased', deliveryMode: 'api', destinationKey: destination.key, attempts: Number(row.attempts || 0) + 1, leaseOwner: owner, leaseUntil: new Date(now + 30_000).toISOString(), nextAttemptAt: null, diagnosticCodes: [] });
    return { result, attempts: Number(row.attempts || 0) + 1, paymentFactId: row.paymentFactId, orderId: row.orderId };
  });
  if (!claimed) return { status: 'not_claimed' };
  const candidate = claimed.result;
  let result: GoogleDataManagerResult;
  const preflight = await firestoreDb.runTransaction(async tx => {
    const freshSnap = await tx.get(ref);
    const fresh = freshSnap.data();
    if (!fresh || fresh.status !== 'leased' || fresh.leaseOwner !== owner || fresh.environment !== 'production' || fresh.deliveryMode !== 'api' || fresh.destinationKey !== destination.key || fresh.paymentFactId !== claimed.paymentFactId || fresh.orderId !== claimed.orderId) return false;
    const leaseUntil = Date.parse(fresh.leaseUntil || '');
    if (!Number.isFinite(leaseUntil) || leaseUntil <= Date.now()) {
      tx.update(ref, { status: 'unknown', diagnosticCodes: ['LEASE_EXPIRED_OUTCOME_UNKNOWN'], leaseOwner: null, leaseUntil: null });
      return false;
    }
    const [captureSnap, moneySnap] = await Promise.all([
      tx.get(firestoreDb.collection('payment_facts_v1').doc(String(fresh.paymentFactId || ''))),
      tx.get(firestoreDb.collection('payment_facts_v1').where('orderId', '==', String(fresh.orderId || ''))),
    ]);
    const capture = captureSnap.data();
    const hasAdjustment = moneySnap.docs.some(doc => {
      const fact = doc.data();
      return fact.provider === 'stripe' && fact.orderId === fresh.orderId && fact.environment === 'production' && fact.verification === 'verified' && fact.providerMode === 'live' && ['refund','dispute_debit','dispute_reversal'].includes(fact.kind);
    });
    if (hasAdjustment || fresh.latestAdjustmentId) {
      tx.update(ref, { status: 'adjustment_pending', diagnosticCodes: ['REFUND_RECONCILIATION_REQUIRED'], leaseOwner: null, leaseUntil: null });
      return false;
    }
    if (!capture || capture.factId !== fresh.paymentFactId || capture.provider !== 'stripe' || !capture.providerAccountId || capture.orderId !== fresh.orderId || capture.environment !== 'production' || capture.product !== 'docketstamp' || capture.kind !== 'capture' || capture.verification !== 'verified' || capture.providerMode !== 'live' || capture.classification?.primary !== 'customer' || capture.amountMinor !== fresh.amountMinor || capture.currency !== fresh.currency) {
      tx.update(ref, { status: 'held', diagnosticCodes: ['PAYMENT_FACT_CHANGED'], leaseOwner: null, leaseUntil: null });
      return false;
    }
    return true;
  });
  if (!preflight) return { status: 'not_claimed' };
  if (!isGoogleDeliveryEnabled(destination) || Date.parse(candidate.click!.expiresAt) <= Date.now() || !await consentIsCurrentlyGranted(candidate.consentSessionBinding!, candidate.consentGrantId!)) {
    result = { status: 'disabled', diagnosticCode: 'CONFIG_MISSING' };
  } else {
    try {
      result = await send({ destination, conversion: { gclid: candidate.click!.value, transactionId: candidate.transactionId!, eventTimestamp: candidate.eventTimestamp!, conversionValue: candidate.conversionValue!, currency: 'USD' } });
    } catch { result = { status: 'unknown', diagnosticCode: 'PROVIDER_TIMEOUT' }; }
  }
  const finishedAt = Date.now();
  const next = nextGoogleDeliveryState(result, claimed.attempts, finishedAt, Date.parse(candidate.click!.expiresAt));
  await firestoreDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.data()?.leaseOwner !== owner || snap.data()?.status !== 'leased') return;
    tx.update(ref, {
      ...next, leaseOwner: null, leaseUntil: null, updatedAt: new Date(finishedAt).toISOString(),
      diagnosticCodes: result.diagnosticCode ? [result.diagnosticCode] : 'diagnosticCode' in next ? [next.diagnosticCode] : [],
      ...(result.status === 'submitted' ? { submittedAt: new Date(finishedAt).toISOString(), providerRequestId: result.requestId || null } : {}),
    });
  });
  return next;
}

/** Google processing success is not evidence of campaign attribution. */
export function interpretGoogleProcessing(body: unknown, destination: GoogleAdsDestination): 'accepted' | 'processing' | 'rejected' | 'unknown' {
  if (!body || typeof body !== 'object') return 'unknown';
  const rows = (body as any).requestStatusPerDestination;
  if (!Array.isArray(rows) || rows.length !== 1) return 'unknown';
  const row = rows[0];
  if (row?.destination?.operatingAccount?.accountId !== destination.accountId || row?.destination?.productDestinationId !== destination.conversionActionId) return 'unknown';
  if (row.requestStatus === 'SUCCESS' && !(row.errorInfo?.errorCounts?.length)) return 'accepted';
  if (row.requestStatus === 'PROCESSING') return 'processing';
  if (['FAILED','PARTIAL_SUCCESS'].includes(row.requestStatus)) return 'rejected';
  return 'unknown';
}

export async function refreshGoogleProcessing(outboxId: string, fetchImpl = fetch) {
  const destination = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
  if (!destination || !isGoogleDeliveryEnabled(destination)) return { status: 'disabled' };
  if (!/^[a-f0-9]{64}$/.test(outboxId)) throw new Error('DELIVERY_ID_INVALID');
  const ref = firestoreDb.collection(COLLECTION).doc(outboxId);
  const row = (await ref.get()).data();
  if (!row || row.environment !== 'production' || row.deliveryMode !== 'api' || row.destinationKey !== destination.key || !['submitted','processing'].includes(row.status) || !/^[A-Za-z0-9_-]{1,128}$/.test(row.providerRequestId || '')) return { status: 'not_reconcilable' };
  const token = process.env.GOOGLE_DATA_MANAGER_ACCESS_TOKEN;
  if (!token) return { status: 'disabled' };
  let status: ReturnType<typeof interpretGoogleProcessing> = 'unknown';
  try {
    const response = await fetchImpl(`https://datamanager.googleapis.com/v1/requestStatus:retrieve?requestId=${encodeURIComponent(row.providerRequestId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (response.ok) status = interpretGoogleProcessing(await response.json(), destination);
  } catch { return { status: 'unavailable' }; }
  if (status === 'unknown') return { status: 'unknown' };
  await firestoreDb.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.providerRequestId !== row.providerRequestId || !['submitted','processing'].includes(current?.status)) return;
    tx.update(ref, { status: status === 'accepted' ? 'accepted' : status === 'rejected' ? 'failed' : 'processing', ...(status === 'accepted' ? { processingAcceptedAt: new Date().toISOString() } : {}), diagnosticCodes: status === 'rejected' ? ['GOOGLE_PROCESSING_REJECTED'] : [] });
  });
  return { status };
}
