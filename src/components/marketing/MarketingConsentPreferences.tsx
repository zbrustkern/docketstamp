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
  const save = async (choice: 'grant' | 'refuse') => {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/marketing/consent', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice: choice === 'grant' ? 'grant_enhanced' : 'refuse' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setState(data.status);
      if (choice !== 'grant' || data.gpc) clearStoredAcquisitionEvidence(true);
      else { allowFutureAcquisitionEvidence(); markGoogleOfflinePreferenceExists(); }
      notifyMarketingConsentChanged();
      setNotice(choice === 'grant' && !data.gpc ? 'Ad purchase measurement re-enabled.' : 'Opted out. Google ad measurement is off.');
    } catch {
      setNotice('Could not save preference. Please try again.');
    } finally { setBusy(false); }
  };

  const optedOut = gpc || state === 'denied' || state === 'withdrawn';
  return (
    <aside aria-label="Google ad measurement preferences" className="mx-auto w-full max-w-5xl border-t border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="leading-5">
            {gpc
              ? 'Google ad purchase measurement is off because your browser sends a Global Privacy Control signal.'
              : optedOut
              ? 'Google ad purchase measurement is off for this browser.'
              : 'We measure completed purchases on eligible notices with Google Ads (click ID, hashed checkout email, and order total; never letter contents or addresses).'}
          </p>
          {notice && <p role="status" className="mt-1 text-slate-300">{notice}</p>}
        </div>
        {!gpc && (
          <div className="flex shrink-0 items-center gap-2">
            {optedOut ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save('grant')}
                className="rounded border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 disabled:opacity-50"
              >
                Re-enable measurement
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save('refuse')}
                className="rounded border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                Opt out of ad measurement
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
