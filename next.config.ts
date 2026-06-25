import type { NextConfig } from "next";

const loadcellApi = process.env.LOADCELL_API_URL ?? "http://127.0.0.1:8081";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/loadcell-api/:path*",
        destination: `${loadcellApi}/:path*`,
      },
    ];
  },
};

export default nextConfig;
