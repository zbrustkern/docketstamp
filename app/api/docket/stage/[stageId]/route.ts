import { NextRequest, NextResponse } from 'next/server';
import { getStagedDraft } from '../stage-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
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

    const draft = getStagedDraft(stageId);

    if (!draft) {
      return NextResponse.json(
        { error: `Staged draft '${stageId}' not found or expired.`, code: 'NOT_FOUND' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(draft, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    console.error('Unhandled error in GET /api/docket/stage/[stageId]:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error retrieving staged draft.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
