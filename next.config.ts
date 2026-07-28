import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产部署:产出 .next/standalone(自包含 node server,配合 deploy/ecosystem.config.cjs 由 PM2 托管)
  output: "standalone",
  // 服务器上与既有站点共用 80 端口时,通过 NEXT_BASE_PATH=/pharma 挂载到子路径;
  // 本地开发不设置该变量,保持根路径。
  basePath: process.env.NEXT_BASE_PATH || "",
};

export default nextConfig;
