import type { Metadata } from "next";
import { privatePageMetadata } from "@/src/lib/docket/share-metadata";

export const metadata: Metadata = privatePageMetadata(
  "Admin",
  "DocketStamp administration.",
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
