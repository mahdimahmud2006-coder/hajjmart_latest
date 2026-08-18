import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { cpus: 4 },
  outputFileTracingRoot: path.resolve(process.cwd()),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "hajjmart.com.bd" },
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
