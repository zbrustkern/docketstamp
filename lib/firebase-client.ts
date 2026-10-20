import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

import { assertFirebaseAppMatches, resolveFirebaseConfig } from "./firebase-config";
export { PROD_FIREBASE_CONFIG, STAGING_FIREBASE_CONFIG } from "./firebase-config";

export function getClientFirebaseConfig() {
  // Next.js only inlines NEXT_PUBLIC values accessed directly at build time.
  return resolveFirebaseConfig({
    ENVIRONMENT: process.env.ENVIRONMENT,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }, typeof window === "undefined" ? "" : window.location.hostname);
}

export const getFirebaseApp = (): FirebaseApp => {
  const config = getClientFirebaseConfig();
  if (getApps().length > 0) {
    const existing = getApp();
    assertFirebaseAppMatches(existing.options, config);
    return existing;
  }
  return initializeApp(config);
};

export const getFirebaseAuth = (): Auth => {
  const app = getFirebaseApp();
  return getAuth(app);
};
