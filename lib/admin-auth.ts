import { NextRequest } from "next/server";
import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "smn_admin_session";

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
    return "sendmynotes2026";
  }
  console.error("[AdminAuth] ERROR: ADMIN_SECRET_KEY is not configured in production environment.");
  return null;
}

/**
 * Creates a signed session token derived from the secret key and current timestamp.
 */
export function generateAdminSessionToken(): string {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error("Cannot generate admin session token: ADMIN_SECRET_KEY is not configured.");
  }
  const payload = `smn_admin_${Date.now()}`;
  const signature = crypto
    .createHmac("sha256", secret)
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
  const secret = getAdminSecret();
  if (!secret) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  // Enforce payload format and timestamp expiration
  const match = payload.match(/^smn_admin_(\d+)$/);
  if (!match) return false;

  const timestamp = parseInt(match[1], 10);
  const now = Date.now();
  const maxAgeMs = 8 * 60 * 60 * 1000; // 8 hours server lifetime

  if (isNaN(timestamp) || now - timestamp > maxAgeMs || timestamp > now + 60000) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
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
 * Validates incoming admin request from cookie or x-admin-key header.
 */
export function verifyAdminAuth(req: NextRequest): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;

  // 1. Direct header check with timing-safe comparison
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey && typeof headerKey === "string") {
    const headBuf = Buffer.from(headerKey);
    const secBuf = Buffer.from(secret);
    if (headBuf.length === secBuf.length && crypto.timingSafeEqual(headBuf, secBuf)) {
      return true;
    }
  }

  // 2. Cookie session check
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
