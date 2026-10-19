import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, generateAdminSessionToken } from '../../lib/admin-auth';
import { requireCapability } from '../../lib/admin-console/commands/access';
import { beginCommand, finishCommand } from '../../lib/admin-console/commands/audit';

async function run() {
  process.env.ADMIN_SESSION_SIGNING_KEY = 'fixture_signing_secret_not_a_production_key';
  const token = generateAdminSessionToken();
  const req = (origin?: string) => new NextRequest('http://localhost:3000/api/admin/command', { method: 'POST', headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}`, ...(origin ? { origin } : {}) } });
  assert.throws(() => requireCapability(req(), 'postal.dispatch', true), /ORIGIN_DENIED/);
  assert.throws(() => requireCapability(req('https://other.invalid'), 'postal.dispatch', true), /ORIGIN_DENIED/);
  assert.equal(requireCapability(req('http://localhost:3000'), 'postal.dispatch', true).role, 'owner');
  process.env.ADMIN_ROLE_ASSIGNMENTS = JSON.stringify({ 'zbrustkern@gmail.com': 'viewer' });
  assert.throws(() => requireCapability(req('http://localhost:3000'), 'postal.dispatch', true), /CAPABILITY_DENIED/);
  delete process.env.ADMIN_ROLE_ASSIGNMENTS;
  const input = { capability: 'postal.dispatch' as const, action: 'retry', targetType: 'order', targetId: 'ord_fixture', requestId: 'request-fixture-0001', reason: 'Review verified evidence', effectSummary: 'Submit existing frozen document' };
  const first = await beginCommand(req('http://localhost:3000'), input);
  assert.equal(first.duplicate, false);
  await finishCommand(first.auditId, 'succeeded', 'ACCEPTED');
  const duplicate = await beginCommand(req('http://localhost:3000'), input);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.status, 'succeeded');
  await assert.rejects(beginCommand(req('http://localhost:3000'), { ...input, targetId: 'other' }), /REQUEST_CONFLICT/);
  console.log('Capability, origin and idempotent pending/result audit tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
