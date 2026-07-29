/**
 * PM2 进程配置:pharma-crm(Next standalone)+ pharma-crm-mcp(MCP HTTP 模式)
 * 用法: pm2 startOrRestart deploy/ecosystem.config.cjs && pm2 save
 *
 * 注意:
 * - ROOT 自动解析为项目根目录(deploy/ 的上一级)
 * - DATABASE_URL 指向绝对路径的 SQLite 文件,与本地 .env 的相对路径无关
 * - WORKBUDDY_JWT_SECRET 必须由部署环境提供,避免把凭据写进仓库
 */
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "prisma", "dev.db");
const WORKBUDDY_JWT_SECRET = process.env.WORKBUDDY_JWT_SECRET;
const WORKBUDDY_JWT_ISSUER = process.env.WORKBUDDY_JWT_ISSUER || "workbuddy-local";
const WORKBUDDY_JWT_AUDIENCE = process.env.WORKBUDDY_JWT_AUDIENCE || "pharma-crm-mcp";
const CRM_HOST = process.env.CRM_HOST || "127.0.0.1";
const MCP_INTERNAL_AUTH_SECRET = process.env.MCP_INTERNAL_AUTH_SECRET;

if (!WORKBUDDY_JWT_SECRET) {
  throw new Error("WORKBUDDY_JWT_SECRET is required (generate one with: openssl rand -hex 32)");
}
if (!MCP_INTERNAL_AUTH_SECRET) throw new Error("MCP_INTERNAL_AUTH_SECRET is required");

module.exports = {
  apps: [
    {
      name: "pharma-crm",
      cwd: ROOT,
      script: path.join(ROOT, ".next", "standalone", "server.js"),
      env: {
        NODE_ENV: "production",
        PORT: 5618,
        HOSTNAME: CRM_HOST,
        DATABASE_URL: `file:${DB_PATH}`,
        AGENT_EVAL_MCP_ENDPOINT: "http://127.0.0.1:5620/mcp",
        AGENT_EVAL_JWT_SECRET: WORKBUDDY_JWT_SECRET,
        AGENT_EVAL_JWT_ISSUER: WORKBUDDY_JWT_ISSUER,
        AGENT_EVAL_JWT_AUDIENCE: WORKBUDDY_JWT_AUDIENCE,
        MCP_INTERNAL_AUTH_SECRET,
        MCP_PUBLIC_URL: process.env.MCP_PUBLIC_URL || "http://47.116.206.152/pharma-mcp",
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "pharma-crm-mcp",
      cwd: path.join(ROOT, "mcp-server"),
      script: path.join(ROOT, "mcp-server", "dist", "index.js"),
      args: "--http",
      env: {
        NODE_ENV: "production",
        MCP_PORT: 5620,
        MCP_HOST: "0.0.0.0",
        CRM_BASE_URL: "http://localhost:5618/pharma",
        WORKBUDDY_JWT_SECRET,
        WORKBUDDY_JWT_ISSUER,
        WORKBUDDY_JWT_AUDIENCE,
        MCP_INTERNAL_AUTH_SECRET,
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "pharma-crm-intelligence",
      cwd: ROOT,
      script: path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
      args: "scripts/collect-sales-intelligence.ts --all",
      cron_restart: "15 2 * * *",
      autorestart: false,
      env: {
        NODE_ENV: "production",
        CRM_BASE_URL: "http://localhost:5618/pharma",
        INTELLIGENCE_SEARCH_ENDPOINT: process.env.INTELLIGENCE_SEARCH_ENDPOINT || "",
        INTELLIGENCE_SEARCH_API_KEY: process.env.INTELLIGENCE_SEARCH_API_KEY || "",
      },
    },
  ],
};
