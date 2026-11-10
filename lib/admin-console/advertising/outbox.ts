import crypto from 'node:crypto';
import type { Order } from '@/lib/types';
import type { RawClick } from '@/lib/acquisition';
import { evaluateGoogleConversionEligibility } from './eligibility';
import { getRegisteredCampaign } from './campaigns';
import { getApprovedGoogleDestination } from './destination';
import { consentIsCurrentlyGranted } from './consent';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';

export const GOOGLE_CONVERSION_OUTBOX = 'google_conversion_outbox_v1';
const CLICK_EVIDENCE = 'acquisition_click_evidence_v2';
const CONSENT_CURRENT = 'google_conversion_consent_v1';
const PAYMENT_FACTS = 'payment_facts_v1';
export type GoogleDeliveryStatus = 'held' | 'ready' | 'leased' | 'submitted' | 'processing' | 'attributed' | 'failed' | 'unknown' | 'adjustment_pending' | 'reconciled';

export function googleConversionOutboxId(environment: string, orderId: string) {
  return crypto.createHash('sha256').update(`google-conversion:${environment}:${orderId}`).digest('hex');
}
function asIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return ((value as { toDate(): Date }).toDate()).toISOString();
  return '';
}
function boundedReasons(values: string[]) { return values.slice(0, 12).map(v => v.replace(/[^A-Z0-9_]/g, '_').slice(0, 60)); }

/** Add a sanitized, deduplicated payment conversion row inside the verified-payment transaction. */
export async function createGoogleConversionOutboxInTransaction(tx: any, input: {
  order: Order & { marketingConsentEvidence?: Record<string, unknown> };
  orderId: string; paymentFact: Record<string, any>; environment: 'local' | 'staging' | 'production'; now: number;
  freshVerifiedCapture?: { paymentIntentId: string; amountReceivedMinor: number };
}): Promise<boolean> {
  const { order, orderId, paymentFact, environment, now, freshVerifiedCapture } = input;
  const authorityOrder = order as Order & { paymentFactId?: string; amountReceivedInCents?: number };
  const orderAmount = order.finalAmountInCents ?? order.amountInCents;
  const persistedCaptureMatches = paymentFact.factId === authorityOrder.paymentFactId && paymentFact.providerObjectId === order.stripePaymentId && authorityOrder.amountReceivedInCents === paymentFact.amountMinor;
  const freshCaptureMatches = Boolean(freshVerifiedCapture && freshVerifiedCapture.paymentIntentId === paymentFact.providerObjectId && freshVerifiedCapture.amountReceivedMinor === paymentFact.amountMinor && (!order.stripePaymentId || order.stripePaymentId === freshVerifiedCapture.paymentIntentId));
  if (paymentFact.classification?.primary !== 'customer' || paymentFact.provider !== 'stripe' || paymentFact.providerMode !== 'live' || paymentFact.environment !== environment || environment !== 'production' || order.paymentMode && order.paymentMode !== 'live' || order.isTest === true || order.isComp === true || order.isFounderTest === true || paymentFact.orderId !== orderId || (process.env.STRIPE_ACCOUNT_ID && paymentFact.providerAccountId !== process.env.STRIPE_ACCOUNT_ID) || !Number.isSafeInteger(orderAmount) || orderAmount !== paymentFact.amountMinor || !(persistedCaptureMatches || freshCaptureMatches)) return false;
  const evidence = order.marketingConsentEvidence;
  const binding = typeof evidence?.sessionBinding === 'string' ? evidence.sessionBinding : '';
  const consentRef = binding ? firestoreDb.collection(CONSENT_CURRENT).doc(binding) : null;
  const clickRefs = Array.from({ length: 6 }, (_, index) => firestoreDb.collection(CLICK_EVIDENCE).doc(`${orderId}_${index}`));
  const reads = await Promise.all([
    tx.get(firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(googleConversionOutboxId(environment, orderId))),
    ...(consentRef ? [tx.get(consentRef)] : []),
    ...clickRefs.map(ref => tx.get(ref)),
  ]);
  const rowRef = firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(googleConversionOutboxId(environment, orderId));
  const existing = reads[0];
  if (existing.exists) return false;
  const consentDoc = consentRef ? reads[1] : null;
  const clickStart = consentRef ? 2 : 1;
  const consentDocData = consentDoc?.data() as Record<string, unknown> | undefined;
  const consent = consentDocData && consentDocData.status === 'granted' && consentDocData.grantId === evidence?.grantId
    ? { status: 'granted' as const, version: 1 as const, grantId: String(consentDocData.grantId), sessionBinding: binding, recordedAt: String(consentDocData.recordedAt || ''), gpc: consentDocData.gpc === true }
    : { status: 'withdrawn' as const, version: 1 as const, sessionBinding: binding, gpc: consentDocData?.gpc === true };
  const clickEntries = reads.slice(clickStart).flatMap((snap: any, index: number) => {
    if (!snap.exists) return [];
    const data = snap.data() as Record<string, unknown>;
    const click: RawClick = { type: data.type as RawClick['type'], value: String(data.value || ''), observedAt: asIso(data.observedAt), expiresAt: asIso(data.expiresAt) };
    return [{ click, ref: clickRefs[index] }];
  });
  const snapshot = order.acquisitionV2;
  const chosenEntry = clickEntries.find(({ click }) => click.type === 'gclid' && snapshot?.currentSession?.clicks.some(e => e.type === 'gclid' && e.digest === crypto.createHash('sha256').update(click.value).digest('hex') && e.expiresAt === click.expiresAt));
  const chosen = chosenEntry?.click;
  const campaignId = snapshot?.currentSession?.campaignId;
  const campaignKey = campaignId ? `google:cpc:${campaignId}` : '';
  const destination = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
  const candidate = evaluateGoogleConversionEligibility({
    order: { ...order, id: orderId, marketingConsentEvidence: consent },
    paymentFact: paymentFact as any,
    click: chosen,
    consent,
    environment,
    now,
    destinationApproved: Boolean(destination),
  });
  const ref = chosenEntry?.ref;
  const status: GoogleDeliveryStatus = candidate.eligible ? 'ready' : 'held';
  tx.create(rowRef, sanitizeFirestoreData({
    schemaVersion: 1, environment, outboxId: rowRef.id, orderId, paymentFactId: paymentFact.factId,
    kind: 'google_offline_conversion', status,
    payloadVersion: 1, deliveryMode: null, exportBatchId: null,
    ...(ref && chosen ? { clickEvidenceRef: `${CLICK_EVIDENCE}/${ref.id}`, clickExpiresAt: chosen.expiresAt } : {}),
    ...(campaignKey && getRegisteredCampaign(campaignKey) ? { campaignKey } : {}),
    consentSessionBinding: binding || null,
    consentGrantId: consent.grantId || null,
    amountMinor: paymentFact.amountMinor, currency: paymentFact.currency,
    effectiveAt: paymentFact.effectiveAt,
    diagnosticCodes: boundedReasons(candidate.reasons),
    createdAt: new Date(now).toISOString(), attempts: 0, leaseOwner: null, leaseUntil: null,
    submittedAt: null, processingAcceptedAt: null, attributedAt: null,
  }));
  return true;
}

/** Return only an opaque, sanitized diagnostic record; never include click IDs or provider bodies. */
export function sanitizeGoogleDeliveryDiagnostic(input: { status: GoogleDeliveryStatus; code?: string; retryable?: boolean }) {
  return { status: input.status, code: (input.code || 'REDACTED').replace(/[^A-Z0-9_]/gi, '_').slice(0, 60), retryable: input.retryable === true };
}

export async function currentConsentGrantMatches(sessionBinding: string, grantId: string) {
  return consentIsCurrentlyGranted(sessionBinding, grantId);
}

/** Audited local repair for a missed queue write; verifies the durable Stripe capture/order binding first. */
export async function repairGoogleConversionOutbox(orderId: string, environment: 'local' | 'staging' | 'production') {
  if (environment !== 'production' || !/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) throw new Error('GOOGLE_REPAIR_SCOPE_INVALID');
  const orderRef = firestoreDb.collection('orders').doc(orderId);
  return firestoreDb.runTransaction(async tx => {
    const orderSnap = await tx.get(orderRef);
    const order = orderSnap.data() as (Order & { paymentFactId?: string; amountReceivedInCents?: number; marketingConsentEvidence?: Record<string, unknown> }) | undefined;
    if (!orderSnap.exists || !order || order.id !== orderId || !order.paymentFactId) throw new Error('GOOGLE_CAPTURE_NOT_VERIFIED');
    const factRef = firestoreDb.collection(PAYMENT_FACTS).doc(order.paymentFactId);
    const factSnap = await tx.get(factRef);
    const fact = factSnap.data() as Record<string, any> | undefined;
    const amount = order.finalAmountInCents ?? order.amountInCents;
    if (!factSnap.exists || !fact || fact.product !== 'docketstamp' || fact.environment !== 'production' || fact.kind !== 'capture' || fact.verification !== 'verified' || fact.provider !== 'stripe' || fact.providerMode !== 'live' || fact.classification?.primary !== 'customer' || fact.orderId !== orderId || fact.factId !== order.paymentFactId || fact.providerObjectId !== order.stripePaymentId || !fact.providerAccountId || process.env.STRIPE_ACCOUNT_ID && fact.providerAccountId !== process.env.STRIPE_ACCOUNT_ID || order.paymentMode !== 'live' || order.isTest || order.isComp || order.isFounderTest || !Number.isSafeInteger(amount) || amount !== fact.amountMinor || order.amountReceivedInCents !== fact.amountMinor) throw new Error('GOOGLE_CAPTURE_NOT_VERIFIED');
    const created = await createGoogleConversionOutboxInTransaction(tx, {
      order, orderId, paymentFact: fact, environment, now: Date.now(),
    });
    return created ? { status: 'created' as const, outboxId: googleConversionOutboxId(environment, orderId) } : { status: 'already_present' as const };
  });
}

/** Append a versioned net-revenue adjustment after verified refund facts; never creates a second purchase. */
export async function recordGoogleConversionRefundAdjustment(orderId: string, environment: 'local' | 'staging' | 'production') {
  const id = googleConversionOutboxId(environment, orderId);
  const outboxRef = firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(id);
  const [outboxSnap, factsSnap] = await Promise.all([
    outboxRef.get(),
    firestoreDb.collection(PAYMENT_FACTS).where('orderId', '==', orderId).get(),
  ]);
  if (!outboxSnap.exists) return { recorded: false, reason: 'OUTBOX_NOT_FOUND' as const };
  const outbox = outboxSnap.data() as Record<string, any>;
  const facts = factsSnap.docs.map(doc => doc.data() as Record<string, any>);
  const capture = facts.find(fact => fact.factId === outbox.paymentFactId && fact.kind === 'capture' && fact.product === 'docketstamp' && fact.environment === environment && fact.providerMode === 'live' && fact.classification?.primary === 'customer' && fact.verification === 'verified' && fact.currency === outbox.currency);
  if (!capture || !Number.isSafeInteger(capture.amountMinor)) return { recorded: false, reason: 'CAPTURE_NOT_VERIFIED' as const };
  const refunds = facts.filter(fact => fact.kind === 'refund' && fact.product === 'docketstamp' && fact.environment === environment && fact.providerMode === 'live' && fact.classification?.primary === 'customer' && fact.verification === 'verified' && fact.currency === capture.currency);
  const refundedMinor = Math.min(capture.amountMinor, refunds.reduce((sum, fact) => sum + (Number.isSafeInteger(fact.amountMinor) ? fact.amountMinor : 0), 0));
  if (refundedMinor <= 0) return { recorded: false, reason: 'NO_REFUND' as const };
  const refundFactIds = refunds.map(fact => String(fact.factId)).sort();
  const sourceDigest = crypto.createHash('sha256').update(refundFactIds.join('|')).digest('hex');
  const adjustmentId = crypto.createHash('sha256').update(`${id}:refund:${sourceDigest}`).digest('hex');
  const adjustmentRef = firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(adjustmentId);
  await firestoreDb.runTransaction(async tx => {
    const [freshOutbox, priorAdjustment] = await Promise.all([tx.get(outboxRef), tx.get(adjustmentRef)]);
    if (!freshOutbox.exists || priorAdjustment.exists) return;
    const fresh = freshOutbox.data() as Record<string, any>;
    const version = Number(fresh.adjustmentVersion || 0) + 1;
    const adjustedAmountMinor = Math.min(Number(fresh.adjustedAmountMinor ?? capture.amountMinor), Math.max(0, capture.amountMinor - refundedMinor));
    tx.create(adjustmentRef, sanitizeFirestoreData({
      schemaVersion: 1, environment, outboxId: adjustmentId, parentOutboxId: id,
      kind: 'google_conversion_adjustment', status: 'adjustment_pending',
      deliveryMode: fresh.deliveryMode || null, orderId,
      transactionId: crypto.createHash('sha256').update(`docketstamp:google:${environment}:${orderId}`).digest('hex').slice(0, 40),
      sourceRefundFactIds: refundFactIds, sourceDigest, adjustmentVersion: version,
      originalAmountMinor: capture.amountMinor, refundedAmountMinor: capture.amountMinor - adjustedAmountMinor,
      adjustedAmountMinor, currency: capture.currency,
      effectiveAt: new Date().toISOString(), diagnosticCodes: ['REFUND_VALUE_ADJUSTMENT_PENDING_RECONCILIATION'],
    }));
    tx.update(outboxRef, { adjustmentVersion: version, latestAdjustmentId: adjustmentId, adjustedAmountMinor, updatedAt: new Date().toISOString() });
  });
  return { recorded: true, adjustmentId, adjustedAmountMinor: Math.min(Number(outbox.adjustedAmountMinor ?? capture.amountMinor), Math.max(0, capture.amountMinor - refundedMinor)), version: Number(outbox.adjustmentVersion || 0) + 1 };
}
