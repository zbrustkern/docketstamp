import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/orders/[id]/route";
import { saveOrder, setFirebaseAuthTestVerifier } from "../lib/firebase-admin";
import type { Order } from "../lib/types";

const adminSecret = "security-test-admin-secret-2026-long";
process.env.ADMIN_SECRET_KEY = adminSecret;

function fixture(id: string, userId?: string): Order {
  return {
    id,
    customerEmail: "alice@example.com",
    userId,
    status: "MAILED",
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
    amountInCents: 900,
    stripePaymentId: "pi_private_payment_secret",
    viewToken: `secure_view_token_${id}`,
    documentHtml: "<html>frozen notice private html</html>",
    documentIntegrityEvidence: { signer: "private signer" } as never,
    printedMessage: "private printed content",
    handwrittenNote: "private note",
    recipientAddress: {
      firstName: "Alice", lastName: "Example", street1: "12 Private St", street2: "Suite 8",
      city: "Chicago", state: "IL", zip: "60601", country: "US",
    },
    returnAddress: {
      firstName: "Sender", lastName: "Name", street1: "9 Sender Road", street2: "",
      city: "Chicago", state: "IL", zip: "60602", country: "US",
    },
  } as Order;
}

function context(id: string) { return { params: Promise.resolve({ id }) }; }
function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(url, "https://docketstamp.test"), init);
}

async function json(response: Response) { return await response.json() as Record<string, any>; }

test("anonymous order status is an explicit minimal DTO without personal or frozen data", async () => {
  const order = fixture("public-status-test");
  await saveOrder(order);
  const response = await GET(request(`/api/orders/${order.id}`), context(order.id));
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.deepEqual(body.order, {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    isRedacted: true,
  });
  const serialized = JSON.stringify(body);
  for (const secret of [order.customerEmail, "60601", "Private St", "frozen notice private html", "private signer", "pi_private_payment_secret", order.viewToken!, "private printed content", "private note"]) {
    assert.equal(serialized.includes(secret), false, `public response excluded ${secret}`);
  }
});

test("valid secure link token returns the allow-listed private order view without secrets", async () => {
  const order = fixture("token-access-test");
  await saveOrder(order);
  const response = await GET(request(`/api/orders/${order.id}?token=${order.viewToken}`), context(order.id));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.order.isRedacted, false);
  assert.equal(body.order.recipientAddress.street1, "12 Private St");
  assert.equal(body.order.viewToken, undefined);
  assert.equal(body.order.documentHtml, undefined);
  assert.equal(body.order.documentIntegrityEvidence, undefined);
  assert.equal(body.order.stripePaymentId, undefined);
  assert.equal(body.order.printedMessage, undefined);
});

test("POST only unlocks with secure token, verified owner, or signed admin credentials", async () => {
  const order = fixture("post-authorized-test", "alice");
  await saveOrder(order);
  const token = await POST(request(`/api/orders/${order.id}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewToken: order.viewToken }),
  }), context(order.id));
  assert.equal((await json(token)).order.isRedacted, false);

  const owner = await POST(request(`/api/orders/${order.id}`, {
    method: "POST", headers: { Authorization: "Bearer mock_token_alice" }, body: "{}",
  }), context(order.id));
  assert.equal((await json(owner)).order.isRedacted, false);

  const admin = await POST(request(`/api/orders/${order.id}`, {
    method: "POST", headers: { "x-admin-key": adminSecret }, body: "{}",
  }), context(order.id));
  assert.equal((await json(admin)).order.isRedacted, false);
});

test("verified UID owner and signed admin session may view full order", async () => {
  const order = fixture("owner-access-test", "alice");
  await saveOrder(order);
  const owner = await GET(request(`/api/orders/${order.id}`, {
    headers: { Authorization: "Bearer mock_token_alice" },
  }), context(order.id));
  assert.equal((await json(owner)).order.isRedacted, false);

  const admin = await GET(request(`/api/orders/${order.id}`, {
    headers: { "x-admin-key": adminSecret },
  }), context(order.id));
  assert.equal((await json(admin)).order.isRedacted, false);
});

test("guest verified email can associate only unbound orders; bound UID cannot be bypassed by email", async () => {
  const guest = fixture("guest-email-access-test");
  await saveOrder(guest);
  const guestResponse = await GET(request(`/api/orders/${guest.id}`, {
    headers: { Authorization: "Bearer mock_token_alice" },
  }), context(guest.id));
  assert.equal((await json(guestResponse)).order.isRedacted, false);

  const bound = fixture("bound-email-denial-test", "different-account");
  await saveOrder(bound);
  const boundResponse = await GET(request(`/api/orders/${bound.id}`, {
    headers: { Authorization: "Bearer mock_token_alice" },
  }), context(bound.id));
  assert.equal((await json(boundResponse)).order.isRedacted, true);
});

test("POST denies guessed email and ZIP and denies unverified Firebase email", async () => {
  const order = fixture("unlock-denial-test");
  await saveOrder(order);
  const guessed = await POST(request(`/api/orders/${order.id}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", zip: "60601" }),
  }), context(order.id));
  assert.equal(guessed.status, 401);
  assert.equal((await json(guessed)).order, undefined);

  setFirebaseAuthTestVerifier(async (token, projectId) => {
    const now = Math.floor(Date.now() / 1000);
    return {
      uid: "alice", email: "alice@example.com", email_verified: false,
      auth_time: now, iss: `https://securetoken.google.com/${projectId}`, aud: projectId,
      sub: "alice", iat: now, exp: now + 3600,
    } as never;
  });
  const unverified = await GET(request(`/api/orders/${order.id}`, {
    headers: { Authorization: "Bearer mock_token_unverified" },
  }), context(order.id));
  assert.equal((await json(unverified)).order.isRedacted, true);
});
