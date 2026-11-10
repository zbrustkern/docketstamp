import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createConsentSessionToken, GOOGLE_CONVERSION_CONSENT_COOKIE, recordGoogleConversionConsent,
  verifyConsentSessionToken, getMarketingConsentFromRequest,
} from '@/lib/admin-console/advertising/consent';

const bodySchema = z.object({ choice: z.enum(['grant', 'refuse', 'withdraw']) }).strict();
function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 };
}
function withSession(req: NextRequest, response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  if (verifyConsentSessionToken(req.cookies.get(GOOGLE_CONVERSION_CONSENT_COOKIE)?.value)) return response;
  try {
    response.cookies.set(GOOGLE_CONVERSION_CONSENT_COOKIE, createConsentSessionToken(), cookieOptions());
    return response;
  } catch {
    const unavailable = NextResponse.json({ error: 'CONSENT_PREFERENCES_UNAVAILABLE' }, { status: 503 });
    unavailable.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return unavailable;
  }
}

export async function GET(req: NextRequest) {
  const evidence = await getMarketingConsentFromRequest(req);
  const response = withSession(req, NextResponse.json({ status: evidence.status, version: evidence.version, gpc: evidence.gpc }));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || req.url).origin;
  if (!origin || origin !== allowedOrigin) {
    const denied = NextResponse.json({ error: 'ORIGIN_DENIED' }, { status: 403 });
    denied.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return denied;
  }
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); } catch {
    const invalid = NextResponse.json({ error: 'INVALID_CONSENT_CHOICE' }, { status: 400 });
    invalid.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return invalid;
  }
  const priorToken = req.cookies.get(GOOGLE_CONVERSION_CONSENT_COOKIE)?.value;
  let token = verifyConsentSessionToken(priorToken) ? priorToken! : '';
  try {
    if (!token) token = createConsentSessionToken();
    const gpc = req.headers.get('sec-gpc') === '1';
    const status = body.choice === 'grant' ? 'granted' : body.choice === 'refuse' ? 'denied' : 'withdrawn';
    const evidence = await recordGoogleConversionConsent({ token, status, gpc });
    const response = NextResponse.json({ status: evidence.status, version: evidence.version, gpc: evidence.gpc });
    if (!verifyConsentSessionToken(priorToken)) response.cookies.set(GOOGLE_CONVERSION_CONSENT_COOKIE, token, cookieOptions());
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  } catch {
    const unavailable = NextResponse.json({ error: 'CONSENT_PREFERENCES_UNAVAILABLE' }, { status: 503 });
    unavailable.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return unavailable;
  }
}
