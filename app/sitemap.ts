import { MetadataRoute } from "next";
import { getAllNotices } from "@/src/lib/docket/notices";
import { getPublicTemplateAvailability } from "@/lib/template-policy-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    {
      url: `${baseUrl}/disclaimer`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  let available = new Set<string>();
  try { available = new Set((await getPublicTemplateAvailability()).templates.filter((entry) => entry.available).map((entry) => entry.slug)); } catch { /* fail closed: no notice URLs */ }
  const noticeRoutes: MetadataRoute.Sitemap = getAllNotices().filter((n) => available.has(n.slug)).map((n) => ({
    url: `${baseUrl}/notices/${n.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...noticeRoutes];
}
