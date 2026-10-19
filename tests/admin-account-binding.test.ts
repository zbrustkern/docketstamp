import { NextRequest } from "next/server";
import {
  isAuthorizedAdminEmail,
  AUTHORIZED_ADMIN_EMAILS,
  generateAdminSessionToken,
  isValidAdminSessionToken,
  getAdminSessionEmail,
  verifyAdminAuth,
  ADMIN_COOKIE_NAME,
} from "../lib/admin-auth";
import { POST as adminAuthPost, GET as adminAuthGet } from "../app/api/admin/auth/route";
import { GET as accountGet, POST as accountPost } from "../app/api/account/route";
import { verifyFirebaseIdToken, saveOrder } from "../lib/firebase-admin";
import { Order } from "../lib/types";

async function runTests() {
  console.log("=================================================");
  console.log("🛡️ RUNNING ADMIN ACCOUNT BINDING & LARGER AUTH TESTS");
  console.log("=================================================\n");

  process.env.ADMIN_SESSION_SIGNING_KEY = "test_only_explicit_signing_key_for_admin_binding_suite";

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

  // 1. Authorized Admin Email List & Case-Insensitivity
  console.log("--- 1. Testing Authorized Administrator Email Whitelist ---");
  assert(
    AUTHORIZED_ADMIN_EMAILS.includes("zbrustkern@gmail.com") &&
    AUTHORIZED_ADMIN_EMAILS.includes("sentral@gmail.com") &&
    AUTHORIZED_ADMIN_EMAILS.length === 2,
    "AUTHORIZED_ADMIN_EMAILS contains strictly zbrustkern@gmail.com and sentral@gmail.com"
  );
  assert(
    isAuthorizedAdminEmail("zbrustkern@gmail.com") === true,
    "zbrustkern@gmail.com is authorized as admin"
  );
  assert(
    isAuthorizedAdminEmail("sentral@gmail.com") === true,
    "sentral@gmail.com is authorized as admin"
  );
  assert(
    isAuthorizedAdminEmail("ZBRUSTKERN@GMAIL.COM") === true,
    "ZBRUSTKERN@GMAIL.COM (uppercase) is authorized"
  );
  assert(
    isAuthorizedAdminEmail("SENTRAL@GMAIL.COM") === true,
    "SENTRAL@GMAIL.COM (uppercase) is authorized"
  );
  assert(
    isAuthorizedAdminEmail("other@gmail.com") === false,
    "other@gmail.com is strictly blocked"
  );
  assert(
    isAuthorizedAdminEmail(null) === false && isAuthorizedAdminEmail("") === false,
    "Empty and null inputs are strictly blocked"
  );

  // 2. Account-Bound Admin Session Token Verification
  console.log("\n--- 2. Testing Account-Bound HMAC Session Tokens ---");
  const zekeToken = generateAdminSessionToken("zbrustkern@gmail.com");
  assert(
    isValidAdminSessionToken(zekeToken) === true,
    "Admin session token generated for zbrustkern@gmail.com is valid"
  );
  assert(
    getAdminSessionEmail(zekeToken) === "zbrustkern@gmail.com",
    "Session token extracts zbrustkern@gmail.com"
  );

  const sentralToken = generateAdminSessionToken("sentral@gmail.com");
  assert(
    isValidAdminSessionToken(sentralToken) === true,
    "Admin session token generated for sentral@gmail.com is valid"
  );
  assert(
    getAdminSessionEmail(sentralToken) === "sentral@gmail.com",
    "Session token extracts sentral@gmail.com"
  );

  let unauthorizedTokenError = false;
  try {
    generateAdminSessionToken("hacker@evil.com");
  } catch {
    unauthorizedTokenError = true;
  }
  assert(
    unauthorizedTokenError === true,
    "Generating an admin session token for unauthorized email throws an error"
  );

  // Legacy anonymous token without email tag must be rejected
  const fakeAnonymousToken = `smn_admin_${Date.now()}.some_signature`;
  assert(
    isValidAdminSessionToken(fakeAnonymousToken) === false,
    "Anonymous session token without email is rejected"
  );

  // 3. Admin Auth Route (POST /api/admin/auth)
  console.log("\n--- 3. Testing POST /api/admin/auth Endpoint ---");

  // A: Passphrase attempt is rejected
  const passphraseReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase: "any_passphrase_here" }),
  });
  const passphraseRes = await adminAuthPost(passphraseReq);
  const passphraseData = await passphraseRes.json();
  assert(
    passphraseRes.status === 400 && passphraseData.error.includes("permanently disabled"),
    "Passphrase attempt is rejected with HTTP 400 stating passphrases are permanently disabled"
  );

  // B: Unauthorized Google account rejected
  const unauthorizedReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "mock_token_unauthorized@example.com" }),
  });
  const unauthorizedRes = await adminAuthPost(unauthorizedReq);
  assert(
    unauthorizedRes.status === 403,
    "Unauthorized Google account is rejected with HTTP 403 Forbidden"
  );

  // C: Authorized account zbrustkern@gmail.com succeeds
  const zekeAuthReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "mock_token_zbrustkern@gmail.com" }),
  });
  const zekeAuthRes = await adminAuthPost(zekeAuthReq);
  const zekeAuthData = await zekeAuthRes.json();
  const zekeCookie = zekeAuthRes.headers.get("set-cookie") || "";
  assert(
    zekeAuthRes.status === 200 &&
    zekeAuthData.success === true &&
    zekeAuthData.email === "zbrustkern@gmail.com" &&
    zekeCookie.includes(ADMIN_COOKIE_NAME),
    "Authorized login for zbrustkern@gmail.com returns HTTP 200 and sets smn_admin_session cookie"
  );

  // D: Authorized account sentral@gmail.com succeeds
  const sentralAuthReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: "mock_token_sentral@gmail.com" }),
  });
  const sentralAuthRes = await adminAuthPost(sentralAuthReq);
  const sentralAuthData = await sentralAuthRes.json();
  assert(
    sentralAuthRes.status === 200 &&
    sentralAuthData.success === true &&
    sentralAuthData.email === "sentral@gmail.com",
    "Authorized login for sentral@gmail.com returns HTTP 200"
  );

  // 4. Admin Auth GET (Session Verification)
  console.log("\n--- 4. Testing GET /api/admin/auth Session Verification ---");
  const authSessionReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "GET",
    headers: {
      cookie: `${ADMIN_COOKIE_NAME}=${zekeToken}`,
    },
  });
  const authSessionRes = await adminAuthGet(authSessionReq);
  const authSessionData = await authSessionRes.json();
  assert(
    authSessionData.authenticated === true &&
    authSessionData.email === "zbrustkern@gmail.com",
    "GET /api/admin/auth recognizes authenticated session for zbrustkern@gmail.com"
  );

  const unauthSessionReq = new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "GET",
  });
  const unauthSessionRes = await adminAuthGet(unauthSessionReq);
  const unauthSessionData = await unauthSessionRes.json();
  assert(
    unauthSessionData.authenticated === false && unauthSessionData.email === null,
    "GET /api/admin/auth reports unauthenticated when no cookie present"
  );

  // 5. User Account Auth (/api/account) & Order Matching
  console.log("\n--- 5. Testing Larger Account Auth & Order Association ---");

  // Save sample order for user
  const sampleOrder: Order = {
    id: "ord_account_test_01",
    userId: "usr_alice",
    customerEmail: "alice@example.com",
    docketId: "DS-2026-TEST-ALICE",
    docketNumber: "DS-2026-TEST-ALICE",
    status: "DELIVERED",
    serviceLevel: "CERTIFIED",
    amountInCents: 1995,
    finalAmountInCents: 1995,
    documentHtml: "<p>Alice Notice</p>",
    recipientAddress: {
      firstName: "Landlord",
      lastName: "Corp",
      street1: "100 Broadway",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "USA",
    },
    returnAddress: {
      firstName: "Alice",
      lastName: "Smith",
      street1: "50 Park Ave",
      city: "New York",
      state: "NY",
      zip: "10002",
      country: "USA",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveOrder(sampleOrder);

  // Unauthenticated /api/account request rejected
  const unauthAccountReq = new NextRequest("http://localhost:3000/api/account?uid=usr_alice");
  const unauthAccountRes = await accountGet(unauthAccountReq);
  assert(
    unauthAccountRes.status === 401,
    "Unauthenticated /api/account GET rejected with HTTP 401"
  );

  // Authenticated /api/account request with Bearer token succeeds and finds order
  const authAccountReq = new NextRequest("http://localhost:3000/api/account?uid=alice@example.com&email=alice@example.com", {
    headers: {
      Authorization: "Bearer mock_token_alice@example.com",
    },
  });
  const authAccountRes = await accountGet(authAccountReq);
  const authAccountData = await authAccountRes.json();
  assert(
    authAccountRes.status === 200 &&
    authAccountData.orders &&
    authAccountData.orders.some((o: any) => o.id === "ord_account_test_01"),
    "Authenticated /api/account GET succeeds and retrieves customer's order"
  );

  // Authenticated save address via POST /api/account
  const saveAddrReq = new NextRequest("http://localhost:3000/api/account", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer mock_token_alice@example.com",
    },
    body: JSON.stringify({
      uid: "alice@example.com",
      email: "alice@example.com",
      addressToAdd: {
        firstName: "Landlord",
        lastName: "Corp",
        street1: "100 Broadway",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "USA",
      },
    }),
  });
  const saveAddrRes = await accountPost(saveAddrReq);
  const saveAddrData = await saveAddrRes.json();
  assert(
    saveAddrRes.status === 200 &&
    saveAddrData.success === true &&
    saveAddrData.user.savedAddresses.length > 0,
    "POST /api/account with Bearer token saves address to customer book"
  );

  console.log("\n=================================================");
  console.log(`🎉 COMPLETED: ${passed} passed, ${failed} failed.`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
