'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { hasExplicitMarketingConsent } from '@/lib/admin-console/measurement/privacy';
import { getGoogleMarketingDestination, getMetaPixelDestination } from '@/lib/marketing-destinations';
import { isCurrentMarketingSurfacePublic } from '@/lib/marketing-privacy';

export function MarketingTags() {
  return <Suspense fallback={null}><MarketingTagsInner /></Suspense>;
}

function MarketingTagsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  useEffect(() => {
    let scriptIds: string[] = [];
    const removeTags = () => {
      for (const key of scriptIds) document.querySelector(`[data-docketstamp-marketing="${key}"]`)?.remove();
      scriptIds = [];
      delete (window as Window & { gtag?: unknown }).gtag;
      delete (window as Window & { fbq?: unknown }).fbq;
      delete (window as Window & { _fbq?: unknown })._fbq;
      // Clear commands queued before consent or navigation changed.
      (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
    };
    const loadTags = () => {
      removeTags();
      if (!hasExplicitMarketingConsent() || !isCurrentMarketingSurfacePublic()) return;
      const google = getGoogleMarketingDestination();
      const googleId = google.tagId || google.adsId || google.ga4Id;
      if (googleId) {
        const loader = document.createElement('script');
        loader.async = true;
        loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`;
        loader.dataset.docketstampMarketing = 'google-loader';
        document.head.appendChild(loader);
        scriptIds.push('google-loader');
        const config = document.createElement('script');
        config.dataset.docketstampMarketing = 'google-config';
        const googleConfig = [google.tagId, google.adsId, google.ga4Id]
          .filter(Boolean)
          .map((id) => `gtag('config',${JSON.stringify(id)},{send_page_view:false,page_location:'https://docketstamp.com/',page_referrer:'',page_title:'DocketStamp'});`)
          .join('');
        config.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());${googleConfig}`;
        document.head.appendChild(config);
        scriptIds.push('google-config');
      }
      const pixelId = getMetaPixelDestination();
      if (pixelId) {
        const config = document.createElement('script');
        config.dataset.docketstampMarketing = 'meta-config';
        config.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;t.dataset.docketstampMarketing='meta-loader';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${pixelId}');fbq('init','${pixelId}');`;
        document.head.appendChild(config);
        scriptIds.push('meta-config');
      }
    };
    loadTags();
    const consentChanged = () => loadTags();
    window.addEventListener('storage', consentChanged);
    window.addEventListener('docketstamp:marketing-consent-changed', consentChanged);
    window.addEventListener('popstate', consentChanged);
    return () => {
      window.removeEventListener('storage', consentChanged);
      window.removeEventListener('docketstamp:marketing-consent-changed', consentChanged);
      window.removeEventListener('popstate', consentChanged);
      removeTags();
    };
  }, [pathname, search]);
  return null;
}
