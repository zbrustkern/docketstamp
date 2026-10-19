'use client';

import { AttributionTouchSchema } from '@/lib/admin-console/contracts';
import { MARKETING_CONSENT_STORAGE_KEY } from './privacy';

export const ATTRIBUTION_LEDGER_KEY = 'docketstamp_attribution_v1';

type AttributionLedger = { schemaVersion: 1; originalAcquisition?: ReturnType<typeof AttributionTouchSchema.parse>; subsequentTouches: ReturnType<typeof AttributionTouchSchema.parse>[] };

function safeLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().slice(0, 80);
  return /^[A-Za-z0-9_.:-]+$/.test(normalized) ? normalized : undefined;
}

function entrySurface(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/notices/')) return 'notice_workspace';
  if (pathname.startsWith('/companies')) return 'company_directory';
  return 'other';
}

function privacyState(): 'granted' | 'denied' | 'unknown' {
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return 'denied';
    return window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY) === 'granted' ? 'granted' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function recordAttributionTouch(params: {
  pathname: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  kind?: 'acquisition' | 'offer' | 'recovery';
}): AttributionLedger | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_LEDGER_KEY) || window.localStorage.getItem(ATTRIBUTION_LEDGER_KEY);
    const ledger: AttributionLedger = stored
      ? JSON.parse(stored)
      : { schemaVersion: 1, subsequentTouches: [] };
    const touch = AttributionTouchSchema.parse({
      touchId: crypto.randomUUID(),
      kind: params.kind || (ledger.originalAcquisition ? 'recovery' : 'acquisition'),
      observedAt: new Date().toISOString(),
      source: safeLabel(params.source || null),
      medium: safeLabel(params.medium || null),
      campaignId: safeLabel(params.campaign || null),
      entrySurface: entrySurface(params.pathname),
      consent: privacyState(),
    });

    if (!ledger.originalAcquisition) ledger.originalAcquisition = touch;
    else {
      ledger.subsequentTouches.push(touch);
      ledger.subsequentTouches = ledger.subsequentTouches.slice(-20);
    }
    window.sessionStorage.setItem(ATTRIBUTION_LEDGER_KEY, JSON.stringify(ledger));
    window.localStorage.setItem(ATTRIBUTION_LEDGER_KEY, JSON.stringify(ledger));
    return ledger;
  } catch {
    // Storage denial leaves acquisition unknown; it never breaks the product journey.
    return null;
  }
}

export function readAttributionLedger(): AttributionLedger | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_LEDGER_KEY) || window.localStorage.getItem(ATTRIBUTION_LEDGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionLedger;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.subsequentTouches)) return null;
    return parsed;
  } catch {
    return null;
  }
}
