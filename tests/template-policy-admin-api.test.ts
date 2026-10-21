import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';

test('admin template API enforces access/origin, CAS, and same-request replay', async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test', USE_MOCK_FIRESTORE: 'true', ENVIRONMENT: 'staging',
    ADMIN_SESSION_SIGNING_KEY: 'template-governance-signing-fixture-only',
  });
  const [{ firestoreDb }, { GET, POST }, auth] = await Promise.all([
    import('../lib/firebase-admin'),
    import('../app/api/admin/console/templates/route'),
    import('../lib/admin-auth'),
  ]);
  await firestoreDb.collection('template_availability_v1').doc('policy_staging').delete();
  const routeUrl = 'https://staging.docketstamp.com/api/admin/console/templates';
  const token = auth.generateAdminSessionToken();
  const request = (method = 'GET', body?: unknown, origin = 'https://staging.docketstamp.com') => new NextRequest(routeUrl, {
    method,
    headers: { cookie: `${auth.ADMIN_COOKIE_NAME}=${token}`, ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}) },
    ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await GET(new NextRequest(routeUrl))).status, 401);
  process.env.ADMIN_ROLE_ASSIGNMENTS = JSON.stringify({ 'zbrustkern@gmail.com': 'viewer' });
  const readOnly = await GET(request());
  assert.equal(readOnly.status, 200);
  assert.equal((await readOnly.json()).canManage, false);
  const forbidden = await POST(request('POST', {}));
  assert.equal(forbidden.status, 403);
  delete process.env.ADMIN_ROLE_ASSIGNMENTS;
  const initial = await GET(request());
  assert.equal((await initial.json()).canManage, true);

  const runId = Date.now().toString();
  const mutation = {
    action: 'set_global', requestId: `admin-policy-${runId}`, reason: 'Test global pause toggling.', expectedRevision: 0,
    global: { enabled: false, requireCurrentReview: false, residence: { mode: 'all', states: [] }, property: { mode: 'all', states: [] } },
  };
  assert.equal((await POST(request('POST', mutation, 'https://evil.example'))).status, 403);
  const saved = await POST(request('POST', mutation));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  const replay = await POST(request('POST', mutation));
  assert.equal((await replay.json()).duplicate, true);
  const afterMutation = await GET(request());
  const adminResult = await afterMutation.json();
  assert.equal(adminResult.recentChanges[0].revision, 1);
  assert.equal(adminResult.recentChanges[0].reason, mutation.reason);
  assert.equal((await firestoreDb.collection('template_policy_audit_v1').get()).size >= 1, true);
  assert.equal((await POST(request('POST', { ...mutation, reason: 'Conflicting replay.' }))).status, 409);
  assert.equal((await POST(request('POST', { ...mutation, requestId: `admin-policy-stale-${runId}`, expectedRevision: 0 }))).status, 409);
  assert.equal((await POST(request('POST', { ...mutation, requestId: `admin-policy-invalid-${runId}`, expectedRevision: 1, global: { ...mutation.global, residence: { mode: 'allowlist', states: ['ZZ'] } } }))).status, 400);

  await firestoreDb.collection('template_availability_v1').doc('policy_staging').set({ poisoned: 'Firebase internal diagnostic fixture' });
  const unavailable = await GET(request());
  assert.equal(unavailable.status, 503);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.code, 'TEMPLATE_POLICY_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(unavailableBody), /Firebase internal diagnostic fixture|Zod|invalid_type/i);
  await firestoreDb.collection('template_availability_v1').doc('policy_staging').delete();
});
