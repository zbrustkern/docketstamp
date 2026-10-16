import type { Metadata } from "next";
import { Inter, Merriweather, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AttributionTracker } from "@/components/AttributionTracker";
import { GOOGLE_TAG_ID, GOOGLE_ADS_ID, GA4_MEASUREMENT_ID } from "@/lib/google-ads";
import { META_PIXEL_ID } from "@/lib/meta-ads";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const merriweather = Merriweather({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://docketstamp.com";
const isStaging =
  process.env.ENVIRONMENT === "staging" ||
  appUrl.includes("staging") ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.includes("staging");

const metaDomainVerification =
  process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION || "7j8rbkz9ktc5jzapl53uueqvute5et";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DocketStamp | Official Document & Certified Mail Dispatch Registry",
    template: "%s | DocketStamp",
  },
  description:
    "Formal legal notice preparation and physical USPS First-Class & Certified Mail dispatch registry. State-specific statutory notices drafted and dispatched in 60 seconds.",
  applicationName: "DocketStamp",
  authors: [{ name: "Western Amalgamated" }],
  creator: "Western Amalgamated",
  publisher: "DocketStamp",
  keywords: [
    "certified mail online",
    "statutory legal notice",
    "security deposit demand letter",
    "notice of intent to vacate",
    "fcra dispute letter",
    "fdcpa debt validation letter",
    "usps certified mail service",
    "docket stamp registry",
    "written contract cancellation",
  ],
  alternates: {
    canonical: appUrl,
  },
  robots: isStaging
    ? {
        index: false,
        follow: false,
        nocache: true,
      }
    : {
        index: true,
        follow: true,
      },
  verification: {
    other: {
      "facebook-domain-verification": metaDomainVerification,
    },
  },
  openGraph: {
    title: "DocketStamp | Official Document & Certified Mail Dispatch Registry",
    description:
      "Formal legal notice preparation and physical USPS First-Class & Certified Mail dispatch registry. State-specific statutory notices drafted and dispatched in 60 seconds.",
    url: appUrl,
    siteName: "DocketStamp",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DocketStamp - Official Document & Certified Mail Dispatch Registry",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DocketStamp | Official Document & Certified Mail Dispatch Registry",
    description:
      "Formal legal notice preparation and physical USPS First-Class & Certified Mail dispatch registry. State-specific statutory notices drafted and dispatched in 60 seconds.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Schema.org Semantic Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "Official Document & Certified Mail Dispatch Registry",
              description:
                "State-specific statutory notices and formal legal letters dispatched via physical USPS First-Class, Certified Mail, and Certified Mail with Electronic Return Receipt.",
              brand: {
                "@type": "Brand",
                name: "DocketStamp",
              },
              offers: [
                {
                  "@type": "Offer",
                  name: "Standard First-Class Dispatch",
                  price: "12.95",
                  priceCurrency: "USD",
                },
                {
                  "@type": "Offer",
                  name: "USPS Certified Mail® Dispatch",
                  price: "19.95",
                  priceCurrency: "USD",
                },
                {
                  "@type": "Offer",
                  name: "USPS Certified Mail® + Electronic Return Receipt",
                  price: "27.95",
                  priceCurrency: "USD",
                },
              ],
            }),
          }}
        />
        {/* Google tag (gtag.js) */}
        {GOOGLE_TAG_ID || GOOGLE_ADS_ID ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID || GOOGLE_ADS_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  ${GOOGLE_TAG_ID ? `gtag('config', '${GOOGLE_TAG_ID}');` : ""}
                  ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
                  ${GA4_MEASUREMENT_ID ? `gtag('config', '${GA4_MEASUREMENT_ID}', { send_page_view: true });` : ""}
                `,
              }}
            />
          </>
        ) : null}
        {/* Meta Pixel Code */}
        {META_PIXEL_ID ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                  fbq('init', '${META_PIXEL_ID}');
                  fbq('track', 'PageView');
                `,
              }}
            />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        ) : null}
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
        <AuthProvider>
          <AttributionTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
