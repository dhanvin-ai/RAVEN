import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://api-ten-iota-10.vercel.app/:path*",
      },
    ];
  },
};

export default nextConfig;
