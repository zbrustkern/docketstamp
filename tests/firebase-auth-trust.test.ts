import "./helpers/firebase-auth-test-verifier";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { NextRequest } from "next/server";
import {
  setFirebaseAuthTestVerifier,
  verifyFirebaseIdToken,
  verifyFirebaseIdTokenWithVerifier,
} from "../lib/firebase-admin";
import {
  ADMIN_COOKIE_NAME,
  LEGACY_ADMIN_COOKIE_NAME,
  generateAdminSessionToken,
  isValidAdminSessionToken,
  verifyAdminAuth,
} from "../lib/admin-auth";
import { POST as adminAuthPost, DELETE as adminAuthDelete } from "../app/api/admin/auth/route";

const projectId = "docketstamp";
const testEnv = process.env as Record<string, string | undefined>;
const validClaims = (overrides: Record<string, unknown> = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return {
    uid: "trusted-user",
    sub: "trusted-user",
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    exp: now + 300,
    iat: now,
    email: "zbrustkern@gmail.com",
    email_verified: true,
    ...overrides,
  } as never;
};

test("configured project is selected before untrusted token content and invalid tokens fail closed", async () => {
  let observedProject: string | undefined;
  setFirebaseAuthTestVerifier(async (_token, trustedProject) => {
    observedProject = trustedProject;
    return validClaims();
  });

  const accepted = await verifyFirebaseIdToken("mock_token_attacker_claims_docketstamp-staging");
  assert.equal(accepted?.aud, projectId);
  assert.equal(observedProject, projectId);

  setFirebaseAuthTestVerifier(async () => validClaims({ aud: "docketstamp-staging" }));
  assert.equal(await verifyFirebaseIdToken("mock_token_wrong_project"), null);

  setFirebaseAuthTestVerifier(async () => validClaims({ iss: "https://securetoken.google.com/other-project" }));
  assert.equal(await verifyFirebaseIdToken("mock_token_wrong_issuer"), null);

  setFirebaseAuthTestVerifier(async () => validClaims({ exp: Math.floor(Date.now() / 1000) - 1 }));
  assert.equal(await verifyFirebaseIdToken("mock_token_expired"), null);
});

test("cryptographic verifier failures, forged tokens, and revoked tokens never fall back to decoded claims", async () => {
  let checkRevokedWasRequested = false;
  const rejected = await verifyFirebaseIdTokenWithVerifier(
    "forged.header.payload.signature",
    projectId,
    async (_token, checkRevoked) => {
      checkRevokedWasRequested = checkRevoked;
      throw new Error("invalid signature");
    },
  );
  assert.equal(rejected, null);
  assert.equal(checkRevokedWasRequested, true);

  const revoked = await verifyFirebaseIdTokenWithVerifier(
    "cryptographically-valid-but-revoked",
    projectId,
    async (_token, checkRevoked) => {
      assert.equal(checkRevoked, true);
      throw new Error("auth/id-token-revoked");
    },
  );
  assert.equal(revoked, null);
});

test("offline mock tokens require explicit test configuration and are rejected in hosted or production modes", async () => {
  setFirebaseAuthTestVerifier(async () => validClaims());
  assert.ok(await verifyFirebaseIdToken("mock_token_local_fixture"));

  const enabled = process.env.FIREBASE_AUTH_TEST_VERIFIER;
  delete testEnv.FIREBASE_AUTH_TEST_VERIFIER;
  assert.throws(() => setFirebaseAuthTestVerifier(async () => validClaims()));
  assert.equal(await verifyFirebaseIdToken("mock_token_without_opt_in"), null);
  testEnv.FIREBASE_AUTH_TEST_VERIFIER = enabled;

  testEnv.K_SERVICE = "docketstamp";
  assert.equal(await verifyFirebaseIdToken("mock_token_hosted_fixture"), null);
  delete testEnv.K_SERVICE;

  const hostedMockFirestore = spawnSync(process.execPath, [
    "--import", "tsx", "-e",
    'require("./lib/firebase-admin");',
  ], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      K_SERVICE: "docketstamp-staging",
      USE_MOCK_FIRESTORE: "true",
      FIREBASE_PROJECT_ID: "docketstamp-staging",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "docketstamp-staging",
      NEXT_PUBLIC_APP_URL: "https://staging.docketstamp.com",
    },
    encoding: "utf8",
  });
  assert.notEqual(hostedMockFirestore.status, 0);
  assert.match(`${hostedMockFirestore.stderr}\n${hostedMockFirestore.stdout}`, /strictly prohibited in hosted and production runtimes/);

  testEnv.NODE_ENV = "production";
  assert.throws(() => setFirebaseAuthTestVerifier(async () => validClaims()));
  assert.equal(await verifyFirebaseIdToken("mock_token_production_fixture"), null);
  testEnv.NODE_ENV = "test";
});

test("DocketStamp admin cookie requires a fresh session and clears the legacy cookie on login and logout", async () => {
  process.env.ADMIN_SESSION_SIGNING_KEY = "test_only_explicit_signing_key_for_admin_binding_suite";
  const legacyToken = `smn_admin_${Date.now()}.not-a-valid-signature`;
  const legacyRequest = new NextRequest("http://localhost:3000/api/admin/metrics", {
    headers: { cookie: `${LEGACY_ADMIN_COOKIE_NAME}=${legacyToken}` },
  });
  assert.equal(verifyAdminAuth(legacyRequest), false);
  assert.equal(isValidAdminSessionToken(legacyToken), false);

  const login = await adminAuthPost(new NextRequest("http://localhost:3000/api/admin/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: "mock_token_zbrustkern@gmail.com" }),
  }));
  const loginCookies = login.headers.getSetCookie().join("\n");
  assert.equal(login.status, 200);
  assert.match(loginCookies, new RegExp(`${ADMIN_COOKIE_NAME}=`));
  assert.match(loginCookies, new RegExp(`${LEGACY_ADMIN_COOKIE_NAME}=;.*Max-Age=0`));

  const logout = await adminAuthDelete();
  const logoutCookies = logout.headers.getSetCookie().join("\n");
  assert.match(logoutCookies, new RegExp(`${ADMIN_COOKIE_NAME}=;.*Max-Age=0`));
  assert.match(logoutCookies, new RegExp(`${LEGACY_ADMIN_COOKIE_NAME}=;.*Max-Age=0`));

  const valid = generateAdminSessionToken("zbrustkern@gmail.com");
  assert.match(valid, /^ds_admin_v2_/);
});
