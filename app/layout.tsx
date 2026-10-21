import type { Metadata } from "next";
import { Inter, Merriweather, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AttributionTracker } from "@/components/AttributionTracker";
import { MarketingTags } from "@/components/MarketingTags";

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

const metaDomainVerification = process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DocketStamp | Formal Letter Preparation & USPS Mail",
    template: "%s | DocketStamp",
  },
  description:
    "Prepare and review a formal letter, then send it by USPS First-Class or Certified Mail®. Printing and postage included.",
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
  ...(metaDomainVerification ? { verification: { other: { "facebook-domain-verification": metaDomainVerification } } } : {}),
  openGraph: {
    title: "DocketStamp | Formal Letter Preparation & USPS Mail",
    description:
      "Prepare and review a formal letter, then send it by USPS First-Class or Certified Mail®. Printing and postage included.",
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
    title: "DocketStamp | Formal Letter Preparation & USPS Mail",
    description:
      "Prepare and review a formal letter, then send it by USPS First-Class or Certified Mail®. Printing and postage included.",
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
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
        <AuthProvider>
          <MarketingTags />
          <AttributionTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
