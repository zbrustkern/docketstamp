import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';

export async function recordMarketingEgressReceipt(params: {
  provider: 'google_ads' | 'meta_capi' | 'meta_pixel';
  status: 'accepted' | 'rejected' | 'disabled' | 'unavailable';
  correlationId: string;
  reasonCode: 'consent_unknown' | 'privacy_signal' | 'missing_authority' | 'provider_accepted' | 'provider_rejected' | 'provider_unavailable';
}): Promise<void> {
  const receiptId = `${params.provider}:${params.correlationId}`.slice(0, 180);
  await firestoreDb.collection('business_egress_receipts_v1').doc(receiptId).set(
    sanitizeFirestoreData({
      schemaVersion: 1,
      product: 'docketstamp',
      provider: params.provider,
      status: params.status,
      reasonCode: params.reasonCode,
      correlationId: params.correlationId,
      occurredAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}
