import { NextRequest, NextResponse } from 'next/server';
import { firestoreDb } from '@/lib/firebase-admin';
import { AdminAccessError, requireCapability, serverEnvironment } from '@/lib/admin-console/commands/access';
import { getApprovedGoogleDestination, isGoogleDeliveryEnabled } from '@/lib/admin-console/advertising/destination';

export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    requireCapability(req, 'evidence.private');
    const environment = serverEnvironment();
    const destination = getApprovedGoogleDestination(process.env.GOOGLE_ADS_DESTINATION_KEY);
    const snapshot = await firestoreDb.collection('google_conversion_outbox_v1').where('environment', '==', environment).limit(51).get();
    const rows = snapshot.docs.slice(0, 50).map(doc => {
      const data = doc.data();
      const safe = (value: unknown, limit = 80) => typeof value === 'string' && /^[A-Za-z0-9_.:-]+$/.test(value) ? value.slice(0, limit) : null;
      const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
      return {
        id: safe(doc.id, 128), kind: safe(data.kind), orderId: safe(data.orderId, 128), status: safe(data.status),
        attempts: Number.isSafeInteger(data.attempts) && data.attempts >= 0 ? data.attempts : 0,
        diagnosticCodes: Array.isArray(data.diagnosticCodes) ? data.diagnosticCodes.slice(0, 12).map((v: unknown) => safe(v)).filter(Boolean) : [],
        createdAt: instant(data.createdAt), submittedAt: instant(data.submittedAt),
        processingAcceptedAt: instant(data.processingAcceptedAt), attributedAt: instant(data.attributedAt),
        clickExpiresAt: instant(data.clickExpiresAt), nextAttemptAt: instant(data.nextAttemptAt),
      };
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({
      environment, exportEnabled: environment === 'production' && Boolean(destination),
      apiEnabled: environment === 'production' && isGoogleDeliveryEnabled(destination || undefined),
      destinationVerified: Boolean(destination), rows, truncated: snapshot.docs.length > 50,
      message: environment !== 'production' ? 'Staging and local purchases cannot be exported or sent to Google.' : !destination ? 'A compatible DocketStamp conversion destination and explicit activation approval are still required.' : 'Export creates a file; it does not upload or establish Google acceptance.',
    }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AdminAccessError ? error.code : 'GOOGLE_DIAGNOSTICS_UNAVAILABLE' }, { status: error instanceof AdminAccessError ? error.status : 503, headers });
  }
}
