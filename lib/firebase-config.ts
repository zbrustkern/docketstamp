// Public web app identities verified with `firebase apps:sdkconfig` on 2026-10-20.
// Rotate these as complete configurations; never mix credentials across projects.
export const PROD_FIREBASE_CONFIG = {
  apiKey: "REDACTED_FIREBASE_WEB_API_KEY",
  authDomain: "docketstamp.firebaseapp.com",
  projectId: "docketstamp",
  storageBucket: "docketstamp.firebasestorage.app",
  messagingSenderId: "937129689950",
  appId: "1:937129689950:web:f916267a40b9133dfcc5cf",
  measurementId: "G-6M8S0RNFQM",
};

export const STAGING_FIREBASE_CONFIG = {
  apiKey: "REDACTED_FIREBASE_WEB_API_KEY",
  authDomain: "docketstamp-staging.firebaseapp.com",
  projectId: "docketstamp-staging",
  storageBucket: "docketstamp-staging.firebasestorage.app",
  messagingSenderId: "267056924276",
  appId: "1:267056924276:web:e8c64af5d4be3d57477321",
  measurementId: "G-MR8PSNHHP9",
};

type FirebaseConfigEnvironment = Record<string, string | undefined>;

export class FirebaseConfigurationError extends Error {
  constructor(detail: string) {
    super(`Firebase configuration mismatch: ${detail}`);
    this.name = "FirebaseConfigurationError";
  }
}

export function resolveFirebaseConfig(env: FirebaseConfigEnvironment, hostname = "") {
  const stagingHost = hostname === "staging.docketstamp.com" ||
    hostname === "docketstamp-staging.firebaseapp.com" ||
    hostname === "docketstamp-staging.web.app" ||
    hostname.endsWith("--docketstamp-staging.us-central1.hosted.app");
  const productionHost = hostname === "docketstamp.com" || hostname === "www.docketstamp.com" ||
    hostname === "docketstamp.firebaseapp.com" || hostname === "docketstamp.web.app" ||
    hostname.endsWith("--docketstamp.us-central1.hosted.app");
  const projectIds = [env.FIREBASE_PROJECT_ID, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID].filter(Boolean);
  if (projectIds.some(id => id !== "docketstamp" && id !== "docketstamp-staging")) {
    throw new FirebaseConfigurationError("unrecognized project; use a registered DocketStamp project.");
  }
  let appHost = "";
  if (env.NEXT_PUBLIC_APP_URL) {
    try { appHost = new URL(env.NEXT_PUBLIC_APP_URL).hostname; }
    catch { throw new FirebaseConfigurationError("NEXT_PUBLIC_APP_URL must be an absolute URL."); }
  }
  const staging = stagingHost || env.ENVIRONMENT === "staging" ||
    projectIds.includes("docketstamp-staging") || appHost === "staging.docketstamp.com";
  const production = productionHost || env.ENVIRONMENT === "production" ||
    projectIds.includes("docketstamp") || appHost === "docketstamp.com" || appHost === "www.docketstamp.com";
  if (staging && production) {
    throw new FirebaseConfigurationError("staging and production identifiers conflict.");
  }
  const config = staging ? STAGING_FIREBASE_CONFIG : PROD_FIREBASE_CONFIG;
  const overrides = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  for (const key of Object.keys(overrides) as (keyof typeof overrides)[]) {
    if (overrides[key] && overrides[key] !== config[key]) {
      // Do not include credential values in the exception or UI.
      throw new FirebaseConfigurationError(`${key} does not match ${config.projectId}.`);
    }
  }
  return { ...config };
}

export function assertFirebaseAppMatches(
  existing: Partial<typeof PROD_FIREBASE_CONFIG>, expected: typeof PROD_FIREBASE_CONFIG,
) {
  for (const key of ["projectId", "apiKey", "authDomain", "appId", "messagingSenderId"] as const) {
    if (existing[key] !== expected[key]) {
      throw new FirebaseConfigurationError(`initialized app has a different ${key}; reload after correcting configuration.`);
    }
  }
}
