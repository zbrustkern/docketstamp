import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

export const PROD_FIREBASE_CONFIG = {
  apiKey: "REDACTED_FIREBASE_WEB_API_KEY",
  authDomain: "sendmynotes-2a417.firebaseapp.com",
  projectId: "sendmynotes-2a417",
  storageBucket: "sendmynotes-2a417.firebasestorage.app",
  messagingSenderId: "486379422282",
  appId: "1:486379422282:web:a236cfa24ef6bf8d7cdcb3",
  measurementId: "G-5DV25FZ7Q8",
};

export const STAGING_FIREBASE_CONFIG = {
  apiKey: "REDACTED_FIREBASE_WEB_API_KEY",
  authDomain: "sendmynotes-staging.firebaseapp.com",
  projectId: "sendmynotes-staging",
  storageBucket: "sendmynotes-staging.firebasestorage.app",
  messagingSenderId: "910796604705",
  appId: "1:910796604705:web:34244d4b29bd7ea8362a60",
  measurementId: "G-YL7ZK51DTQ",
};

export function getClientFirebaseConfig() {
  const isStaging =
    process.env.ENVIRONMENT === "staging" ||
    (typeof window !== "undefined" &&
      (window.location.hostname.includes("docketstamp-staging") ||
        window.location.hostname.includes("sendmynotes-staging") ||
        window.location.hostname.includes("staging"))) ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "sendmynotes-staging" ||
    process.env.FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.FIREBASE_PROJECT_ID === "sendmynotes-staging" ||
    (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.includes("staging")) ||
    (typeof process.env.K_SERVICE === "string" && process.env.K_SERVICE.includes("staging"));

  const baseDefaults = isStaging ? STAGING_FIREBASE_CONFIG : PROD_FIREBASE_CONFIG;

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || baseDefaults.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || baseDefaults.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || baseDefaults.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || baseDefaults.storageBucket,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || baseDefaults.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || baseDefaults.appId,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || baseDefaults.measurementId,
  };
}

export const getFirebaseApp = (): FirebaseApp => {
  const config = getClientFirebaseConfig();
  if (getApps().length > 0) {
    const existing = getApp();
    if (existing.options.apiKey && existing.options.projectId === config.projectId) {
      return existing;
    }
  }
  return getApps().length > 0 ? getApp() : initializeApp(config);
};

export const getFirebaseAuth = (): Auth => {
  const app = getFirebaseApp();
  return getAuth(app);
};
