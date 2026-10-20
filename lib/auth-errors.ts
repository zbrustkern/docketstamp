import { FirebaseConfigurationError } from "./firebase-config";

export function googleSignInErrorMessage(error: unknown, options: {
  admin?: boolean;
  hostname?: string;
  origin?: string;
  projectId?: string;
} = {}): string {
  const message = error instanceof Error ? error.message : "Google sign-in was not completed. Please try again.";
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const diagnostic = `${code} ${message}`;
  const hostname = options.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "this hostname");
  const origin = options.origin ?? (typeof window !== "undefined" ? window.location.origin : "this website's origin");
  const projectId = options.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (hostname === "staging.docketstamp.com" || hostname.includes("docketstamp-staging") ? "docketstamp-staging" : "docketstamp");
  if (error instanceof FirebaseConfigurationError) {
    return options.admin
      ? `Sign-in configuration is inconsistent for ${projectId}. Check the complete Firebase web SDK configuration and NEXT_PUBLIC_FIREBASE_* build variables, then rebuild and reload. ${message}`
      : "Sign-in is temporarily unavailable because of a configuration issue. Please try again later.";
  }
  if (diagnostic.includes("auth/unauthorized-domain")) {
    return options.admin
      ? `Firebase rejected ${hostname}. In project ${projectId}, check Authentication → Settings → Authorized domains for the exact hostname ${hostname} (without https:// or a path). If it is already listed, verify that the web API key belongs to this same project, then rebuild and reload.`
      : "Google sign-in is temporarily unavailable on this website. Please use email sign-in or try again later.";
  }
  if (diagnostic.includes("requests-from-referer") || diagnostic.includes("API_KEY_HTTP_REFERRER_BLOCKED")) {
    return options.admin
      ? `The Google Cloud web API key blocked ${origin}. In project ${projectId}, check APIs & Services → Credentials → API Keys → Website restrictions for ${origin}/* and verify that the key belongs to this project.`
      : "Google sign-in is temporarily unavailable on this website. Please use email sign-in or try again later.";
  }
  return message;
}
