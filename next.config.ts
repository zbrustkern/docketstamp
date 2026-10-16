import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/preview",
        destination: "/",
        permanent: false,
      },
      {
        source: "/refund-policy",
        destination: "/return-policy",
        permanent: true,
      },
      {
        source: "/refunds",
        destination: "/return-policy",
        permanent: true,
      },
      {
        source: "/returns",
        destination: "/return-policy",
        permanent: true,
      },
    ];
  },
  async headers() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const isStaging =
      process.env.ENVIRONMENT === "staging" ||
      appUrl.includes("staging") ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.includes("staging");

    if (isStaging) {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Robots-Tag",
              value: "noindex, nofollow, noarchive",
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
