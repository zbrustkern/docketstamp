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
 * Blocklisted predictable or historical fallback secrets that must never be accepted
 * even if accidentally supplied in environment variables.
 */
export const BLOCKLISTED_ADMIN_SECRETS = new Set([
  "ds_dev_admin_2026",
  "ds_staging_admin_2026",
  "smn_internal_admin_session_key_2026",
  "changeme",
  "secret",
  "admin",
  "password",
  "placeholder",
  "whsec_placeholder",
]);

export function isPredictableOrInvalidSecret(candidate?: string | null): boolean {
  if (!candidate || typeof candidate !== "string") return true;
  const trimmed = candidate.trim();
  if (trimmed.length < 16) return true;
  if (BLOCKLISTED_ADMIN_SECRETS.has(trimmed)) return true;
  if (BLOCKLISTED_ADMIN_SECRETS.has(trimmed.toLowerCase())) return true;
  return false;
}

/**
 * Resolves the admin secret key from the environment.
 * Fails closed (returns null) in all environments if no valid, non-blocklisted secret is configured.
 */
export function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET_KEY || process.env["admin-secret-key"];
  if (!secret || isPredictableOrInvalidSecret(secret)) {
    return null;
  }
  return secret.trim();
}

/**
 * Secret key used to sign and verify HMAC session cookies.
 * Fails closed (returns null) if neither ADMIN_SESSION_SIGNING_KEY nor ADMIN_SECRET_KEY
 * is configured with a non-blocklisted value.
 */
export function getAdminSessionSigningKey(): string | null {
  const explicitSigningKey = process.env.ADMIN_SESSION_SIGNING_KEY;
  if (explicitSigningKey && !isPredictableOrInvalidSecret(explicitSigningKey)) {
    return explicitSigningKey.trim();
  }
  return getAdminSecret();
}

export const ADMIN_SESSION_TOKEN_PREFIX = "ds_admin_v2_";

/**
 * Creates a signed session token derived from the signing key, timestamp, and authorized admin email.
 * Throws if signing configuration is absent or invalid (fail-closed).
 */
export function generateAdminSessionToken(adminEmail: string = "zbrustkern@gmail.com"): string {
  const cleanEmail = adminEmail.toLowerCase().trim();
  if (!isAuthorizedAdminEmail(cleanEmail)) {
    throw new Error(`Cannot generate admin session token for unauthorized email: ${cleanEmail}`);
  }
  const signingKey = getAdminSessionSigningKey();
  if (!signingKey) {
    throw new Error(
      "Admin session signing key is not configured or uses a blocklisted fallback secret (fail-closed)."
    );
  }
  const timestamp = Date.now();
  const userTag = `_${Buffer.from(cleanEmail).toString("hex")}`;
  const payload = `${ADMIN_SESSION_TOKEN_PREFIX}${timestamp}${userTag}`;
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Validates the admin session token from the cookie or header.
 * Enforces v2 payload format (invalidating legacy smn_admin_ fallback tokens),
 * server-side timestamp expiration (8 hours max), constant-time HMAC signature verification,
 * fail-closed signing key validation, and account-bound admin email authorization.
 */
export function isValidAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const signingKey = getAdminSessionSigningKey();
  if (!signingKey) return false;

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const payload = token.substring(0, lastDot);
  const signature = token.substring(lastDot + 1);
  if (!payload || !signature) return false;

  // Enforce v2 payload format and timestamp expiration with required user tag
  const match = payload.match(/^ds_admin_v2_(\d+)_([0-9a-fA-F]+)$/);
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

  if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  // Enforce account-bound admin authorization
  const email = getAdminSessionEmail(token);
  return Boolean(email && isAuthorizedAdminEmail(email));
}

/**
 * Safely extracts the email embedded in a v2 session token (if present).
 */
export function getAdminSessionEmail(token: string): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const lastDot = token.lastIndexOf(".");
  const payload = token.substring(0, lastDot);
  const match = payload.match(/^ds_admin_v2_\d+_(.+)$/);
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
 * Fails closed when secret/signing keys are absent or blocklisted.
 */
export function verifyAdminAuth(req: NextRequest): boolean {
  // 1. Direct header check with timing-safe comparison (service / API access)
  const secret = getAdminSecret();
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey && typeof headerKey === "string" && secret) {
    if (!isPredictableOrInvalidSecret(headerKey)) {
      const headBuf = Buffer.from(headerKey.trim());
      const secBuf = Buffer.from(secret);
      if (headBuf.length === secBuf.length && crypto.timingSafeEqual(headBuf, secBuf)) {
        return true;
      }
    }
  }

  // 2. Cookie session check (HMAC-verified admin session bound to authorized email)
  const sessionCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (sessionCookie && isValidAdminSessionToken(sessionCookie)) {
    return true;
  }

  return false;
}

/**
 * Timing-safe passphrase verification helper.
 * Fails closed if ADMIN_SECRET_KEY is not configured or is blocklisted.
 */
export function verifyAdminPassphrase(passphrase: string): boolean {
  if (!passphrase || typeof passphrase !== "string") return false;
  if (isPredictableOrInvalidSecret(passphrase)) return false;
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
