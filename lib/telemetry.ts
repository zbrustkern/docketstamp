import { TelemetryEventName, EntrySource, TelemetryEvent } from "./types";
import { getStoredAttribution } from "@/components/AttributionTracker";
import { isAuthorityEvent, sanitizeUrlOrPath } from "./telemetry-schema";

export const TELEMETRY_COLLECTION = "telemetry_events";

// Re-export reporting engine and types from telemetry-reporting
export {
  computeFunnelConversionReport,
  isTestOrCompOrder,
} from "./telemetry-reporting";
export type {
  FunnelStageMetric,
  FunnelCohortBreakdown,
  FunnelAttributionSummary,
  FunnelConversionReport,
  ComputeFunnelReportOptions,
} from "./telemetry-reporting";

let currentSessionId: string | null = null;

export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server_session";
  }

  if (!currentSessionId) {
    const existing = window.sessionStorage.getItem("smn_telemetry_session");
    if (existing) {
      currentSessionId = existing;
    } else {
      currentSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem("smn_telemetry_session", currentSessionId);
    }
  }

  return currentSessionId;
}

/**
 * Extracts Google Analytics Client ID from document cookies (_ga=GA1.1.XXXX.XXXX)
 */
export function getGoogleClientId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const match = document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Categorizes the visitor's device based on viewport and user agent
 */
export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  try {
    const ua = navigator.userAgent.toLowerCase();
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
    if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
    const width = window.innerWidth || window.screen?.width || 1024;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  } catch {
    return "desktop";
  }
}

/**
 * Returns viewport/screen resolution string (e.g. "390x844")
 */
export function getScreenResolution(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    return `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`;
  } catch {
    return "unknown";
  }
}

// ============================================================================
// DEDUPLICATION STORE (In-Memory + SessionStorage)
// ============================================================================

const emittedDedupeKeys = new Set<string>();
const DEDUPE_STORAGE_KEY = "docket_emitted_telemetry_keys";

export function computeDedupeKey(
  sessionId: string,
  eventName: string,
  noticeSlug?: string,
  revisionOrOrderId?: string | number
): string {
  const slug = noticeSlug || "";
  const rev = revisionOrOrderId !== undefined ? String(revisionOrOrderId) : "";
  return `${sessionId}:${eventName}:${slug}:${rev}`;
}

export function isEventDeduplicated(dedupeKey: string): boolean {
  if (emittedDedupeKeys.has(dedupeKey)) {
    return true;
  }
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(DEDUPE_STORAGE_KEY);
      if (raw) {
        const storedKeys: string[] = JSON.parse(raw);
        if (storedKeys.includes(dedupeKey)) {
          emittedDedupeKeys.add(dedupeKey);
          return true;
        }
      }
    } catch {
      // Fallback to in-memory set
    }
  }
  return false;
}

export function markEventDeduplicated(dedupeKey: string): void {
  emittedDedupeKeys.add(dedupeKey);
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(DEDUPE_STORAGE_KEY);
      const storedKeys: string[] = raw ? JSON.parse(raw) : [];
      if (!storedKeys.includes(dedupeKey)) {
        storedKeys.push(dedupeKey);
        // Cap at 200 keys per session
        if (storedKeys.length > 200) {
          storedKeys.splice(0, storedKeys.length - 200);
        }
        window.sessionStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(storedKeys));
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }
}

export function resetDeduplicationState(): void {
  emittedDedupeKeys.clear();
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(DEDUPE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// FUNNEL TELEMETRY EMISSION
// ============================================================================

export interface TrackFunnelEventParams {
  eventName: TelemetryEventName;
  step?: number;
  noticeSlug?: string;
  recipientId?: string;
  tier?: string;
  draftRevision?: number;
  orderId?: string;
  entrySource?: EntrySource | string;
  experienceVersion?: string;
  amountInCents?: number;
  metadata?: Record<string, unknown>;
  force?: boolean; // if true, skip client deduplication check
}

/**
 * Tracks a funnel event with deterministic client-side deduplication.
 * Prevents React re-renders and back/forward navigation from inflating funnel counts.
 * Strictly blocks client emission of authority events.
 */
export async function trackFunnelEvent(params: TrackFunnelEventParams): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Authority events are server-only; browser emitter skips sending them
  if (isAuthorityEvent(params.eventName)) {
    console.warn(`[Telemetry Security] Browser attempted to emit authority event '${params.eventName}'. Dropped.`);
    return false;
  }

  const sessionId = getSessionId();
  const noticeSlug = params.noticeSlug;
  const revOrOrder = params.draftRevision !== undefined ? params.draftRevision : params.orderId;
  const dedupeKey = computeDedupeKey(sessionId, params.eventName, noticeSlug, revOrOrder);

  // 2. Client deduplication check
  if (!params.force && isEventDeduplicated(dedupeKey)) {
    return false; // Already emitted for this session + slug + revision/order
  }

  // Mark as emitted before network dispatch to handle rapid re-renders
  markEventDeduplicated(dedupeKey);

  try {
    const attr = getStoredAttribution();
    const googleClientId = getGoogleClientId();
    const deviceType = getDeviceType();
    const screenResolution = getScreenResolution();

    const rawReferrer = attr?.referrer || (document.referrer ? document.referrer : undefined);
    const cleanReferrer = sanitizeUrlOrPath(rawReferrer);
    const cleanPath = sanitizeUrlOrPath(window.location.pathname) || "/";
    const cleanLandingPath = sanitizeUrlOrPath(attr?.landingPath || window.location.pathname) || "/";

    // Clean allowlisted metadata
    const cleanMetadata: Record<string, unknown> = {
      ...(params.metadata || {}),
      experienceVersion: params.experienceVersion || "home_v2",
      entrySource: params.entrySource || "home_chooser",
      noticeSlug: params.noticeSlug,
      recipientId: params.recipientId,
      tier: params.tier,
      draftRevision: params.draftRevision,
      deviceCategory: deviceType,
      dedupeKey,
    };
    if (params.amountInCents !== undefined) {
      cleanMetadata.amountInCents = params.amountInCents;
    }

    const payload = {
      eventName: params.eventName,
      step: params.step,
      sessionId,
      orderId: params.orderId,
      noticeSlug: params.noticeSlug,
      recipientId: params.recipientId,
      tier: params.tier,
      draftRevision: params.draftRevision,
      entrySource: params.entrySource || "home_chooser",
      experienceVersion: params.experienceVersion || "home_v2",
      deviceCategory: deviceType,
      dedupeKey,
      metadata: cleanMetadata,
      timestamp: Date.now(),
      path: cleanPath,
      // Visitor acquisition attribution
      utmSource: attr?.utmSource,
      utmMedium: attr?.utmMedium,
      utmCampaign: attr?.utmCampaign,
      utmContent: attr?.utmContent,
      utmTerm: attr?.utmTerm,
      gclid: attr?.gclid,
      fbclid: attr?.fbclid,
      referrer: cleanReferrer,
      landingPath: cleanLandingPath,
      // Technology & Google Analytics identity
      googleClientId,
      deviceType,
      screenResolution,
    };

    let sent = false;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        sent = navigator.sendBeacon("/api/telemetry", blob);
      } catch {
        sent = false;
      }
    }
    if (!sent) {
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }

    // Forward to GA4 / gtag if active
    const win = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof win.gtag === "function") {
      win.gtag("event", params.eventName, {
        event_category: "docket_funnel",
        step_number: params.step,
        order_id: params.orderId,
        notice_slug: params.noticeSlug,
        entry_source: params.entrySource,
        experience_version: params.experienceVersion || "home_v2",
        tier: params.tier,
      });
    }

    return true;
  } catch (err) {
    console.debug("[Telemetry] Failed to dispatch funnel event:", err);
    return false;
  }
}

/**
 * Legacy/Standard event tracking wrapper.
 * Preserved for backward compatibility with existing components and test suites.
 */
export async function trackEvent(
  eventName: TelemetryEventName,
  step?: number,
  metadata?: Record<string, unknown>,
  orderId?: string
): Promise<void> {
  if (typeof window === "undefined") return;

  // Authority events are server-only; browser emitter skips sending them
  if (isAuthorityEvent(eventName)) {
    return;
  }

  const sessionId = getSessionId();

  try {
    const attr = getStoredAttribution();
    const googleClientId = getGoogleClientId();
    const deviceType = getDeviceType();
    const screenResolution = getScreenResolution();

    const rawReferrer = attr?.referrer || (document.referrer ? document.referrer : undefined);
    const cleanReferrer = sanitizeUrlOrPath(rawReferrer);
    const cleanPath = sanitizeUrlOrPath(window.location.pathname) || "/";
    const cleanLandingPath = sanitizeUrlOrPath(attr?.landingPath || window.location.pathname) || "/";

    const payload = {
      eventName,
      step,
      sessionId,
      orderId,
      metadata: metadata || {},
      timestamp: Date.now(),
      path: cleanPath,
      // Visitor acquisition attribution
      utmSource: attr?.utmSource,
      utmMedium: attr?.utmMedium,
      utmCampaign: attr?.utmCampaign,
      utmContent: attr?.utmContent,
      utmTerm: attr?.utmTerm,
      gclid: attr?.gclid,
      fbclid: attr?.fbclid,
      referrer: cleanReferrer,
      landingPath: cleanLandingPath,
      // Technology & Google Analytics identity
      googleClientId,
      deviceType,
      screenResolution,
    };

    // Try sendBeacon first, fallback to fetch with keepalive
    let sent = false;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        sent = navigator.sendBeacon("/api/telemetry", blob);
      } catch {
        sent = false;
      }
    }
    if (!sent) {
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }

    // Forward to GA4 / gtag if active
    const win = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof win.gtag === "function") {
      win.gtag("event", eventName, {
        event_category: "visitor_telemetry",
        step_number: step,
        order_id: orderId,
        ...(metadata || {}),
      });
    }
  } catch (err) {
    // Non-blocking
    console.debug("[Telemetry] Failed to dispatch event:", err);
  }
}
