import { setFirebaseAuthTestVerifier } from "../../lib/firebase-admin";

const isHosted = Boolean(
  process.env.K_SERVICE || process.env.FIREBASE_CONFIG || process.env.GAE_ENV ||
  process.env.APPHOSTING_BACKEND_ID
);
const testEnv = process.env as Record<string, string | undefined>;

if (!isHosted && process.env.NODE_ENV !== "production") {
  testEnv.NODE_ENV = "test";
  process.env.FIREBASE_AUTH_TEST_VERIFIER = "true";
  process.env.FIREBASE_PROJECT_ID ||= "docketstamp";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||= process.env.FIREBASE_PROJECT_ID;

  setFirebaseAuthTestVerifier(async (token, projectId) => {
    if (!token.startsWith("mock_token_")) throw new Error("Unrecognized offline Firebase fixture token.");
    const uid = token.slice("mock_token_".length);
    const now = Math.floor(Date.now() / 1000);
    return {
      uid,
      email: uid.includes("@") ? uid : `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: "google.com", identities: { "google.com": [uid] } },
      auth_time: now,
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: uid,
      iat: now,
      exp: now + 3600,
    } as never;
  });
}
