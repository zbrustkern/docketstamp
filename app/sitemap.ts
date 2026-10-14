import { MetadataRoute } from "next";
import { getAllNoticeTemplates } from "@/lib/notices/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docketstamp.com";
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

  const noticeRoutes: MetadataRoute.Sitemap = getAllNoticeTemplates().map((n) => ({
    url: `${baseUrl}/notices/${n.id}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...noticeRoutes];
}
