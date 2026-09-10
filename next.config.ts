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
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        source: "/register",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
