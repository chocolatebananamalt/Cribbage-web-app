import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          // Tournament workspaces, sign-in pages, and protected previews are
          // operational surfaces, not public search content. A future public
          // results release must deliberately replace this policy only after
          // its audience, privacy, and ACC-publication controls are reviewed.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
