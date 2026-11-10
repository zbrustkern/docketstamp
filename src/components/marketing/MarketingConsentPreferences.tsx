'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { allowFutureAcquisitionEvidence, clearStoredAcquisitionEvidence, markGoogleOfflinePreferenceExists } from '@/lib/acquisition-client';
import { notifyMarketingConsentChanged } from '@/lib/admin-console/measurement/privacy';

type State = 'loading' | 'unknown' | 'granted' | 'denied' | 'withdrawn' | 'unavailable';

export default function MarketingConsentPreferences() {
  const pathname = usePathname();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const gpc = typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  const storageAvailable = () => {
    try {
      const key = `docketstamp_storage_probe_${crypto.randomUUID()}`;
      localStorage.setItem(key, '1'); localStorage.removeItem(key);
      sessionStorage.setItem(key, '1'); sessionStorage.removeItem(key);
      return true;
    } catch { return false; }
  };

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/account')) return;
    let active = true;
    fetch('/api/marketing/consent', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => {
        if (!active) return;
        const next = data?.status === 'granted' ? 'granted' : data?.status === 'denied' ? 'denied' : data?.status === 'withdrawn' ? 'withdrawn' : 'unknown';
        setState(next);
        if (next === 'granted') markGoogleOfflinePreferenceExists();
        if (next === 'denied' || next === 'withdrawn' || data?.gpc) {
          clearStoredAcquisitionEvidence(true);
          notifyMarketingConsentChanged();
        }
      })
      .catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; };
  }, [pathname]);

  if (pathname.startsWith('/admin') || pathname.startsWith('/account') || state === 'loading') return null;
  const save = async (choice: 'grant' | 'refuse' | 'withdraw') => {
    if (choice === 'grant' && (gpc || !storageAvailable())) {
      clearStoredAcquisitionEvidence(true);
      notifyMarketingConsentChanged();
      setNotice(gpc ? 'Your browser privacy setting keeps Google ad measurement off. Checkout remains available.' : 'Browser storage is unavailable, so Google ad measurement stays off. Checkout remains available.');
      setState('unavailable');
      return;
    }
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/marketing/consent', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setState(data.status);
      if (choice !== 'grant' || data.gpc) clearStoredAcquisitionEvidence(true);
      else { allowFutureAcquisitionEvidence(); markGoogleOfflinePreferenceExists(); }
      notifyMarketingConsentChanged();
      setNotice(choice === 'grant' && !data.gpc ? 'Preference saved.' : 'Preference saved. Google ad measurement is off.');
    } catch {
      setNotice('We could not save this preference. If you had allowed measurement, that setting may still be active. Please try again.');
    } finally { setBusy(false); }
  };

  const showChoices = state !== 'granted';
  return (
    <aside aria-label="Optional Google ad measurement preferences" className="mx-auto my-4 w-full max-w-5xl border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="font-semibold">Optional Google ad measurement</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            If you agree, DocketStamp may report an eligible paid order with its Google click ID, order ID, payment time, amount, and currency. It does not send your name, contact details, address, or document contents. This choice does not affect checkout.
          </p>
          {notice && <p role="status" className="mt-1 text-xs text-slate-700">{notice}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {showChoices ? <>
            <button type="button" disabled={busy || gpc || !storageAvailable()} onClick={() => void save('grant')} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{gpc ? 'Disabled by browser setting' : 'Allow'}</button>
            <button type="button" disabled={busy} onClick={() => void save('refuse')} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Decline</button>
          </> : <>
            <span className="self-center text-xs text-slate-600">{state === 'granted' ? 'Allowed' : 'Off'}</span>
            {state === 'granted' ? <button type="button" disabled={busy} onClick={() => void save('withdraw')} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Withdraw</button> : <button type="button" disabled={busy || gpc || !storageAvailable()} onClick={() => void save('grant')} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Allow</button>}
          </>}
        </div>
      </div>
    </aside>
  );
}
