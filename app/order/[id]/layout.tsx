import type { Metadata } from "next";
import { privatePageMetadata } from "@/src/lib/docket/share-metadata";

export const metadata: Metadata = privatePageMetadata(
  "Order Tracker",
  "View your order and any postal status information available.",
);

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
