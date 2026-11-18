'use client';

import { useEffect } from 'react';

// A full top-level navigation isolates Google's tag from the checkout document,
// including its DOM, URL parameters, and referrer. Check eligibility before leaving.
export default function PurchaseMeasurement({ orderId, returnPath }: { orderId: string; returnPath: string }) {
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const key = 'ds_web_purchase_visit_' + orderId;
    async function check() {
      try {
        if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl || localStorage.getItem('docketstamp_google_measurement_denied_v1') === '1'
          || sessionStorage.getItem(key) || window.top !== window.self) return;
        const response = await fetch('/api/marketing/purchase', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, probe: true }), cache: 'no-store', signal: controller.signal,
        });
        if ((response.status === 202 || response.status === 503) && retries < 5) {
          timer = setTimeout(check, 1000 * 2 ** retries++);
          return;
        }
        if (response.status !== 200 || !(await response.json()).ready || controller.signal.aborted) return;
        sessionStorage.setItem('ds_web_purchase_pending', JSON.stringify({ orderId, returnPath }));
        sessionStorage.setItem(key, '1');
        const link = document.createElement('a');
        link.href = '/measurement/purchase';
        link.rel = 'noreferrer';
        link.referrerPolicy = 'no-referrer';
        link.click();
      } catch { /* Storage restrictions and measurement failures leave the receipt available. */ }
    }
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [orderId, returnPath]);
  return null;
}
