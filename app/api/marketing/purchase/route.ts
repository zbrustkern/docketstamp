import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMarketingConsentFromRequest } from '@/lib/admin-console/advertising/consent';
import { readWebPurchase } from '@/lib/admin-console/advertising/web-purchase';

const requestSchema = z.object({ orderId: z.string().regex(/^order_[a-zA-Z0-9_-]{1,110}$/), probe: z.boolean() }).strict();
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function POST(req: NextRequest) {
  const empty = () => new NextResponse(null, { status: 204, headers });
  if (process.env.ENVIRONMENT !== 'production' || process.env.FIREBASE_PROJECT_ID !== 'docketstamp'
    || process.env.GOOGLE_ENHANCED_WEB_PURCHASES !== 'true' || req.headers.get('origin') !== 'https://docketstamp.com') return empty();
  try {
    const body = requestSchema.safeParse(await req.json());
    if (!body.success) return empty();
    const consent = await getMarketingConsentFromRequest(req);
    const result = await readWebPurchase(body.data.orderId, consent, body.data.probe);
    if (!result) return empty();
    return NextResponse.json(result, { headers, status: 'pending' in result ? 202 : 200 });
  } catch {
    return new NextResponse(null, { status: 503, headers });
  }
}
