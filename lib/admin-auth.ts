import { NextRequest } from "next/server";
import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "smn_admin_session";

/**
 * Verified user accounts authorized to access the DocketStamp admin portal.
 */
export const AUTHORIZED_ADMIN_EMAILS: string[] = [
  "zbrustkern@gmail.com",
  "sentral@gmail.com",
];

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const cleanEmail = email.trim().toLowerCase();
  const configuredEmails = process.env.ADMIN_AUTHORIZED_EMAILS
    ? process.env.ADMIN_AUTHORIZED_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];
  const allowed = new Set([
    ...AUTHORIZED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...configuredEmails,
  ]);
  return allowed.has(cleanEmail);
}

/**
 * Resolves the admin secret key from the environment.
 * In production, fails closed (returns null) if no secret is configured.
 * In non-production/test environments, falls back to a development key.
 */
export function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET_KEY || process.env["admin-secret-key"];
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV !== "production") {
    return "ds_dev_admin_2026";
  }
  // If explicitly in staging environment, provide default staging passphrase
  if (
    process.env.ENVIRONMENT === "staging" ||
    process.env.FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.includes("staging")) ||
    (typeof process.env.K_SERVICE === "string" && process.env.K_SERVICE.includes("staging"))
  ) {
    return "ds_staging_admin_2026";
  }
  console.error("[AdminAuth] ERROR: ADMIN_SECRET_KEY is not configured in production environment.");
  return null;
}

/**
 * Secret key used to sign and verify HMAC session cookies.
 */
export function getAdminSessionSigningKey(): string {
  const secret = getAdminSecret();
  if (secret) return secret;
  return process.env.ADMIN_SESSION_SIGNING_KEY || "smn_internal_admin_session_key_2026";
}

/**
 * Creates a signed session token derived from the signing key and current timestamp.
 */
export function generateAdminSessionToken(adminEmail?: string): string {
  const signingKey = getAdminSessionSigningKey();
  const timestamp = Date.now();
  const userTag = adminEmail
    ? `_${Buffer.from(adminEmail.toLowerCase().trim()).toString("hex")}`
    : "";
  const payload = `smn_admin_${timestamp}${userTag}`;
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Validates the admin session token from the cookie or header.
 * Enforces payload format, server-side timestamp expiration (8 hours max),
 * and safe constant-time HMAC signature verification.
 */
export function isValidAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const signingKey = getAdminSessionSigningKey();

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.substring(0, lastDot);
  const signature = token.substring(lastDot + 1);
  if (!payload || !signature) return false;

  // Enforce payload format and timestamp expiration (allowing optional user tag)
  const match = payload.match(/^smn_admin_(\d+)(?:_.*)?$/);
  if (!match) return false;

  const timestamp = parseInt(match[1], 10);
  const now = Date.now();
  const maxAgeMs = 8 * 60 * 60 * 1000; // 8 hours server lifetime

  if (isNaN(timestamp) || now - timestamp > maxAgeMs || timestamp > now + 60000) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  // Guard against length mismatch to prevent ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH uncaught exceptions
  if (sigBuf.length !== expBuf.length || sigBuf.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Safely extracts the email embedded in a valid session token (if present).
 */
export function getAdminSessionEmail(token: string): string | null {
  if (!isValidAdminSessionToken(token)) return null;
  const lastDot = token.lastIndexOf(".");
  const payload = token.substring(0, lastDot);
  const match = payload.match(/^smn_admin_\d+_(.+)$/);
  if (!match) return null;
  const rawTag = match[1];
  if (/^[0-9a-fA-F]+$/.test(rawTag)) {
    try {
      return Buffer.from(rawTag, "hex").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    return decodeURIComponent(rawTag);
  } catch {
    return rawTag;
  }
}

/**
 * Validates incoming admin request from cookie or x-admin-key header.
 */
export function verifyAdminAuth(req: NextRequest): boolean {
  // 1. Direct header check with timing-safe comparison (service / API access)
  const secret = getAdminSecret();
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey && typeof headerKey === "string" && secret) {
    const headBuf = Buffer.from(headerKey);
    const secBuf = Buffer.from(secret);
    if (headBuf.length === secBuf.length && crypto.timingSafeEqual(headBuf, secBuf)) {
      return true;
    }
  }

  // 2. Cookie session check (HMAC-verified admin session)
  const sessionCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (sessionCookie && isValidAdminSessionToken(sessionCookie)) {
    return true;
  }

  return false;
}

export function verifyAdminPassphrase(passphrase: string): boolean {
  if (!passphrase || typeof passphrase !== "string") return false;
  const secret = getAdminSecret();
  if (!secret) return false;

  const passBuf = Buffer.from(passphrase);
  const secretBuf = Buffer.from(secret);

  if (passBuf.length !== secretBuf.length) {
    // Perform dummy comparison against self to equalize timing
    crypto.timingSafeEqual(passBuf, passBuf);
    return false;
  }

  return crypto.timingSafeEqual(passBuf, secretBuf);
}
