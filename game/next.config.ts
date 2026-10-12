import type { NextConfig } from "next";

// STATIC_EXPORT=1 → GitHub Pages 静态导出（API 路由由构建脚本临时移出）
const isStatic = process.env.STATIC_EXPORT === "1";
// Pages 项目页部署在 moshenluo.github.io/yaoguaikezhan/ 子路径下
const basePath = isStatic ? "/yaoguaikezhan" : undefined;

const nextConfig: NextConfig = {
  output: isStatic ? "export" : "standalone",
  basePath,
  images: isStatic ? { unoptimized: true } : undefined,
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
