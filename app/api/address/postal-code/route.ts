import { NextRequest, NextResponse } from 'next/server';
import { lookupUsPostalCode } from '@/lib/docket/us-postal-code-lookup';

export const dynamic = 'force-dynamic';
const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' };

export function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get('zip') || '';
  if (!/^\d{5}(?:-\d{4})?$/.test(zip.trim())) {
    return NextResponse.json(
      { error: 'Enter a valid five-digit US ZIP code.' },
      { status: 400, headers: PRIVATE_NO_STORE }
    );
  }

  return NextResponse.json(
    { locations: lookupUsPostalCode(zip) },
    { headers: PRIVATE_NO_STORE }
  );
}
