export interface CheckoutSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CheckoutRequestIdentity {
  draftId: string;
  draftRevision: number;
  identityDigest: string;
  idempotencyKey: string;
  docketId: string;
}

export interface ActiveCheckoutAttemptRecovery {
  attemptId: string;
  draftId: string;
  draftRevision: number;
  docketId?: string;
  identityDigest?: string;
}

/** Keep a changed/unknown prior attempt from starting another payment while allowing exact replay. */
export function isActiveCheckoutAttemptUnresolved(input: {
  recovery: ActiveCheckoutAttemptRecovery | null;
  currentDraftId: string;
  currentIdentityDigest: string | null;
  lockedAttemptId?: string;
  lockedAttemptMatchesCurrent?: boolean;
}): boolean {
  const recovery = input.recovery;
  if (!recovery) return false;
  if (input.lockedAttemptId === recovery.attemptId && input.lockedAttemptMatchesCurrent) return false;
  return !recovery.identityDigest || !input.currentIdentityDigest ||
    recovery.draftId !== input.currentDraftId || recovery.identityDigest !== input.currentIdentityDigest;
}

const REQUEST_PREFIX = 'docketstamp_checkout_request_v1_';
const ACTIVE_PREFIX = 'docketstamp_checkout_active_v1_';
const fallbackRequests = new Map<string, CheckoutRequestIdentity>();
const fallbackActiveAttempts = new Map<string, ActiveCheckoutAttemptRecovery>();
const fallbackCapabilities = new Map<string, string>();

export function getCheckoutSessionStorage(): CheckoutSessionStorage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; }
}

function requestKey(draftId: string, identityDigest: string): string {
  return `${REQUEST_PREFIX}${draftId}_${identityDigest}`;
}

function activeKey(draftId: string): string {
  return `${ACTIVE_PREFIX}${draftId}`;
}

export function getOrCreateCheckoutCapability(
  storage: CheckoutSessionStorage | null,
  draftId: string,
  createCapability: () => string = () => randomIdempotencyKey() + randomIdempotencyKey(),
): string {
  const key = `docketstamp_checkout_capability_${draftId}`;
  if (!draftId) return createCapability();
  try {
    const existing = storage?.getItem(key);
    if (existing) {
      fallbackCapabilities.set(draftId, existing);
      return existing;
    }
  } catch { /* Continue with the stable in-memory fallback. */ }
  const capability = fallbackCapabilities.get(draftId) || createCapability();
  fallbackCapabilities.set(draftId, capability);
  try { storage?.setItem(key, capability); } catch { /* Session storage can be disabled. */ }
  return capability;
}

function randomIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Hashes the material fingerprint without persisting its PII-bearing contents. */
export async function checkoutFingerprintDigest(fingerprint: string): Promise<string> {
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // A lookup-only fallback for environments without Web Crypto. The server's
  // idempotency digest remains authoritative and rejects changed payloads.
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < fingerprint.length; index += 1) {
    const code = fingerprint.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

export function getOrCreateCheckoutRequest(
  storage: CheckoutSessionStorage | null,
  input: Omit<CheckoutRequestIdentity, 'idempotencyKey'>,
  createKey: () => string = randomIdempotencyKey,
): CheckoutRequestIdentity {
  const key = requestKey(input.draftId, input.identityDigest);
  if (storage) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null') as Partial<CheckoutRequestIdentity> | null;
      if (parsed?.draftId === input.draftId && parsed.draftRevision === input.draftRevision &&
          parsed.identityDigest === input.identityDigest && typeof parsed.idempotencyKey === 'string' &&
          typeof parsed.docketId === 'string') {
        fallbackRequests.set(key, parsed as CheckoutRequestIdentity);
        return parsed as CheckoutRequestIdentity;
      }
    } catch { /* Continue with a new request key when storage is unavailable. */ }
  }
  const cached = fallbackRequests.get(key);
  if (cached && cached.draftRevision === input.draftRevision) return cached;
  const record = { ...input, idempotencyKey: createKey() };
  fallbackRequests.set(key, record);
  try { storage?.setItem(key, JSON.stringify(record)); } catch { /* Session storage can be disabled. */ }
  return record;
}

export function clearCheckoutRequest(
  storage: CheckoutSessionStorage | null,
  draftId: string,
  identityDigest: string,
): void {
  if (!draftId || !identityDigest) return;
  const key = requestKey(draftId, identityDigest);
  fallbackRequests.delete(key);
  try { storage?.removeItem(key); } catch { /* Best effort. */ }
}

export function saveActiveCheckoutAttempt(
  storage: CheckoutSessionStorage | null,
  attempt: ActiveCheckoutAttemptRecovery,
): void {
  if (!attempt.attemptId || !attempt.draftId || !Number.isSafeInteger(attempt.draftRevision)) return;
  fallbackActiveAttempts.set(attempt.draftId, attempt);
  try { storage?.setItem(activeKey(attempt.draftId), JSON.stringify(attempt)); } catch { /* Best effort; never store payment credentials. */ }
}

export function loadActiveCheckoutAttempt(
  storage: CheckoutSessionStorage | null,
  draftId: string,
): ActiveCheckoutAttemptRecovery | null {
  if (!draftId) return null;
  try {
    const attempt = JSON.parse(storage?.getItem(activeKey(draftId)) || 'null') as Partial<ActiveCheckoutAttemptRecovery> | null;
    if (attempt && attempt.draftId === draftId && typeof attempt.attemptId === 'string' &&
        Number.isSafeInteger(attempt.draftRevision)) {
      fallbackActiveAttempts.set(draftId, attempt as ActiveCheckoutAttemptRecovery);
      return attempt as ActiveCheckoutAttemptRecovery;
    }
  } catch { /* Fall back to the in-memory copy when storage is unavailable. */ }
  const fallback = fallbackActiveAttempts.get(draftId);
  return fallback || null;
}

export function clearActiveCheckoutAttempt(
  storage: CheckoutSessionStorage | null,
  draftId: string,
  attemptId?: string,
): void {
  if (!draftId) return;
  try {
    if (!attemptId || loadActiveCheckoutAttempt(storage, draftId)?.attemptId === attemptId) {
      fallbackActiveAttempts.delete(draftId);
      storage?.removeItem(activeKey(draftId));
    }
  } catch { /* Best effort. */ }
}
