import type { Metadata } from "next";

const DEFAULT_ORIGIN = "https://docketstamp.com";
export const HOME_SHARE_TITLE = "Make it formal. We’ll print and mail it.";
export const HOME_SHARE_DESCRIPTION =
  "Prepare and review a formal letter online. We print and mail it by USPS, with Certified Mail available. Self-help preparation; not a law firm.";

export interface ShareImage {
  path: string;
  width: number;
  height: number;
  alt: string;
}

export const SHARE_IMAGES = {
  home: {
    path: "/share/v1/home.png",
    width: 1200,
    height: 630,
    alt: "DocketStamp helps people prepare, review, print, and mail formal letters.",
  },
  square: {
    path: "/share/v1/square.png",
    width: 1080,
    height: 1080,
    alt: "DocketStamp formal letter preparation and USPS mailing service.",
  },
} satisfies Record<string, ShareImage>;

const NOTICE_IMAGE_ALTS: Record<string, string> = {
  "tenant-notice-of-intent-to-vacate": "Prepare and mail a formal move-out notice with DocketStamp.",
  "security-deposit-accounting-request": "Prepare and mail a written security deposit request with DocketStamp.",
  "tenant-repair-and-maintenance-notice": "Prepare and mail a written repair request with DocketStamp.",
  "credit-report-dispute-request": "Prepare and mail a written credit-report dispute with DocketStamp.",
  "debt-dispute-information-request": "Prepare and mail a written request about a disputed debt with DocketStamp.",
  "service-cancellation-request": "Prepare and mail a written service cancellation request with DocketStamp.",
  "product-complaint-refund-request": "Prepare and mail a written product complaint or refund request with DocketStamp.",
  "arbitration-opt-out-procedure-request": "Prepare and mail a written request about an arbitration opt-out procedure with DocketStamp.",
  "personal-data-deletion-request": "Prepare and mail a written personal data request with DocketStamp.",
};

export function getPublicOrigin(configuredOrigin = process.env.NEXT_PUBLIC_APP_URL): string {
  if (!configuredOrigin) return DEFAULT_ORIGIN;

  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return DEFAULT_ORIGIN;
    return parsed.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export function absolutePublicUrl(path: string, origin = getPublicOrigin()): string {
  return new URL(path.replace(/^\//, ""), `${origin.replace(/\/$/, "")}/`).toString();
}

function imageMetadata(image: ShareImage) {
  const url = absolutePublicUrl(image.path);
  return {
    openGraph: {
      url,
      width: image.width,
      height: image.height,
      alt: image.alt,
      type: "image/png",
    },
    twitter: { url, alt: image.alt },
  };
}

export function publicShareMetadata(options: {
  title: string;
  description: string;
  path: string;
  image?: ShareImage;
}): Metadata {
  const image = options.image ?? SHARE_IMAGES.home;
  const canonical = absolutePublicUrl(options.path);
  const socialImage = imageMetadata(image);
  const fullTitle = options.title.endsWith(" | DocketStamp")
    ? options.title
    : `${options.title} | DocketStamp`;

  return {
    title: { absolute: fullTitle },
    description: options.description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description: options.description,
      url: canonical,
      siteName: "DocketStamp",
      locale: "en_US",
      type: "website",
      images: [socialImage.openGraph],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
      images: [socialImage.twitter],
    },
  };
}

export function noticeShareImage(canonicalSlug: string): ShareImage {
  const alt = NOTICE_IMAGE_ALTS[canonicalSlug];
  if (!alt) return SHARE_IMAGES.home;
  return {
    path: `/share/v1/${canonicalSlug}.png`,
    width: 1200,
    height: 630,
    alt,
  };
}

export function privatePageMetadata(title: string, description: string): Metadata {
  const fullTitle = title.endsWith(" | DocketStamp") ? title : `${title} | DocketStamp`;
  const socialImage = imageMetadata(SHARE_IMAGES.home);
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: null },
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title: fullTitle,
      description,
      siteName: "DocketStamp",
      locale: "en_US",
      type: "website",
      images: [socialImage.openGraph],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [socialImage.twitter],
    },
  };
}
