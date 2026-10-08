import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Keep turbopack rooted at game/ (parent repo also has a lockfile)
  turbopack: {
    root: process.cwd(),
  },
  // Allow HMR / assets when opening via WSL IP or localhost
  allowedDevOrigins: ["172.27.1.12", "127.0.0.1", "localhost"],
};

export default nextConfig;
