import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, generateAdminSessionToken } from '../../lib/admin-auth';

async function run() {
  // Fake credentials only. The offline runner denies all provider transport.
  const fixtures = {
    STRIPE_SECRET_KEY: 'sk_test_configuration_fixture_only',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_configuration_fixture_only',
    STRIPE_WEBHOOK_SECRET: 'whsec_configuration_fixture_only',
    LOB_DISPATCH_API_KEY: 'test_configuration_fixture_only',
    LOB_WEBHOOK_SECRET: 'lob_configuration_fixture_only',
    ADMIN_SESSION_SIGNING_KEY: 'signing_configuration_fixture_only',
  };
  Object.assign(process.env, fixtures, { ENVIRONMENT: 'staging', FIREBASE_PROJECT_ID: 'docketstamp-staging' });
  const { GET } = await import('../../app/api/admin/console/config/route');
  const url = 'https://staging.docketstamp.com/api/admin/console/config';
  assert.equal((await GET(new NextRequest(url))).status, 401);
  const token = generateAdminSessionToken();
  const request = () => new NextRequest(url, { headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` } });
  process.env.ADMIN_ROLE_ASSIGNMENTS = JSON.stringify({ 'zbrustkern@gmail.com': 'viewer' });
  assert.equal((await GET(request())).status, 403);
  delete process.env.ADMIN_ROLE_ASSIGNMENTS;
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const raw = await response.text();
  for (const value of Object.values(fixtures)) assert.equal(raw.includes(value), false, 'No credential value may leave this route');
  const body = JSON.parse(raw);
  assert.equal(body.authority, 'configuration_only_not_provider_verification');
  assert.equal(body.environment, 'staging');
  assert.equal(body.stripe.paymentMode, 'stripe_test');
  assert.equal(body.stripe.compiledPublishableKeyMode, 'test');
  assert.equal(body.lob.dispatchMode, 'test_api');
  assert.equal(body.lob.addressVerificationMode, 'deterministic_mock');
  delete process.env.STRIPE_WEBHOOK_SECRET;
  process.env.LOB_DISPATCH_API_KEY = 'live_wrong_environment_fixture_only';
  const wrong = await (await GET(request())).json();
  assert.equal(wrong.stripe.webhookSecretConfigured, false);
  assert.equal(wrong.lob.dispatchMode, 'unconfigured');
  console.log('Configuration diagnostics protect credentials, enforce owner access, and distinguish unsafe/missing modes.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
