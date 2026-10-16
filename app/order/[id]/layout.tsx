import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Tracker | DocketStamp",
  description: "Track your USPS First-Class or Certified Mail dispatch and postal delivery status.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
