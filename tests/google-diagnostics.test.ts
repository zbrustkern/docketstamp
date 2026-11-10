import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { generateAdminSessionToken } from '../lib/admin-auth';
import { firestoreDb } from '../lib/firebase-admin';
import { GET } from '../app/api/admin/google-conversions/route';

test('conversion diagnostics require private evidence permission and exclude raw payloads', async () => {
  process.env.ADMIN_SESSION_SIGNING_KEY = 'offline_google_diagnostics_signing_key_12345678';
  process.env.ENVIRONMENT = 'staging';
  const url = 'http://localhost:3000/api/admin/google-conversions';
  assert.equal((await GET(new NextRequest(url))).status, 401);
  await firestoreDb.collection('google_conversion_outbox_v1').doc('fixture_held').set({
    environment: 'staging', orderId: 'fixture_order', status: 'held', attempts: 0,
    rawClick: 'never_return_this_click', email: 'private@example.invalid',
    payload: { gclid: 'never_return_this_click' },
    diagnosticCodes: ['CONSENT_REQUIRED', 'PRIVATE DATA'],
  });
  await firestoreDb.collection('google_conversion_outbox_v1').doc('fixture_production').set({
    environment: 'production', orderId: 'production_order', status: 'submitted',
  });
  const response = await GET(new NextRequest(url, { headers: { Cookie: `docketstamp_admin_session=${generateAdminSessionToken()}` } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.exportEnabled, false);
  assert.equal(body.apiEnabled, false);
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.rows[0].diagnosticCodes, ['CONSENT_REQUIRED']);
  assert.equal(JSON.stringify(body).includes('never_return'), false);
  assert.equal(JSON.stringify(body).includes('private@example'), false);
  assert.equal(JSON.stringify(body).includes('production_order'), false);
});
