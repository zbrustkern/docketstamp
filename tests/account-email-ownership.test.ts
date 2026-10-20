import './helpers/firebase-auth-test-verifier';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as getAccount } from '../app/api/account/route';
import { getOrdersCollection, setFirebaseAuthTestVerifier } from '../lib/firebase-admin';

test('unverified email claims cannot recover guest orders; verified email cannot override a bound UID', async () => {
  const suffix = crypto.randomUUID();
  const uid = `owner-${suffix}`;
  const email = `claimed-${suffix}@example.test`;
  const records = [
    { id: `own-${suffix}`, userId: uid, customerEmail: email },
    { id: `guest-${suffix}`, customerEmail: email },
    { id: `other-${suffix}`, userId: `different-${suffix}`, customerEmail: email },
  ];
  for (const order of records) await getOrdersCollection().doc(order.id).set({ ...order, createdAt: Date.now() });
  const claims = (verified: boolean) => {
    const now = Math.floor(Date.now() / 1000);
    return { uid, sub: uid, email, email_verified: verified, aud: 'docketstamp', iss: 'https://securetoken.google.com/docketstamp', exp: now + 3600 } as never;
  };
  const request = () => new NextRequest(`http://localhost/api/account?uid=${encodeURIComponent(uid)}&email=${encodeURIComponent(email)}`, { headers: { Authorization: 'Bearer mock_token_claimed_identity' } });
  setFirebaseAuthTestVerifier(async () => claims(false));
  const unverified = await getAccount(request());
  assert.equal(unverified.status, 200);
  assert.deepEqual((await unverified.json()).orders.map((o: { id: string }) => o.id), [records[0].id]);
  setFirebaseAuthTestVerifier(async () => claims(true));
  const verified = await getAccount(request());
  assert.equal(verified.status, 200);
  const ids = (await verified.json()).orders.map((o: { id: string }) => o.id);
  assert.ok(ids.includes(records[0].id));
  assert.ok(ids.includes(records[1].id));
  assert.ok(!ids.includes(records[2].id));
});
