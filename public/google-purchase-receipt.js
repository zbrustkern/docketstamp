// This script runs only on the standalone, first-party purchase receipt.
(async () => {
  const link = document.getElementById('continue');
  let returnPath = '/';
  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    location.replace(returnPath);
  };
  link.addEventListener('click', event => { event.preventDefault(); leave(); });
  try {
    const pending = JSON.parse(sessionStorage.getItem('ds_web_purchase_pending') || 'null');
    sessionStorage.removeItem('ds_web_purchase_pending');
    if (!pending || !/^order_[a-zA-Z0-9_-]{1,110}$/.test(pending.orderId)) return;
    if (/^\/docket\/DS-[A-Z0-9-]+$/.test(pending.returnPath) || pending.returnPath === '/order/' + pending.orderId) {
      returnPath = pending.returnPath;
    }
    link.textContent = 'View your order record';
    const denied = () => navigator.globalPrivacyControl === true || localStorage.getItem('docketstamp_google_measurement_denied_v1') === '1';
    if (window.top !== window.self || location.search || location.hash || document.referrer || denied()) return leave();
    const response = await fetch('/api/marketing/purchase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ orderId: pending.orderId, probe: false }), signal: AbortSignal.timeout(3500),
    });
    if (response.status !== 200 || denied() || left) return leave();
    const event = await response.json();
    const hasValidEmailHash = typeof event.emailHash === 'string' && /^[a-f0-9]{64}$/.test(event.emailHash);
    const hasValidClick = ['gclid', 'gbraid', 'wbraid'].includes(event.click?.type) && /^[A-Za-z0-9_.~-]{1,255}$/.test(event.click.value);
    if (!/^AW-\d+\/[A-Za-z0-9_-]+$/.test(event.sendTo) || (!hasValidEmailHash && !hasValidClick)
      || !/^[a-f0-9]{40}$/.test(event.transactionId) || event.currency !== 'USD' || !(event.value > 0)) return leave();

    // The linker can read the original, consented click without exposing the workspace URL.
    if (hasValidClick) {
      history.replaceState(null, '', '?' + event.click.type + '=' + encodeURIComponent(event.click.value));
    }
    window.dataLayer = [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', analytics_storage: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    const adsId = event.sendTo.split('/')[0];
    gtag('config', adsId, { send_page_view: false, allow_enhanced_conversions: true, allow_ad_personalization_signals: false, page_referrer: '' });
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + adsId;
    script.onerror = leave;
    script.onload = () => {
      if (left || denied()) return leave();
      if (hasValidEmailHash) gtag('set', 'user_data', { sha256_email_address: event.emailHash });
      gtag('event', 'conversion', {
        send_to: event.sendTo, value: event.value, currency: event.currency, transaction_id: event.transactionId,
        event_callback: leave, event_timeout: 1800,
      });
    };
    setTimeout(leave, 3000);
    document.head.append(script);
  } catch { leave(); }
})();
