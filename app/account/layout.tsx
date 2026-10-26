import type { Metadata } from "next";
import { privatePageMetadata } from "@/src/lib/docket/share-metadata";

export const metadata: Metadata = privatePageMetadata(
  "Account",
  "Manage your DocketStamp account information.",
);

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
