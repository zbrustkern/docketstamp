import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://docketstamp.com";
  const isStaging =
    process.env.ENVIRONMENT === "staging" ||
    appUrl.includes("staging") ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.includes("staging");

  if (isStaging) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin", "/api/cron"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
