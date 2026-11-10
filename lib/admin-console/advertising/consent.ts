import crypto from 'node:crypto';
import { firestoreDb, sanitizeFirestoreData } from '@/lib/firebase-admin';
import { serverEnvironment } from '@/lib/admin-console/commands/access';

export const GOOGLE_CONVERSION_CONSENT_VERSION = 1 as const;
export const GOOGLE_CONVERSION_CONSENT_MAX_AGE_MS = 30 * 86400000;
export const GOOGLE_CONVERSION_CONSENT_COOKIE = 'docketstamp_gads_consent_session_v1';
export type GoogleConversionConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'unknown';
export interface GoogleConversionConsentEvidence {
  status: GoogleConversionConsentStatus;
  version: 1;
  grantId?: string;
  sessionBinding: string;
  recordedAt?: string;
  gpc: boolean;
}
export type MarketingConsentEvidence = GoogleConversionConsentEvidence;

function signingKey(): string {
  const key = process.env.GOOGLE_CONVERSION_CONSENT_SIGNING_KEY || process.env.ADMIN_SESSION_SIGNING_KEY || '';
  if (key.length < 32) throw new Error('CONSENT_SIGNING_KEY_UNAVAILABLE');
  return key;
}
function hmac(value: string): string {
  return crypto.createHmac('sha256', signingKey()).update(value).digest('hex');
}
function digest(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function docId(value: string): string { return digest(value); }

export function createConsentSessionToken(sessionNonce = crypto.randomBytes(32).toString('base64url')): string {
  return `${sessionNonce}.${hmac(`gads-consent-session:${sessionNonce}`)}`;
}
export function verifyConsentSessionToken(token: string | undefined): string | null {
  if (!token || token.length > 256) return null;
  const [nonce, signature, ...rest] = token.split('.');
  if (rest.length || !/^[A-Za-z0-9_-]{32,80}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  let expected: string;
  try { expected = hmac(`gads-consent-session:${nonce}`); } catch { return null; }
  const actualBytes = Buffer.from(signature, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes) ? nonce : null;
}

export async function recordGoogleConversionConsent(input: {
  token: string;
  status: Exclude<GoogleConversionConsentStatus, 'unknown'>;
  gpc: boolean;
  now?: number;
}): Promise<GoogleConversionConsentEvidence> {
  const nonce = verifyConsentSessionToken(input.token);
  if (!nonce) throw new Error('CONSENT_SESSION_INVALID');
  const now = input.now ?? Date.now();
  const recordedAt = new Date(now).toISOString();
  const sessionBinding = digest(nonce);
  const status = input.gpc ? 'denied' : input.status;
  const grantId = status === 'granted' ? crypto.randomUUID() : undefined;
  const currentRef = firestoreDb.collection('google_conversion_consent_v1').doc(sessionBinding);
  const evidenceRef = firestoreDb.collection('google_conversion_consent_evidence_v1').doc(docId(`${sessionBinding}:${recordedAt}:${status}:${crypto.randomUUID()}`));
  await firestoreDb.runTransaction(async tx => {
    const current = await tx.get(currentRef);
    const priorVersion = Number(current.data()?.revision || 0);
    const row = sanitizeFirestoreData({
      schemaVersion: 1, purpose: 'google_offline_conversion', status,
      consentVersion: GOOGLE_CONVERSION_CONSENT_VERSION, revision: priorVersion + 1,
      environment: serverEnvironment(), sessionBinding, ...(grantId ? { grantId } : {}), gpc: input.gpc, recordedAt,
    });
    tx.set(currentRef, row);
    tx.create(evidenceRef, row);
  });
  return { status, version: 1, ...(grantId ? { grantId } : {}), sessionBinding, recordedAt, gpc: input.gpc };
}

/** Verify server-recorded purpose consent against the HttpOnly signed browser session. */
export async function getMarketingConsentFromRequest(
  req: { cookies: { get(name: string): { value: string } | undefined }; headers: { get(name: string): string | null } },
  _businessSessionId?: string,
): Promise<GoogleConversionConsentEvidence> {
  try {
    const nonce = verifyConsentSessionToken(req.cookies.get(GOOGLE_CONVERSION_CONSENT_COOKIE)?.value);
    const gpc = req.headers.get('sec-gpc') === '1';
    if (!nonce) return { status: 'unknown', version: 1, sessionBinding: '', gpc };
    const sessionBinding = digest(nonce);
    const snap = await firestoreDb.collection('google_conversion_consent_v1').doc(sessionBinding).get();
    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data || data.purpose !== 'google_offline_conversion' || data.consentVersion !== 1 || data.environment !== serverEnvironment()) {
      return { status: 'unknown', version: 1, sessionBinding, gpc };
    }
    if (gpc && data.status === 'granted') {
      // Persist the GPC signal so a later request without the header cannot revive a grant.
      const token = req.cookies.get(GOOGLE_CONVERSION_CONSENT_COOKIE)?.value;
      if (token) await recordGoogleConversionConsent({ token, status: 'denied', gpc: true });
      return { status: 'denied', version: 1, sessionBinding, recordedAt: new Date().toISOString(), gpc: true };
    }
    if (gpc || data.gpc === true || data.status !== 'granted' || typeof data.grantId !== 'string') {
      return { status: gpc || data.gpc === true ? 'denied' : (data.status as GoogleConversionConsentStatus), version: 1, sessionBinding, recordedAt: String(data.recordedAt || ''), gpc: gpc || data.gpc === true };
    }
    const recordedAtMs = Date.parse(String(data.recordedAt || ''));
    const now = Date.now();
    if (!Number.isFinite(recordedAtMs) || recordedAtMs > now || now - recordedAtMs > GOOGLE_CONVERSION_CONSENT_MAX_AGE_MS) {
      return { status: 'unknown', version: 1, sessionBinding, gpc: false };
    }
    return { status: 'granted', version: 1, grantId: data.grantId, sessionBinding, recordedAt: String(data.recordedAt || ''), gpc: false };
  } catch {
    return { status: 'unknown', version: 1, sessionBinding: '', gpc: req.headers.get('sec-gpc') === '1' };
  }
}

export async function consentIsCurrentlyGranted(sessionBinding: string, grantId: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(sessionBinding) || !grantId) return false;
  const snap = await firestoreDb.collection('google_conversion_consent_v1').doc(sessionBinding).get();
  const data = snap.data() as Record<string, unknown> | undefined;
  const recordedAt = Date.parse(String(data?.recordedAt || ''));
  const now = Date.now();
  return Boolean(data && data.status === 'granted' && data.grantId === grantId && data.gpc !== true && data.consentVersion === 1 && data.environment === serverEnvironment() && Number.isFinite(recordedAt) && recordedAt <= now && now - recordedAt <= GOOGLE_CONVERSION_CONSENT_MAX_AGE_MS);
}
