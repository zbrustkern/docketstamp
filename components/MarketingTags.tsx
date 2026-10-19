'use client';

import { useEffect } from 'react';
import { hasExplicitMarketingConsent } from '@/lib/admin-console/measurement/privacy';

export function MarketingTags() {
  useEffect(() => {
    if (!hasExplicitMarketingConsent()) return;
    const scriptIds: string[] = [];
    const googleId = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    if (googleId) {
      const loader = document.createElement('script');
      loader.async = true;
      loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`;
      loader.dataset.docketstampMarketing = 'google-loader';
      document.head.appendChild(loader);
      scriptIds.push('google-loader');
      const config = document.createElement('script');
      config.dataset.docketstampMarketing = 'google-config';
      config.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());${process.env.NEXT_PUBLIC_GOOGLE_TAG_ID ? `gtag('config','${process.env.NEXT_PUBLIC_GOOGLE_TAG_ID}',{send_page_view:false});` : ''}${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ? `gtag('config','${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}');` : ''}${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ? `gtag('config','${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}',{send_page_view:false});` : ''}`;
      document.head.appendChild(config);
      scriptIds.push('google-config');
    }
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (pixelId) {
      const config = document.createElement('script');
      config.dataset.docketstampMarketing = 'meta-config';
      config.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`;
      document.head.appendChild(config);
      scriptIds.push('meta-config');
    }
    return () => {
      for (const key of scriptIds) document.querySelector(`[data-docketstamp-marketing="${key}"]`)?.remove();
    };
  }, []);
  return null;
}
