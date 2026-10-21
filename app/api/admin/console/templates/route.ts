import { NextRequest, NextResponse } from 'next/server';
import { AdminAccessError, requireCapability } from '@/lib/admin-console/commands/access';
import { commitTemplateMutation, getAdminTemplatesResponse, templateMutationSchema } from '@/lib/template-policy-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Origin' };
const CONFLICT_CODES = new Set(['STALE_REVISION','STALE_CONTENT_DIGEST','REQUEST_ID_CONFLICT']);
const INVALID_CODES = new Set(['UNKNOWN_TEMPLATE','APPROVAL_REVIEW_INVALID','APPROVAL_EVIDENCE_INVALID','REVIEW_EVIDENCE_INVALID']);
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const isAccessError = error instanceof AdminAccessError;
  const code = isAccessError ? error.code
    : CONFLICT_CODES.has(message) || INVALID_CODES.has(message) ? message
    : 'TEMPLATE_POLICY_UNAVAILABLE';
  const status = isAccessError ? error.status
    : CONFLICT_CODES.has(code) ? 409
    : INVALID_CODES.has(code) ? 400
    : 503;
  return NextResponse.json({ error: code, code }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    requireCapability(req, 'reports.read');
    let canManage = false;
    try { requireCapability(req, 'controls.manage'); canManage = true; } catch { /* read-only admin */ }
    const response = await getAdminTemplatesResponse(canManage);
    return NextResponse.json(response, { headers: PRIVATE_HEADERS });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const access = requireCapability(req, 'controls.manage', true);
    if (access.actorKind !== 'human') throw new AdminAccessError(403, 'HUMAN_ADMIN_REQUIRED');
    let raw: unknown;
    try { raw = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON', code: 'INVALID_JSON' }, { status: 400, headers: PRIVATE_HEADERS }); }
    const parsed = templateMutationSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'TEMPLATE_MUTATION_INVALID', code: 'TEMPLATE_MUTATION_INVALID', details: parsed.error.flatten() }, { status: 400, headers: PRIVATE_HEADERS });
    const result = await commitTemplateMutation(access.actorId, parsed.data);
    return NextResponse.json({ success: true, ...result }, { headers: PRIVATE_HEADERS });
  } catch (error) { return errorResponse(error); }
}
