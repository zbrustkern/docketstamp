import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin", "/api/cron"],
      },
    ],
    sitemap: "https://docketstamp.com/sitemap.xml",
  };
}
