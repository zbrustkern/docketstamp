import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import {
  resolveFirebaseConfig, assertFirebaseAppMatches, FirebaseConfigurationError,
  PROD_FIREBASE_CONFIG as prod, STAGING_FIREBASE_CONFIG as staging,
} from "../lib/firebase-config";
import { getFirebaseApp } from "../lib/firebase-client";
import { googleSignInErrorMessage } from "../lib/auth-errors";

test("registered DocketStamp identities replace the inherited project identities", () => {
  assert.equal(prod.messagingSenderId, "937129689950");
  assert.equal(staging.messagingSenderId, "267056924276");
  for (const config of [prod, staging]) {
    assert.ok(config.appId.startsWith(`1:${config.messagingSenderId}:web:`));
    assert.equal(config.authDomain, `${config.projectId}.firebaseapp.com`);
  }
});

test("browser, SSR, local and hosted environment selection agree", () => {
  for (const host of ["staging.docketstamp.com", "docketstamp-staging.firebaseapp.com", "docketstamp--docketstamp-staging.us-central1.hosted.app"]) {
    assert.deepEqual(resolveFirebaseConfig({}, host), staging);
  }
  for (const env of [{ ENVIRONMENT: "staging" }, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "docketstamp-staging" }, { FIREBASE_PROJECT_ID: "docketstamp-staging" }, { NEXT_PUBLIC_APP_URL: "https://staging.docketstamp.com" }]) {
    assert.deepEqual(resolveFirebaseConfig(env), staging);
  }
  assert.deepEqual(resolveFirebaseConfig({ ENVIRONMENT: "staging", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, "localhost"), staging);
  assert.deepEqual(resolveFirebaseConfig({}, "docketstamp.com"), prod);
  assert.deepEqual(resolveFirebaseConfig({}, "unrelated-staging.example.com"), prod);
});

test("mixed identities and stale per-field overrides fail before Firebase is initialized", () => {
  for (const env of [
    { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "docketstamp" },
    { FIREBASE_PROJECT_ID: "sendmynotes-staging" },
    { ENVIRONMENT: "production" },
    { NEXT_PUBLIC_FIREBASE_API_KEY: "old-project-key" },
    { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "other-project.firebaseapp.com" },
    { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: prod.storageBucket },
    { NEXT_PUBLIC_FIREBASE_APP_ID: prod.appId },
    { NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: prod.messagingSenderId },
    { NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: prod.measurementId },
    { NEXT_PUBLIC_APP_URL: "not-a-url" },
  ]) {
    assert.throws(() => resolveFirebaseConfig(env, "staging.docketstamp.com"), FirebaseConfigurationError);
  }
  assert.throws(() => resolveFirebaseConfig({ ENVIRONMENT: "staging" }, "docketstamp.com"), FirebaseConfigurationError);
  assert.throws(() => assertFirebaseAppMatches(prod, staging), FirebaseConfigurationError);
  assert.doesNotThrow(() => assertFirebaseAppMatches(staging, staging));
});

test("an existing wrong Firebase singleton cannot bypass validation", async () => {
  const current = resolveFirebaseConfig({
    ENVIRONMENT: process.env.ENVIRONMENT,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  const app = initializeApp({ ...current, apiKey: "inherited-key-from-another-project" });
  try { assert.throws(() => getFirebaseApp(), FirebaseConfigurationError); }
  finally { await deleteApp(app); }
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    const correct = getFirebaseApp();
    try { assert.equal(getFirebaseApp(), correct); }
    finally { await deleteApp(correct); }
  } else {
    assert.throws(() => getFirebaseApp(), /NEXT_PUBLIC_FIREBASE_API_KEY is required/);
  }
});

test("deployment manifests specify each registered identity at build and runtime", () => {
  for (const [file, config] of [["apphosting.yaml", prod], ["apphosting.staging.yaml", staging]] as const) {
    const yaml = readFileSync(file, "utf8");
    for (const [suffix, value] of Object.entries({ PROJECT_ID: config.projectId, API_KEY: config.apiKey, AUTH_DOMAIN: config.authDomain, STORAGE_BUCKET: config.storageBucket, MESSAGING_SENDER_ID: config.messagingSenderId, APP_ID: config.appId, MEASUREMENT_ID: config.measurementId })) {
      const entry = yaml.split(`- variable: NEXT_PUBLIC_FIREBASE_${suffix}\n`)[1]?.split("- variable:")[0];
      if (suffix === "API_KEY") {
        assert.match(entry!, /secret: firebase-web-api-key/);
        assert.doesNotMatch(entry!, /value:/);
      } else assert.ok(entry?.includes(value), `${file}: ${suffix}`);
      assert.match(entry!, /- BUILD/);
      assert.match(entry!, /- RUNTIME/);
    }
  }
});

test("admin errors identify actual hostname, project, and referrer while customers get recovery instructions", () => {
  const options = { admin: true, hostname: "staging.docketstamp.com", origin: "https://staging.docketstamp.com", projectId: "docketstamp-staging" };
  const error = { code: "auth/unauthorized-domain" };
  const diagnostic = googleSignInErrorMessage(error, options);
  assert.match(diagnostic, /exact hostname staging\.docketstamp\.com/);
  assert.match(diagnostic, /project docketstamp-staging/);
  assert.match(diagnostic, /web API key belongs/);
  assert.match(googleSignInErrorMessage({ code: "auth/requests-from-referer-blocked" }, options), /https:\/\/staging\.docketstamp\.com\/\*/);
  const customer = googleSignInErrorMessage(error);
  assert.match(customer, /email sign-in/);
  assert.doesNotMatch(customer, /Firebase|Console/);
  const mismatch = new FirebaseConfigurationError("apiKey does not match docketstamp-staging.");
  assert.match(googleSignInErrorMessage(mismatch, options), /rebuild and reload/);
  assert.doesNotMatch(googleSignInErrorMessage(mismatch), /apiKey/);
  assert.equal(googleSignInErrorMessage(new Error("Popup closed")), "Popup closed");
});

// Run with the project key injected from Secret Manager for the positive integration path.
test("keys are optional for server identity but mandatory and project-bound for browsers", () => {
  assert.equal(resolveFirebaseConfig({}).apiKey, "");
  for (const projectId of ["docketstamp", "docketstamp-staging"]) {
    assert.throws(() => resolveFirebaseConfig({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId, NEXT_PUBLIC_FIREBASE_API_KEY: "wrong-key" }), /apiKey does not match/);
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    assert.equal(resolveFirebaseConfig(process.env).apiKey, process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  }
});
