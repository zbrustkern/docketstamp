import { createHash } from 'node:crypto';
import { z } from 'zod';
import { firestoreDb } from '@/lib/firebase-admin';
import { getVerifiedPaymentObligation } from '@/lib/admin-console/finance/authority';
import { clickDigest } from '@/lib/acquisition';
import { googleConversionOutboxId, GOOGLE_CONVERSION_OUTBOX } from './outbox';
import { usesEnhancedWebMeasurement } from './web-purchase-scope';
import { isMeasurementPermitted, type GoogleConversionConsentEvidence } from './consent';

// Verified against the event snippet of the DocketStamp campaign-specific website action.
export const WEB_PURCHASE_DESTINATION = 'AW-18474411963/F26fCPmG2rUdELvPpOlE';

export function hashedCheckoutEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!z.email().safeParse(normalized).success) return null;
  const [local, domain] = normalized.split('@');
  const mailbox = domain === 'gmail.com' || domain === 'googlemail.com' ? local.replaceAll('.', '') : local;
  return createHash('sha256').update(mailbox + '@' + domain).digest('hex');
}

export async function readWebPurchase(orderId: string, consent: GoogleConversionConsentEvidence, probe: boolean) {
  if (!isMeasurementPermitted(consent) || !/^[a-f0-9]{64}$/.test(consent.sessionBinding || '')) return null;
  const orderSnapshot = await firestoreDb.collection('orders').doc(orderId).get();
  const order = orderSnapshot.data();
  const grant = order?.marketingConsentEvidence;
  if (!order || order.id !== orderId || order.kind !== 'notice' || order.environment !== 'production'
    || !usesEnhancedWebMeasurement({ noticeId: order.noticeId, marketingConsentEvidence: grant })
    || !isMeasurementPermitted(grant) || grant.sessionBinding !== consent.sessionBinding
    || (grant.grantId && consent.grantId && grant.grantId !== consent.grantId)
    || order.paymentMode !== 'live' || order.isTest || order.isComp || order.isFounderTest
    || order.paymentMethod === 'PROMO_CODE' || order.paymentMethod === 'STUDIO_COMP') return null;
  if (!order.paymentFactId) return probe && order.status === 'PENDING_PAYMENT' ? { pending: true } : null;

  const proof = await getVerifiedPaymentObligation(orderId);
  if (!proof) return null;
  const fact = proof.paymentFact;
  const paidAt = Date.parse(fact.effectiveAt);
  const consentAt = grant.recordedAt ? Date.parse(grant.recordedAt) : null;
  const now = Date.now();
  if (fact.product !== 'docketstamp' || fact.environment !== 'production' || fact.providerMode !== 'live'
    || fact.factId !== order.paymentFactId || fact.classification?.primary !== 'customer'
    || fact.currency !== 'USD' || fact.amountMinor <= 0 || fact.amountMinor !== order.amountReceivedInCents
    || (process.env.STRIPE_ACCOUNT_ID && fact.providerAccountId !== process.env.STRIPE_ACCOUNT_ID)
    || (consentAt !== null && (!Number.isFinite(consentAt) || consentAt > paidAt))
    || !Number.isFinite(paidAt) || paidAt > now || now - paidAt > 86400000) return null;
  const queueId = googleConversionOutboxId('production', orderId);
  const [queue, money] = await Promise.all([
    firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(queueId).get(),
    firestoreDb.collection('payment_facts_v1').where('orderId', '==', orderId).get(),
  ]);
  const row = queue.data();
  if (row?.deliveryMode || money.docs.some(doc => {
    const item = doc.data();
    return item.providerMode === 'live' && item.verification === 'verified' && ['refund', 'dispute_debit', 'dispute_reversal'].includes(item.kind);
  })) return null;
  const emailHash = hashedCheckoutEmail(order.customerEmail || '');
  const candidateTouches = [order.acquisitionV2?.currentSession, order.acquisitionV2?.firstObserved]
    .filter((touch): touch is NonNullable<typeof touch> => Boolean(touch?.source === 'google' && Array.isArray(touch.clicks) && touch.clicks.length));
  if (probe) return emailHash || candidateTouches.length ? { ready: true } : null;
  let click: { type: string; value: string } | undefined;
  if (candidateTouches.length) {
    const docs = await Promise.all(Array.from({ length: 6 }, (_, i) =>
      firestoreDb.collection('acquisition_click_evidence_v2').doc(orderId + '_' + i).get()));
    const savedDocs = docs.map(doc => doc.data());
    outer: for (const touch of candidateTouches) {
      for (const type of ['gclid', 'wbraid', 'gbraid']) {
        const saved = savedDocs.find(item => {
          if (!item || item.orderId !== orderId || item.type !== type || typeof item.value !== 'string'
            || !/^[A-Za-z0-9_.~-]{1,255}$/.test(item.value)) return false;
          const expiresAt = typeof item.expiresAt === 'string' ? item.expiresAt : item.expiresAt?.toDate?.().toISOString();
          return Date.parse(expiresAt) > now && Date.parse(item.observedAt) <= paidAt && touch.clicks.some(
            (e: { type: string; digest: string; expiresAt: string }) =>
              e.type === type && e.expiresAt === expiresAt && e.digest === clickDigest(item.value));
        });
        if (saved) { click = { type, value: saved.value }; break outer; }
      }
    }
  }
  if (!emailHash && !click) return null;
  const measurementStillAllowed = await firestoreDb.runTransaction(async tx => {
    const consentDoc = await tx.get(firestoreDb.collection('google_conversion_consent_v1').doc(consent.sessionBinding));
    if (consentDoc.exists) {
      const current = consentDoc.data();
      if (current?.purpose !== 'google_offline_conversion' || current.environment !== 'production' || current.consentVersion !== 1
        || current.gpc || current.status === 'denied' || current.status === 'withdrawn'
        || current.sessionBinding !== consent.sessionBinding) return false;
    }
    const queueRef = firestoreDb.collection(GOOGLE_CONVERSION_OUTBOX).doc(queueId);
    const latest = (await tx.get(queueRef)).data();
    if (latest?.deliveryMode || latest?.latestAdjustmentId) return false;
    if (latest && !latest.webTagIssuedAt) tx.update(queueRef, { webTagIssuedAt: new Date().toISOString() });
    return true;
  });
  if (!measurementStillAllowed) return null;
  return {
    sendTo: WEB_PURCHASE_DESTINATION,
    ...(emailHash ? { emailHash } : {}),
    value: fact.amountMinor / 100,
    currency: fact.currency,
    transactionId: createHash('sha256').update('docketstamp:google:production:' + orderId).digest('hex').slice(0, 40),
    ...(click ? { click } : {}),
  };
}
