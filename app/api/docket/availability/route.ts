import { NextResponse } from 'next/server';
import { getPublicTemplateAvailability } from '@/lib/template-policy-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const response = await getPublicTemplateAvailability();
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Availability is temporarily unavailable.', code: 'AVAILABILITY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
