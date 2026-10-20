import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminSessionEmail, isAuthorizedAdminEmail, verifyAdminAuth } from '@/lib/admin-auth';

export const CAPABILITIES = ['reports.read', 'evidence.private', 'postal.reconcile', 'postal.dispatch', 'postal.comp', 'money.reconcile', 'offers.manage', 'incidents.manage', 'controls.manage', 'alerts.send', 'outreach.send'] as const;
export type Capability = typeof CAPABILITIES[number];
export type AdminRole = 'viewer' | 'operator' | 'commercial' | 'owner';
const roleCaps: Record<AdminRole, readonly Capability[]> = {
  viewer: ['reports.read'],
  operator: ['reports.read', 'evidence.private', 'postal.reconcile', 'postal.dispatch', 'money.reconcile', 'incidents.manage'],
  commercial: ['reports.read', 'offers.manage'],
  owner: CAPABILITIES,
};
export class AdminAccessError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export function requireCapability(req: NextRequest, capability: Capability, mutation = false) {
  if (!verifyAdminAuth(req)) throw new AdminAccessError(401, 'ADMIN_AUTH_REQUIRED');
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const email = cookie ? getAdminSessionEmail(cookie) : null;
  let role: AdminRole = 'viewer';
  let actorId = 'service:admin-api';
  if (email && isAuthorizedAdminEmail(email)) {
    actorId = email;
    // Compatibility mapping preserves existing account-bound admins' privileges.
    // Explicit assignments can narrow access; a malformed assignment fails closed.
    if (process.env.ADMIN_ROLE_ASSIGNMENTS) {
      let assignments: Record<string, unknown>;
      try { assignments = JSON.parse(process.env.ADMIN_ROLE_ASSIGNMENTS); }
      catch { throw new AdminAccessError(503, 'ADMIN_ROLES_INVALID'); }
      const assigned = assignments[email];
      if (!['viewer', 'operator', 'commercial', 'owner'].includes(String(assigned))) throw new AdminAccessError(403, 'ADMIN_ROLE_UNASSIGNED');
      role = assigned as AdminRole;
    } else role = 'owner';
    if (!roleCaps[role].includes(capability)) throw new AdminAccessError(403, 'ADMIN_CAPABILITY_DENIED');
    if (mutation) {
      const origin = req.headers.get('origin');
      const allowed = new URL(process.env.NEXT_PUBLIC_APP_URL || req.url).origin;
      if (!origin || origin !== allowed || !['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        throw new AdminAccessError(403, 'ADMIN_ORIGIN_DENIED');
      }
    }
  } else {
    const configured = (process.env.ADMIN_SERVICE_CAPABILITIES || 'reports.read').split(',');
    if (!configured.includes(capability)) throw new AdminAccessError(403, 'SERVICE_CAPABILITY_DENIED');
  }
  return { actorId, actorKind: email ? 'human' as const : 'service' as const, role };
}

export function serverEnvironment(): 'local' | 'staging' | 'production' {
  if (process.env.ENVIRONMENT === 'staging') return 'staging';
  return process.env.NODE_ENV === 'production' ? 'production' : 'local';
}
