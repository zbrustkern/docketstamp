import { NextRequest, NextResponse } from 'next/server';
import { retrieveStagedDraft } from '../stage-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await params;

    if (!stageId) {
      return NextResponse.json(
        { error: 'Missing stageId parameter.', code: 'MISSING_STAGE_ID' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await retrieveStagedDraft(stageId, {
      consumerResidenceState: req.nextUrl.searchParams.get('consumerResidenceState') || undefined,
      propertyState: req.nextUrl.searchParams.get('propertyState') || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code, ...(result.details ? { details: result.details } : {}) },
        { status: result.status, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(result.draft, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('Unhandled error in GET /api/docket/stage/[stageId]:', err);
    return NextResponse.json(
      { error: 'We couldn’t retrieve this draft. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
