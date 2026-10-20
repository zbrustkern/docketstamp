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
    default: "Prepare and Mail Formal Notices | DocketStamp",
    template: "%s | DocketStamp",
  },
  description:
    "Prepare a written notice, review your details, and choose an available USPS mailing service. DocketStamp is a self-help document preparation service, not a law firm.",
  applicationName: "DocketStamp",
  authors: [{ name: "Western Amalgamated" }],
  creator: "Western Amalgamated",
  publisher: "DocketStamp",
  keywords: [
    "certified mail online",
    "formal notice preparation",
    "security deposit demand letter",
    "notice of intent to vacate",
    "fcra dispute letter",
    "fdcpa debt validation letter",
    "usps certified mail service",
    "document preparation service",
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
    title: "Prepare and Mail Formal Notices | DocketStamp",
    description:
      "Prepare a written notice, review your details, and choose an available USPS mailing service. DocketStamp is a self-help document preparation service, not a law firm.",
    url: appUrl,
    siteName: "DocketStamp",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DocketStamp document preparation and mailing service",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prepare and Mail Formal Notices | DocketStamp",
    description:
      "Prepare a written notice, review your details, and choose an available USPS mailing service. DocketStamp is a self-help document preparation service, not a law firm.",
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
              name: "DocketStamp notice preparation and mailing",
              description:
                "Self-help notice preparation with available USPS mailing services. Postal records depend on provider events and the selected service.",
              brand: {
                "@type": "Brand",
                name: "DocketStamp",
              },
              offers: [
                {
                  "@type": "Offer",
                  name: "USPS First-Class Mail",
                  price: "12.95",
                  priceCurrency: "USD",
                },
                {
                  "@type": "Offer",
                  name: "USPS Certified Mail",
                  price: "19.95",
                  priceCurrency: "USD",
                },
                {
                  "@type": "Offer",
                  name: "USPS Certified Mail with Electronic Return Receipt request",
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
