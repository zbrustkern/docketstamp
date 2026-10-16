import { NextRequest, NextResponse } from 'next/server';
import { createStagedDraft, StageDraftRequest } from './stage-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    let body: StageDraftRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body.', code: 'INVALID_JSON' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = createStagedDraft(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          ...(result.details ? { details: result.details } : {}),
        },
        { status: result.status, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        stageId: result.stageId,
        noticeSlug: result.noticeSlug,
        reviewUrl: result.reviewUrl,
        missingRequiredFields: result.missingRequiredFields,
        previewSummary: result.previewSummary,
        pricingTiers: result.pricingTiers,
        expiresAt: result.expiresAt,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('Unhandled error in POST /api/docket/stage:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error while staging draft.', code: 'INTERNAL_ERROR' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
