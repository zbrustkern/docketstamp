"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { OrderAttribution } from "@/lib/types";
import { getGoogleClientId } from "@/lib/telemetry";
import { trackMetaPageView, getMetaBrowserCookie, buildMetaFbcString } from "@/lib/meta-ads";
import { readAttributionLedger, recordAttributionTouch } from "@/lib/admin-console/measurement/attribution";
import { emitBusinessEvent } from "@/lib/admin-console/measurement/client";

// Separate campaign parameters from the structured touch ledger in measurement/attribution.
export const ATTRIBUTION_STORAGE_KEY = "docketstamp_order_attribution_v1";
/** Read-only migration source; writes use the canonical namespace. */
export const LEGACY_ATTRIBUTION_STORAGE_KEY = "smn_attribution";

function acquisitionEntrySurface(pathname: string): string | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/notices/')) return 'notice_workspace';
  if (pathname === '/companies') return 'company_directory';
  if (pathname === '/letters') return 'notice_directory';
  return null;
}

function readAttributionStorage(): string | null {
  const canonical = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  if (canonical) return canonical;
  const legacy = sessionStorage.getItem(LEGACY_ATTRIBUTION_STORAGE_KEY) || localStorage.getItem(LEGACY_ATTRIBUTION_STORAGE_KEY);
  if (legacy) writeAttributionStorage(legacy);
  return legacy;
}

function writeAttributionStorage(value: string): void {
  sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, value);
  localStorage.setItem(ATTRIBUTION_STORAGE_KEY, value);
  sessionStorage.removeItem(LEGACY_ATTRIBUTION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ATTRIBUTION_STORAGE_KEY);
}

/**
 * Retrieve first-party cookie by name safely.
 */
function getDocumentCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : undefined;
}

/**
 * Retrieves the stored attribution data from session/local storage,
 * lazily backfilling Meta cookies (_fbp, _fbc) if they were set asynchronously
 * by the Meta Pixel script after initial page load.
 */
export function getStoredAttribution(): OrderAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readAttributionStorage();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as OrderAttribution;

    // Check if _fbp or _fbc became available after the initial attribution was saved
    let changed = false;
    if (!parsed.fbp) {
      const fbp = getMetaBrowserCookie("_fbp") || getDocumentCookie("_fbp");
      if (fbp) {
        parsed.fbp = fbp;
        changed = true;
      }
    }

    if (!parsed.fbc) {
      const fbc =
        getMetaBrowserCookie("_fbc") ||
        getDocumentCookie("_fbc") ||
        (parsed.fbclid ? buildMetaFbcString(parsed.fbclid) : null);
      if (fbc) {
        parsed.fbc = fbc;
        changed = true;
      }
    }

    if (changed) {
      writeAttributionStorage(JSON.stringify(parsed));
    }

    return parsed;
  } catch {
    return null;
  }
}

function AttributionTrackerInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  // Track Meta Pixel PageView on client-side route transitions (SPA navigation)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Subsequent client-side route transitions
    trackMetaPageView();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const currentPath = pathname || window.location.pathname;
      const entrySurface = acquisitionEntrySurface(currentPath);
      const isGpcActive =
        typeof navigator !== "undefined" &&
        (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

      if (isGpcActive) {
        const win = window as unknown as { fbq?: (...args: unknown[]) => void };
        if (typeof win.fbq === "function") {
          // Enforce Meta Limited Data Use for GPC compliance
          win.fbq("dataProcessingOptions", ["LDU"], 0, 0);
        }
      }

      // Account, order, admin, and utility routes are not acquisition entries.
      // Keep them out of the session denominator and let the next eligible
      // public entry establish the acquisition touch.
      if (!entrySurface) return;
      const emitEntryViewed = () => emitBusinessEvent({
        eventName: 'entry_viewed',
        entrySurface,
        logicalKey: `entry:${currentPath}`,
      });

      const utmSource = searchParams.get("utm_source") || undefined;
      const utmMedium = searchParams.get("utm_medium") || undefined;
      const utmCampaign = searchParams.get("utm_campaign") || undefined;
      const utmContent = searchParams.get("utm_content") || undefined;
      const utmTerm = searchParams.get("utm_term") || undefined;
      const gclid = searchParams.get("gclid") || undefined;
      const fbclid = searchParams.get("fbclid") || undefined;

      const hasCampaignParams = Boolean(
        utmSource || utmMedium || utmCampaign || gclid || fbclid || utmContent || utmTerm
      );

      // Extract Meta cookies
      const fbp = getMetaBrowserCookie("_fbp") || getDocumentCookie("_fbp");
      let fbc = getMetaBrowserCookie("_fbc") || getDocumentCookie("_fbc");
      if (!fbc && fbclid) {
        fbc = buildMetaFbcString(fbclid) || undefined;
      }

      // If user landed with campaign parameters, overwrite or set attribution
      if (hasCampaignParams) {
        const defaultSource = gclid ? "google" : fbclid ? "meta" : undefined;
        const defaultMedium = gclid || fbclid ? "cpc" : undefined;
        const defaultCampaign = gclid ? "Google Ads" : fbclid ? "Meta Ads" : undefined;

        const attribution: OrderAttribution = {
          utmSource: utmSource || defaultSource,
          utmMedium: utmMedium || defaultMedium,
          utmCampaign: utmCampaign || defaultCampaign,
          utmContent,
          utmTerm,
          gclid,
          fbclid,
          fbp: fbp || undefined,
          fbc: fbc || undefined,
          referrer: document.referrer || undefined,
          landingPath: pathname || window.location.pathname,
          googleClientId: getGoogleClientId(),
          gpc: isGpcActive || undefined,
          capturedAt: Date.now(),
        };

        const priorLedger = readAttributionLedger();
        const isOfferTouch = Boolean(searchParams.get("offer") || searchParams.get("coupon") || searchParams.get("promo"));
        recordAttributionTouch({
          pathname,
          source: attribution.utmSource,
          medium: attribution.utmMedium,
          campaign: attribution.utmCampaign,
          kind: priorLedger?.originalAcquisition ? (isOfferTouch ? "offer" : "recovery") : "acquisition",
        });

        writeAttributionStorage(JSON.stringify(attribution));
        emitEntryViewed();
        return;
      }

      // If no campaign params, check if we already have an attribution stored in this session
      const existing = readAttributionStorage();
      if (existing) {
        // Just make sure fbp/fbc are augmented if they were populated after script init
        try {
          const parsed = JSON.parse(existing) as OrderAttribution;
          let updated = false;
          if (!parsed.fbp && fbp) {
            parsed.fbp = fbp;
            updated = true;
          }
          if (!parsed.fbc && fbc) {
            parsed.fbc = fbc;
            updated = true;
          }
          if (updated) {
            writeAttributionStorage(JSON.stringify(parsed));
          }
          // The old order-attribution store can predate the v1 measurement
          // ledger. Backfill that ledger before emitting the entry so this
          // first event carries the same compact acquisition reference.
          if (!readAttributionLedger()?.originalAcquisition) {
            const source = parsed.utmSource || 'direct';
            const medium = parsed.utmMedium || 'none';
            recordAttributionTouch({
              pathname: parsed.landingPath || currentPath,
              source,
              medium,
              campaign: parsed.utmCampaign === '(direct/organic)' ? 'direct_organic' : parsed.utmCampaign || 'unknown',
              kind: 'acquisition',
            });
          }
        } catch {
          // ignore
        }
        emitEntryViewed();
        return;
      }

      // First time visitor without UTMs: classify referrer
      const ref = document.referrer;
      let detectedSource = "direct";
      let detectedMedium = "none";

      if (ref) {
        try {
          const refHost = new URL(ref).hostname.toLowerCase();
          if (!refHost.includes(window.location.hostname.toLowerCase())) {
            if (refHost.includes("google.")) {
              detectedSource = "google";
              detectedMedium = "organic";
            } else if (refHost.includes("bing.")) {
              detectedSource = "bing";
              detectedMedium = "organic";
            } else if (refHost.includes("yahoo.")) {
              detectedSource = "yahoo";
              detectedMedium = "organic";
            } else if (
              refHost.includes("facebook.") ||
              refHost.includes("fb.com") ||
              refHost.includes("instagram.")
            ) {
              detectedSource = "meta";
              detectedMedium = "social";
            } else if (
              refHost.includes("t.co") ||
              refHost.includes("twitter.") ||
              refHost.includes("x.com")
            ) {
              detectedSource = "x";
              detectedMedium = "social";
            } else if (refHost.includes("linkedin.")) {
              detectedSource = "linkedin";
              detectedMedium = "social";
            } else if (refHost.includes("reddit.")) {
              detectedSource = "reddit";
              detectedMedium = "social";
            } else {
              detectedSource = refHost;
              detectedMedium = "referral";
            }
          }
        } catch {
          // invalid referrer URL
        }
      }

      const defaultAttribution: OrderAttribution = {
        utmSource: detectedSource,
        utmMedium: detectedMedium,
        utmCampaign: "(direct/organic)",
        referrer: ref || undefined,
        landingPath: pathname || window.location.pathname,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
        gpc: isGpcActive || undefined,
        capturedAt: Date.now(),
      };

      if (!readAttributionLedger()?.originalAcquisition) {
        recordAttributionTouch({
          pathname,
          source: detectedSource,
          medium: detectedMedium,
          campaign: "direct_organic",
          kind: "acquisition",
        });
      }

      writeAttributionStorage(JSON.stringify(defaultAttribution));
      emitEntryViewed();
    } catch (e) {
      // Capture failures are non-fatal. Keep the visit observable with
      // acquisition unknown rather than losing the entry event altogether.
      emitBusinessEvent({
        eventName: 'entry_viewed',
        entrySurface: acquisitionEntrySurface(pathname) || undefined,
        logicalKey: `entry:${pathname || window.location.pathname}`,
      });
      console.warn("[Attribution Tracker] Non-fatal capture notice:", e);
    }
  }, [searchParams, pathname]);

  return null;
}

export function AttributionTracker() {
  return (
    <Suspense fallback={null}>
      <AttributionTrackerInner />
    </Suspense>
  );
}
