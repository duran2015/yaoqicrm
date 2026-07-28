# pharma-crm 生产部署指南

把 CRM(Next.js 15 + Prisma/SQLite)与 MCP server(HTTP 模式)部署到一台远程 Linux 服务器。
运行数据保存在单个 SQLite 文件 `prisma/dev.db` 中。该文件不会进入 Git,部署脚本默认也不会上传。

## 前置条件

**服务器端:**
- Linux,Node.js **>= 20**(`node -v` 验证;脚本会自动检查,缺失时打印安装指引并退出)
- 能 SSH 登录(`user@host`,推荐配置免密 key)
- PM2 无需预装——脚本会自动 `npm i -g pm2`(可能需要 sudo)
- CRM 默认仅监听 `127.0.0.1:5618`,请通过带认证的 nginx 等反向代理访问
- 如需远程 MCP,开放 **5620** 或配置 nginx 反向代理，并配置 WorkBuddy 用户 JWT

**本地端:**
- 本项目完整工作区
- `rsync`、`ssh` 可用
- 已设置强随机 `WORKBUDDY_JWT_SECRET`

## 一键部署

```bash
# 在项目根目录执行
WORKBUDDY_JWT_SECRET=$(openssl rand -hex 32) ./deploy/deploy.sh user@1.2.3.4
WORKBUDDY_JWT_SECRET=<双方共享密钥> ./deploy/deploy.sh user@1.2.3.4 ~/.ssh/id_rsa

# 可选环境变量:
UPLOAD_DB=1 ./deploy/deploy.sh user@host # 显式上传/替换本地数据库(谨慎使用)
APP_DIR=/srv/crm ./deploy/deploy.sh user@host   # 强制指定远端目录
```

脚本流程:rsync 源码(排除 `node_modules`/`.next`/`dev.db`)→ 可选上传 `prisma/dev.db`
→ 远端检查 Node>=20 → `npm ci` → `prisma generate` → 可选备份并替换 dev.db →
`prisma migrate deploy` → `next build`(standalone)→ 拷贝静态资源 → mcp-server 构建 →
`pm2 startOrRestart deploy/ecosystem.config.cjs` → `pm2 save`。

目标目录默认 `/opt/pharma-crm`;无写权限时自动回退 `~/pharma-crm`。

部署后三个 PM2 进程:

| 进程 | 内容 | 端口 |
|---|---|---|
| `pharma-crm` | Next standalone server(`NODE_ENV=production`,默认仅本机监听) | 5618 |
| `pharma-crm-mcp` | MCP server HTTP 模式(`--http`,`CRM_BASE_URL=http://localhost:5618`) | 5620 |
| `pharma-crm-intelligence` | 每日白名单情报采集任务(02:15) | 无 |

## WorkBuddy 用户 JWT

部署前必须通过环境变量提供强随机 token;未提供时脚本和 PM2 配置都会拒绝启动:

```bash
export WORKBUDDY_JWT_SECRET=$(openssl rand -hex 32)
./deploy/deploy.sh user@host
```

AI 工具侧远程 MCP 配置(URL + Authorization 头):

```json
{
  "mcpServers": {
    "pharma-crm": {
      "url": "http://<服务器IP或域名>:5620/mcp",
      "headers": { "Authorization": "Bearer <WorkBuddy为当前用户签发的短期JWT>" }
    }
  }
}
```

验证:`curl http://<服务器>:5620/health` → `{"ok":true,"tools":30}`

## 销售情报每日采集

`pharma-crm-intelligence` 每天服务器时间 02:15 执行一次白名单采集。它调用本机 CRM API，不在脚本中保存数据库路径或 WorkBuddy JWT。

```bash
npm run intelligence:collect
npx tsx scripts/collect-sales-intelligence.ts --source <source-id>
npx tsx scripts/collect-sales-intelligence.ts --product <product-id>
pm2 logs pharma-crm-intelligence --lines 100
```

搜索补充为可选能力，通过部署环境提供 `INTELLIGENCE_SEARCH_ENDPOINT` 和
`INTELLIGENCE_SEARCH_API_KEY`。未配置时白名单采集仍可运行，搜索来源返回空结果。
密钥不得写入来源 `configJson`、Git 或 PM2 配置文件。

单来源失败会把任务标记为 `PARTIAL`，不会删除历史情报。修复来源配置后可在
CRM 点击“立即采集”或执行指定来源命令。

## 数据备份

**`prisma/dev.db` 就是全部数据**(SQLite 单文件)。备份 = 拷贝文件:

```bash
# 手动备份(服务器上)
cp /opt/pharma-crm/prisma/dev.db /opt/pharma-crm/prisma/dev.db.bak.$(date +%F)

# 可选:crontab 每日备份
0 3 * * * cp /opt/pharma-crm/prisma/dev.db /opt/pharma-crm/backups/dev.db.$(date +\%F).db
```

默认部署保留远端数据库。只有显式设置 `UPLOAD_DB=1` 时才会先备份远端数据库,
再上传、迁移并替换;使用前应确认本地文件不含不应进入目标环境的数据。

## 回滚

```bash
# 1) 数据回滚:恢复备份的 SQLite 文件
cd /opt/pharma-crm
cp prisma/dev.db.bak.<时间戳> prisma/dev.db

# 2) 代码回滚:重新 rsync 旧版本代码,或在服务器上 git checkout 旧提交后:
npm ci && npm run build && cd mcp-server && npm ci && npm run build && cd ..

# 3) 重启
pm2 restart all
```

## 安全提示(重要)

1. **MCP 端口(5620)**:公网可达时**必须**设置强随机 `MCP_AUTH_TOKEN`(所有请求含
   `/health` 都会强制 Bearer 鉴权)。更稳妥的做法是不对公网开放 5620,仅允许
   AI 工具所在网段访问,或走 nginx 反代 + IP 白名单。
2. **CRM 应用(5618)本身没有任何登录鉴权**。生产配置默认绑定 `127.0.0.1`;
   请通过带认证的反向代理访问。只有已配置防火墙或应用鉴权时,才应显式设置
   `CRM_HOST=0.0.0.0` 允许直连。建议:
   - 用 nginx 加 Basic Auth,或
   - 安全组/防火墙只放行公司出口 IP。

   nginx 反代 + Basic Auth 示例:

   ```nginx
   # apt install apache2-utils; htpasswd -c /etc/nginx/.htpasswd crmuser
   server {
     listen 80;
     server_name crm.example.com;

     location / {
       auth_basic "pharma-crm";
       auth_basic_user_file /etc/nginx/.htpasswd;
       proxy_pass http://127.0.0.1:5618;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     }
   }

   # MCP endpoint(可不配 Basic Auth,靠 MCP_AUTH_TOKEN;建议再加 IP 白名单)
   server {
     listen 80;
     server_name mcp.example.com;

     allow 203.0.113.0/24;   # AI 工具出口网段
     deny all;

     location / {
       proxy_pass http://127.0.0.1:5620;
       proxy_set_header Host $host;
       proxy_set_header Authorization $http_authorization;  # 透传 Bearer
     }
   }
   ```

   配了反代后,用安全组封掉 5618/5620 的公网直连即可。

3. **`.env` 不会上传**(rsync 已排除);远端 `DATABASE_URL` 由 deploy.sh / PM2 配置
   注入为绝对路径,不依赖 `.env`。

## 常用运维命令

```bash
pm2 status                    # 进程状态
pm2 logs pharma-crm           # CRM 日志
pm2 logs pharma-crm-mcp       # MCP 日志
pm2 restart all               # 重启
curl localhost:5618/api/employees | head -c 200   # CRM 存活
curl localhost:5620/health -H "Authorization: Bearer $TOKEN"  # MCP 存活
```
