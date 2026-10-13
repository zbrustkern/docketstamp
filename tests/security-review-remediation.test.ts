import { NextRequest } from "next/server";
import {
  getAdminSecret,
  generateAdminSessionToken,
  isValidAdminSessionToken,
  verifyAdminAuth,
} from "../lib/admin-auth";
import { POST as testMetaCapiPost } from "../app/api/admin/test-meta-capi/route";
import { GET as accountGet, POST as accountPost } from "../app/api/account/route";
import { GET as remindersGet, POST as remindersPost, DELETE as remindersDelete } from "../app/api/reminders/route";
import { GET as orderGet, POST as orderVerifyPost } from "../app/api/orders/[id]/route";
import { POST as completeFreeOrderPost } from "../app/api/checkout/complete-free-order/route";
import {
  saveOrder,
  getOrderById,
  saveDiscountCode,
  firestoreDb,
} from "../lib/firebase-admin";
import { Order, DiscountCode } from "../lib/types";
import { fulfillHandwryttenOrder } from "../lib/handwrytten";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runSecurityRemediationTests() {
  console.log("=================================================");
  console.log("🛡️ RUNNING SECURITY REVIEW REMEDIATION TESTS");
  console.log("=================================================\n");

  const originalEnv = { ...process.env };

  // ---------------------------------------------------------------------------
  // 1. ADMIN AUTH FAIL-CLOSED & EXPIRATION (Finding 2)
  // ---------------------------------------------------------------------------
  console.log("--- 1. Testing Admin Auth Fail-Closed & Expiry ---");

  // In production, when secret is missing, it must fail closed (return null)
  process.env.NODE_ENV = "production";
  delete process.env.ADMIN_SECRET_KEY;
  delete process.env["admin-secret-key"];

  assert(
    getAdminSecret() === null,
    "In production, getAdminSecret() returns null if environment variable is missing"
  );

  const unauthReq = new NextRequest("http://localhost:3000/api/admin/test", {
    headers: { "x-admin-key": "sendmynotes2026" },
  });
  assert(
    verifyAdminAuth(unauthReq) === false,
    "In production without secret, hardcoded fallback 'sendmynotes2026' is rejected"
  );

  // When secret is set, it works
  process.env.ADMIN_SECRET_KEY = "super_secure_test_key_xyz";
  assert(
    getAdminSecret() === "super_secure_test_key_xyz",
    "Configured secret is returned correctly"
  );

  const authReq = new NextRequest("http://localhost:3000/api/admin/test", {
    headers: { "x-admin-key": "super_secure_test_key_xyz" },
  });
  assert(
    verifyAdminAuth(authReq) === true,
    "Valid admin key succeeds with constant-time comparison"
  );

  // Expired token test: manually craft 9-hour-old token
  const expiredTime = Date.now() - 9 * 60 * 60 * 1000;
  const expiredToken = `smn_admin_${expiredTime}.fake_signature`;
  assert(
    isValidAdminSessionToken(expiredToken) === false,
    "Expired admin session token (> 8 hours) is rejected"
  );

  // Malformed signature length test does not throw uncaught error
  const malformedSigToken = `smn_admin_${Date.now()}.short`;
  assert(
    isValidAdminSessionToken(malformedSigToken) === false,
    "Mismatched signature length returns false without throwing ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH"
  );

  // Fresh valid token
  const freshToken = generateAdminSessionToken();
  assert(
    isValidAdminSessionToken(freshToken) === true,
    "Freshly generated session token is valid"
  );

  // ---------------------------------------------------------------------------
  // 2. ADMIN TEST-META-CAPI ROUTE AUTHORIZATION (Finding 7)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Testing /api/admin/test-meta-capi Protection ---");

  // Call without admin auth
  const unauthMetaReq = new NextRequest("http://localhost:3000/api/admin/test-meta-capi", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ testEventCode: "TEST12345" }),
  });
  const unauthMetaRes = await testMetaCapiPost(unauthMetaReq);
  assert(
    unauthMetaRes.status === 401,
    `Unauthenticated /api/admin/test-meta-capi rejected with HTTP 401 (Got: ${unauthMetaRes.status})`
  );

  // Call with admin auth but missing test code
  const authMetaNoCodeReq = new NextRequest("http://localhost:3000/api/admin/test-meta-capi", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-key": "super_secure_test_key_xyz",
    },
    body: JSON.stringify({}),
  });
  const authMetaNoCodeRes = await testMetaCapiPost(authMetaNoCodeReq);
  assert(
    authMetaNoCodeRes.status === 400,
    `Missing testEventCode rejected with HTTP 400 to protect live ad measurement (Got: ${authMetaNoCodeRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 3. ACCOUNT & REMINDERS ROUTE AUTHORIZATION (Finding 1)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Testing /api/account & /api/reminders ID Token Protection ---");

  // /api/account GET without Bearer token rejected
  const unauthAccountReq = new NextRequest("http://localhost:3000/api/account?uid=user123");
  const unauthAccountRes = await accountGet(unauthAccountReq);
  assert(
    unauthAccountRes.status === 401,
    `Unauthenticated /api/account GET rejected with HTTP 401 (Got: ${unauthAccountRes.status})`
  );

  // /api/account GET with token but attempting to view another user's uid rejected
  const spoofAccountReq = new NextRequest("http://localhost:3000/api/account?uid=victim_user", {
    headers: { Authorization: "Bearer mock_token_attacker_user" },
  });
  const spoofAccountRes = await accountGet(spoofAccountReq);
  assert(
    spoofAccountRes.status === 403,
    `Cross-account UID spoofing rejected with HTTP 403 (Got: ${spoofAccountRes.status})`
  );

  // /api/account GET with matching verified identity succeeds
  const validAccountReq = new NextRequest("http://localhost:3000/api/account?uid=legit_user", {
    headers: { Authorization: "Bearer mock_token_legit_user" },
  });
  const validAccountRes = await accountGet(validAccountReq);
  assert(
    validAccountRes.status === 200,
    `Verified user account retrieval succeeds with HTTP 200 (Got: ${validAccountRes.status})`
  );

  // /api/reminders GET without auth rejected
  const unauthRemindersReq = new NextRequest("http://localhost:3000/api/reminders?userId=user123");
  const unauthRemindersRes = await remindersGet(unauthRemindersReq);
  assert(
    unauthRemindersRes.status === 401,
    `Unauthenticated /api/reminders GET rejected with HTTP 401 (Got: ${unauthRemindersRes.status})`
  );

  // /api/reminders DELETE without auth rejected
  const unauthDeleteRemReq = new NextRequest("http://localhost:3000/api/reminders?id=rem_123");
  const unauthDeleteRemRes = await remindersDelete(unauthDeleteRemReq);
  assert(
    unauthDeleteRemRes.status === 401,
    `Unauthenticated /api/reminders DELETE rejected with HTTP 401 (Got: ${unauthDeleteRemRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 4. FREE-ORDER REPLAY & CONCURRENCY ATOMICITY (Finding 3)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Testing Free-Order Atomic State Machine & Replay Protection ---");

  const promoCode: DiscountCode = {
    id: "FREE100TEST",
    code: "FREE100TEST",
    type: "PERCENTAGE",
    value: 100,
    isActive: true,
    maxUses: 1,
    usedCount: 0,
    totalDiscountGivenCents: 0,
  };
  await saveDiscountCode(promoCode);

  const freeOrderId = `free_sec_test_${Date.now()}`;
  const freeOrder: Order = {
    id: freeOrderId,
    customerEmail: "freeuser@example.com",
    frontImageUrl: "/presets/botanical-monstera.jpg",
    printedMessage: "Thank You",
    handwrittenNote: "A heartfelt message for you.",
    fontStyleId: "1",
    recipientAddress: {
      firstName: "Bob",
      lastName: "Smith",
      street1: "456 Pine St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    },
    returnAddress: {
      firstName: "Alice",
      lastName: "Johnson",
      street1: "123 Main St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    },
    status: "PENDING_PAYMENT",
    amountInCents: 0,
    discountCode: "FREE100TEST",
    isTest: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveOrder(freeOrder);

  // First completion succeeds
  const completeReq1 = new NextRequest("http://localhost:3000/api/checkout/complete-free-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: freeOrderId, discountCode: "FREE100TEST" }),
  });
  const completeRes1 = await completeFreeOrderPost(completeReq1);
  const completeData1 = await completeRes1.json();
  assert(
    completeRes1.status === 200 && completeData1.status === "PROCESSING_HANDWRYTTEN",
    `Initial free order completion transitions to PROCESSING_HANDWRYTTEN (Status: ${completeRes1.status})`
  );

  // Replay of same order returns alreadyProcessed: true without new fulfillment dispatch
  const replayReq = new NextRequest("http://localhost:3000/api/checkout/complete-free-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: freeOrderId, discountCode: "FREE100TEST" }),
  });
  const replayRes = await completeFreeOrderPost(replayReq);
  const replayData = await replayRes.json();
  assert(
    replayRes.status === 200 && replayData.alreadyProcessed === true,
    `Replay of completed free order returns alreadyProcessed: true without duplicating fulfillment`
  );

  // Re-use of exhausted 1-use discount code on new order is rejected
  const secondFreeOrderId = `free_sec_test_2_${Date.now()}`;
  await saveOrder({
    ...freeOrder,
    id: secondFreeOrderId,
    status: "PENDING_PAYMENT",
  });
  const exhaustedReq = new NextRequest("http://localhost:3000/api/checkout/complete-free-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: secondFreeOrderId, discountCode: "FREE100TEST" }),
  });
  const exhaustedRes = await completeFreeOrderPost(exhaustedReq);
  assert(
    exhaustedRes.status === 400,
    `Exhausted promo code (maxUses: 1) on second order rejected with HTTP 400 (Status: ${exhaustedRes.status})`
  );

  // ---------------------------------------------------------------------------
  // 5. PATH TRAVERSAL & SSRF DEFENSE (Finding 4)
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Testing Handwrytten Path Traversal & SSRF Protections ---");

  // Test path traversal
  try {
    await fulfillHandwryttenOrder({
      imageUrl: "/../../../../etc/passwd",
      printedGreeting: "Hello",
      handwrittenMessage: "Test",
      fontId: "1",
      recipient: freeOrder.recipientAddress,
      returnAddress: freeOrder.returnAddress,
    });
    assert(false, "Path traversal should throw an error");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(
      msg.includes("traversal outside public directory is prohibited"),
      `Path traversal escaped path blocked: "${msg}"`
    );
  }

  // Test SSRF metadata endpoint
  try {
    await fulfillHandwryttenOrder({
      imageUrl: "https://169.254.169.254/computeMetadata/v1/",
      printedGreeting: "Hello",
      handwrittenMessage: "Test",
      fontId: "1",
      recipient: freeOrder.recipientAddress,
      returnAddress: freeOrder.returnAddress,
    });
    assert(false, "SSRF to cloud metadata should throw an error");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    assert(
      msg.includes("Prohibited host for cover image fetch"),
      `SSRF metadata host blocked: "${msg}"`
    );
  }

  // ---------------------------------------------------------------------------
  // 6. ORDER UNLOCKING PRIVACY & ATTEMPT THROTTLING (Finding 6)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Testing Order Sanitization & Unlock Throttling ---");

  const privacyOrderId = `order_priv_${Date.now()}`;
  await saveOrder({
    ...freeOrder,
    id: privacyOrderId,
    customerEmail: "private_owner@example.com",
    recipientAddress: {
      ...freeOrder.recipientAddress,
      zip: "78701",
    },
    viewToken: "tok_secure_view_12345",
  });

  // Public GET must mask entire ZIP code (not leak 787••)
  const pubReq = new NextRequest(`http://localhost:3000/api/orders/${privacyOrderId}`);
  const pubRes = await orderGet(pubReq, { params: Promise.resolve({ id: privacyOrderId }) });
  const pubData = await pubRes.json();
  assert(
    pubData.order?.recipientAddress?.zip === "•••••",
    `Public order view masks entire 5-digit ZIP without revealing prefix digits (Got: "${pubData.order?.recipientAddress?.zip}")`
  );

  // Rate limiter: fail 5 times with wrong ZIP
  let throttled = false;
  for (let i = 0; i < 6; i++) {
    const bruteReq = new NextRequest(`http://localhost:3000/api/orders/${privacyOrderId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42",
      },
      body: JSON.stringify({ zip: `9990${i}` }),
    });
    const bruteRes = await orderVerifyPost(bruteReq, { params: Promise.resolve({ id: privacyOrderId }) });
    if (bruteRes.status === 429) {
      throttled = true;
      break;
    }
  }
  assert(
    throttled === true,
    "After 5 failed attempts, brute-force ZIP verification is throttled with HTTP 429"
  );

  // Restore env
  process.env = { ...originalEnv };

  console.log("\n=================================================");
  if (failed === 0) {
    console.log(`🎉 ALL SECURITY REMEDIATION TESTS PASSED (${passed}/${passed})`);
    console.log("=================================================\n");
  } else {
    console.error(`💥 SOME TESTS FAILED (${failed} failed, ${passed} passed)`);
    process.exit(1);
  }
}

runSecurityRemediationTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
