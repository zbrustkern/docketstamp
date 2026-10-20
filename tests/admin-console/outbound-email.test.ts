import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, generateAdminSessionToken } from '../../lib/admin-auth';
import {
  executeOutboundEmail,
  OutboundEmailInputSchema,
  OutboundEmailRecord,
  OutboundEmailStore,
  outboundEmailIdempotencyKey,
} from '../../lib/admin-console/outbound-email';

async function run() {
  process.env.ADMIN_SESSION_SIGNING_KEY = 'offline_outbound_email_signing_fixture';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.ENVIRONMENT = 'staging';
  process.env.FIREBASE_PROJECT_ID = 'docketstamp-staging';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'docketstamp-staging';
  const { POST, GET } = await import('../../app/api/admin/outbound-email/route');
  const token = generateAdminSessionToken();
  const request = (body?: unknown, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/admin/outbound-email', {
    method: 'POST',
    headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}`, origin, 'content-type': 'application/json' },
    body: body === undefined ? '{}' : JSON.stringify(body),
  });

  assert.equal((await POST(new NextRequest('http://localhost:3000/api/admin/outbound-email', { method: 'POST' }))).status, 401, 'anonymous send must be denied');
  assert.equal((await POST(request({}, 'https://other.invalid'))).status, 403, 'cross-origin send must be denied');
  process.env.ADMIN_ROLE_ASSIGNMENTS = JSON.stringify({ 'zbrustkern@gmail.com': 'viewer' });
  assert.equal((await POST(request({}))).status, 403, 'non-owner admin must be denied');
  delete process.env.ADMIN_ROLE_ASSIGNMENTS;

  process.env.RESEND_API_KEY = 'offline_resend_key_fixture';
  assert.equal((await POST(request({ requestId: 'not-a-uuid', to: 'not-an-email', subject: '', message: '' }))).status, 400, 'invalid fields must be rejected');
  assert.equal((await POST(request({ requestId: '00000000-0000-4000-8000-000000000001', to: 'one@example.com, two@example.com', subject: 'x', message: 'x' }))).status, 400, 'multiple recipients must be rejected');
  delete process.env.RESEND_API_KEY;
  assert.equal((await POST(request({ requestId: '00000000-0000-4000-8000-000000000002', to: 'one@example.com', subject: 'x', message: 'x' }))).status, 503, 'missing provider key must fail closed');
  process.env.RESEND_API_KEY = 'offline_resend_key_fixture';

  const input = OutboundEmailInputSchema.parse({ requestId: '00000000-0000-4000-8000-000000000010', to: 'lob@example.com', subject: 'Re: account question', message: 'Plain text correspondence' });
  const records = new Map<string, OutboundEmailRecord & { digest?: string }>();
  const store: OutboundEmailStore = {
    async reserve(params) {
      const prior = records.get(params.requestId);
      const digest = `${params.contentDigest}`;
      if (prior) return prior.digest === digest ? { kind: 'duplicate', record: prior } : { kind: 'conflict' };
      const record = { requestId: params.requestId, environment: params.environment, recipient: params.recipient, subject: params.subject, status: 'pending' as const, actorId: params.actorId, createdAt: params.now, updatedAt: params.now, digest };
      records.set(params.requestId, record);
      return { kind: 'reserved', record };
    },
    async complete(id, _environment, status, providerId) {
      const record = records.get(id)!;
      records.set(id, { ...record, status, providerId, updatedAt: new Date().toISOString() });
    },
  };
  let sends = 0;
  const accepted = await executeOutboundEmail({ input, environment: 'staging', actorId: 'admin@example.com', now: new Date().toISOString(), apiKey: 'fixture', store, send: async (params) => {
    sends++;
    assert.equal(params.idempotencyKey, outboundEmailIdempotencyKey('staging', input.requestId));
    return { status: 'accepted', providerId: 're_fixture_acceptance' };
  } });
  assert.equal(accepted.status, 'accepted');
  const duplicate = await executeOutboundEmail({ input, environment: 'staging', actorId: 'admin@example.com', now: new Date().toISOString(), apiKey: 'fixture', store, send: async () => { sends++; return { status: 'accepted' }; } });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.providerId, 're_fixture_acceptance');
  assert.equal(sends, 1, 'duplicate request must not call provider again');
  await assert.rejects(() => executeOutboundEmail({ input: { ...input, message: 'changed body' }, environment: 'staging', actorId: 'admin@example.com', now: new Date().toISOString(), apiKey: 'fixture', store, send: async () => ({ status: 'accepted' }) }), /REQUEST_CONFLICT/);
  await assert.rejects(() => executeOutboundEmail({ input, environment: 'staging', actorId: 'admin@example.com', now: new Date().toISOString(), store, send: async () => ({ status: 'accepted' }) }), /NOT_CONFIGURED/);

  const failureInput = { ...input, requestId: '00000000-0000-4000-8000-000000000011' };
  const failed = await executeOutboundEmail({ input: failureInput, environment: 'staging', actorId: 'admin@example.com', now: new Date().toISOString(), apiKey: 'fixture', store, send: async () => { throw new Error('provider timeout'); } });
  assert.equal(failed.status, 'uncertain', 'transport failure must not be represented as success or definite non-send');
  const stalePending: OutboundEmailRecord = { requestId: input.requestId, environment: 'staging', recipient: input.to, subject: input.subject, status: 'pending', actorId: 'admin@example.com', createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z' };
  let staleStatus: string | undefined;
  const staleStore: OutboundEmailStore = {
    async reserve() { return { kind: 'duplicate', record: stalePending }; },
    async complete(_id, _environment, status) { staleStatus = status; },
  };
  let staleRetryCalledProvider = false;
  const staleResult = await executeOutboundEmail({ input, environment: 'staging', actorId: 'admin@example.com', now: '2026-10-19T00:01:00.000Z', apiKey: 'fixture', store: staleStore, send: async () => { staleRetryCalledProvider = true; return { status: 'accepted' }; } });
  assert.equal(staleResult.status, 'uncertain', 'stale in-progress requests become uncertain');
  assert.equal(staleStatus, 'uncertain');
  assert.equal(staleRetryCalledProvider, false, 'stale requests must not be resubmitted');

  const routeInput = { requestId: '00000000-0000-4000-8000-000000000012', to: 'lob@example.com', subject: 'No real send', message: 'Offline fetch must fail closed into uncertain state.' };
  const { firestoreDb } = await import('../../lib/firebase-admin');
  const before = (await firestoreDb.collection('admin_outbound_email_v1').get()).size;
  const routeResult = await POST(request(routeInput));
  assert.equal(routeResult.status, 202, 'provider transport failure should produce an explicit uncertain result');
  assert.equal((await routeResult.json()).status, 'uncertain');
  assert.equal((await firestoreDb.collection('admin_outbound_email_v1').get()).size, before + 1);
  const history = await GET(new NextRequest('http://localhost:3000/api/admin/outbound-email', { headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` } }));
  assert.equal(history.status, 200);
  const historyBody = await history.json();
  const row = historyBody.history.find((item: { requestId: string }) => item.requestId === routeInput.requestId);
  assert.equal(row.status, 'uncertain');
  assert.equal(row.environment, undefined, 'history is environment-scoped without duplicating environment per row');
  assert.equal(row.message, undefined, 'message content is not retained in history');
  for (let index = 0; index < 4; index++) {
    const limited = await POST(request({
      requestId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
      to: 'lob@example.com', subject: `Offline rate check ${index}`, message: 'Fetch is blocked by the offline test harness.',
    }));
    assert.equal(limited.status, 202);
  }
  const rateLimited = await POST(request({ requestId: '00000000-0000-4000-8000-000000000030', to: 'lob@example.com', subject: 'Over the limit', message: 'Must not reach the provider.' }));
  assert.equal(rateLimited.status, 429, 'send rate is capped at five per actor/environment per hour');
  console.log('Outbound email authorization, validation, environment history, duplicate protection, missing-key and provider-timeout behavior passed offline.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
