/**
 * Sliding Window Rate Limiter for DocketStamp API Protection
 * Protects live CASS address verification keys and AI endpoints against abuse.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes sliding window
const DEFAULT_MAX_REQUESTS = 5;

// In-memory store (cleans up stale keys automatically)
const ipStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  bucket?: string;
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
  message?: string;
}

export function checkRateLimit(
  clientId: string,
  options?: RateLimitOptions
): RateLimitResult {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const storeKey = options?.bucket ? `${options.bucket}:${clientId}` : clientId;

  const now = Date.now();
  const windowStart = now - windowMs;

  // Cleanup old records periodically
  if (ipStore.size > 2000) {
    for (const [key, record] of ipStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        ipStore.delete(key);
      }
    }
  }

  const record = ipStore.get(storeKey) || { timestamps: [] };
  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000)
    );
    const minutes = Math.ceil(retryAfterSeconds / 60);

    return {
      allowed: false,
      remaining: 0,
      limit: maxRequests,
      retryAfterSeconds,
      message:
        options?.message ||
        `Rate limit exceeded (${maxRequests} requests per ${Math.round(
          windowMs / 60000
        )} minutes). Please retry in ${retryAfterSeconds}s.`,
    };
  }

  // Record this request
  record.timestamps.push(now);
  ipStore.set(storeKey, record);

  const remaining = maxRequests - record.timestamps.length;

  return {
    allowed: true,
    remaining,
    limit: maxRequests,
    retryAfterSeconds: 0,
  };
}

/**
 * Refunds a single request timestamp from the client's rate limit quota
 * if their prompt was rejected by a provider policy filter (non-punitive UX).
 */
export function refundRateLimit(clientId: string, bucket?: string): void {
  const storeKey = bucket ? `${bucket}:${clientId}` : clientId;
  const record = ipStore.get(storeKey);
  if (record && record.timestamps.length > 0) {
    record.timestamps.pop();
    ipStore.set(storeKey, record);
  }
}

/**
 * Clears in-memory rate limit store for testing purposes.
 */
export function resetRateLimits(): void {
  ipStore.clear();
}
