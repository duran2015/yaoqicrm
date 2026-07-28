#!/usr/bin/env bash
# ============================================================================
# pharma-crm 一键部署脚本(在本地执行,把系统部署到远程 Linux 服务器)
#
# 用法:
#   ./deploy/deploy.sh <user@host> [ssh_key路径]
#
# 环境变量(可选):
#   WORKBUDDY_JWT_SECRET  必填;WorkBuddy HS256 JWT 共享密钥(建议:openssl rand -hex 32)
#   UPLOAD_DB=1     显式上传/替换远端 prisma/dev.db(默认不上传,避免误传真实数据)
#   APP_DIR      强制指定远端目标目录(默认 /opt/pharma-crm,无权限时回退 ~/pharma-crm)
#
# 流程:
#   rsync 源码(排除 node_modules/.next/dev.db 等)→ 可选上传 prisma/dev.db
#   → 远端:检查 Node>=20 → npm ci → prisma generate → 可选备份并替换 dev.db
#   → migrate deploy → next build → 拷贝 standalone 静态资源
#   → mcp-server 构建 → pm2 startOrRestart → pm2 save
# ============================================================================
set -euo pipefail

REMOTE="${1:-}"
SSH_KEY="${2:-}"
WORKBUDDY_JWT_SECRET="${WORKBUDDY_JWT_SECRET:-}"
WORKBUDDY_JWT_ISSUER="${WORKBUDDY_JWT_ISSUER:-workbuddy-local}"
WORKBUDDY_JWT_AUDIENCE="${WORKBUDDY_JWT_AUDIENCE:-pharma-crm-mcp}"

if [[ -z "$REMOTE" ]]; then
  echo "用法: $0 <user@host> [ssh_key路径]" >&2
  exit 1
fi
if [[ -z "$WORKBUDDY_JWT_SECRET" ]]; then
  echo "必须设置 WORKBUDDY_JWT_SECRET(建议:WORKBUDDY_JWT_SECRET=\$(openssl rand -hex 32) $0 ...)" >&2
  exit 1
fi

LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

step() { echo; echo "===> $*"; }

# ---------------------------------------------------------------- 1. 确定远端目录
step "1/8 探测远端目标目录"
if [[ -n "${APP_DIR:-}" ]]; then
  TARGET="$APP_DIR"
  ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$TARGET'"
else
  TARGET=$(ssh "${SSH_OPTS[@]}" "$REMOTE" '
    if (mkdir -p /opt/pharma-crm 2>/dev/null || sudo -n mkdir -p /opt/pharma-crm 2>/dev/null); then
      sudo -n chown "$USER" /opt/pharma-crm 2>/dev/null || true
    fi
    if [ -d /opt/pharma-crm ] && [ -w /opt/pharma-crm ]; then
      echo /opt/pharma-crm
    else
      mkdir -p "$HOME/pharma-crm"
      echo "$HOME/pharma-crm"
    fi
  ')
fi
echo "远端目标目录:$TARGET"

# ---------------------------------------------------------------- 2. rsync 源码
step "2/8 rsync 源码到远端(排除 node_modules/.next/dev.db)"
rsync -az --delete -e "$RSYNC_RSH" \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env \
  --exclude "prisma/dev.db*" \
  --exclude "*.log" \
  "$LOCAL_ROOT/" "$REMOTE:$TARGET/"

# ---------------------------------------------------------------- 3. 可选上传 dev.db
if [[ "${UPLOAD_DB:-0}" == "1" ]]; then
  step "3/8 UPLOAD_DB=1:上传数据库 prisma/dev.db"
  rsync -az --progress -e "$RSYNC_RSH" \
    "$LOCAL_ROOT/prisma/dev.db" "$REMOTE:$TARGET/prisma/dev.db.upload"
else
  step "3/8 默认跳过数据库上传(如需替换请显式设置 UPLOAD_DB=1)"
fi

# ---------------------------------------------------------------- 4-8. 远端执行
step "4/8 远端:环境检查 → 依赖 → 构建 → 数据库落位 → PM2 启动"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "TARGET='$TARGET' UPLOAD_DB='${UPLOAD_DB:-0}' WORKBUDDY_JWT_SECRET='$WORKBUDDY_JWT_SECRET' WORKBUDDY_JWT_ISSUER='$WORKBUDDY_JWT_ISSUER' WORKBUDDY_JWT_AUDIENCE='$WORKBUDDY_JWT_AUDIENCE' bash -s" <<'REMOTE_EOF'
set -euo pipefail
cd "$TARGET"
step() { echo; echo "  [remote] ===> $*"; }

# ---- Node >= 20 ----
step "检查 Node.js 版本"
if ! command -v node >/dev/null 2>&1; then
  echo "  未找到 node。请先安装 Node.js 20+,例如:" >&2
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs" >&2
  echo "    # 或: sudo dnf install -y nodejs20 / 使用 nvm 安装 20 LTS" >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "  node 版本过低:$(node -v),需要 >= 20。请参考上面指引升级。" >&2
  exit 1
fi
echo "  node $(node -v) / npm $(npm -v) OK"

export DATABASE_URL="file:$TARGET/prisma/dev.db"

# ---- 主应用依赖与构建 ----
step "npm ci(主应用)"
npm ci --no-audit --no-fund
step "prisma generate"
npx prisma generate

# ---- 数据库落位(先备份再替换,随后再执行迁移)----
if [ "$UPLOAD_DB" = "1" ] && [ -f prisma/dev.db.upload ]; then
  if [ -f prisma/dev.db ]; then
    BAK="prisma/dev.db.bak.$(date +%Y%m%d%H%M%S)"
    step "远端已存在 dev.db,先备份到 $BAK"
    cp prisma/dev.db "$BAK"
  fi
  step "替换 dev.db"
  mv prisma/dev.db.upload prisma/dev.db
else
  step "保留远端数据库(UPLOAD_DB=$UPLOAD_DB)"
fi

step "prisma migrate deploy"
npx prisma migrate deploy
step "next build(standalone,带 basePath 供 nginx 子路径反代)"
NEXT_BASE_PATH="${NEXT_BASE_PATH:-/pharma}" npm run build
step "拷贝 standalone 静态资源(.next/static 与 public 不会自动包含)"
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then rm -rf .next/standalone/public; cp -r public .next/standalone/public; fi

# ---- mcp-server 构建 ----
step "mcp-server: npm ci + build"
cd "$TARGET/mcp-server"
npm ci --no-audit --no-fund
npm run build
cd "$TARGET"

# ---- PM2 ----
step "检查/安装 PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2 || sudo npm i -g pm2
fi
step "pm2 startOrRestart deploy/ecosystem.config.cjs"
pm2 startOrRestart deploy/ecosystem.config.cjs
step "pm2 save"
pm2 save
step "完成。pm2 状态:"
pm2 status
REMOTE_EOF

step "5/8-8/8 远端步骤全部完成"
echo
echo "部署完成 ✅"
echo "  CRM 应用:  http://127.0.0.1:5618(默认仅服务器本机;请通过认证反向代理访问)"
echo "  MCP HTTP:  http://<服务器>:5620/mcp (health: /health)"
