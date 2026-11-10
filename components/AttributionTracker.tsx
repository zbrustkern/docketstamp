"use client";
import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackMetaPageView } from '@/lib/meta-ads';
import type { OrderAttribution } from '@/lib/types';
import { acquisitionSurface } from '@/lib/acquisition';
import { captureCurrentAcquisition, readCurrentAcquisition } from '@/lib/acquisition-client';
import { emitBusinessEvent } from '@/lib/admin-console/measurement/client';

export const ATTRIBUTION_STORAGE_KEY = 'docketstamp_order_attribution_v1';
export const LEGACY_ATTRIBUTION_STORAGE_KEY = "smn_attribution";
/** Compatibility for legacy first-party telemetry; no raw clicks, URLs or vendor cookies. */
export function getStoredAttribution(): OrderAttribution | null {
  if (typeof window === 'undefined') return null;
  const touch = readCurrentAcquisition().snapshot.currentSession;
  return touch ? { utmSource: touch.source, utmMedium: touch.medium, utmCampaign: touch.campaignId, capturedAt: Date.parse(touch.observedAt) } : null;
}
function Tracker() {
  const pathname = usePathname();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    trackMetaPageView(); // Existing consent and public-route gates remain authoritative.
  }, [pathname]);
  const search = useSearchParams();
  useEffect(() => {
    const surface = acquisitionSurface(pathname);
    if (!surface) return;
    captureCurrentAcquisition();
    emitBusinessEvent({ eventName: 'entry_viewed', entrySurface: surface, logicalKey: `entry:${pathname}` });
  }, [pathname, search]);
  return null;
}
export function AttributionTracker() { return <Suspense fallback={null}><Tracker /></Suspense>; }
