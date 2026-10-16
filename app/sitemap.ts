import { MetadataRoute } from "next";
import { getAllNotices } from "@/src/lib/docket/notices";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://docketstamp.com";
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/return-policy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const noticeRoutes: MetadataRoute.Sitemap = getAllNotices().map((n) => ({
    url: `${baseUrl}/notices/${n.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...noticeRoutes];
}
