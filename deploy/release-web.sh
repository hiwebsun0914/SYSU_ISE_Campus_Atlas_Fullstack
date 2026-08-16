#!/usr/bin/env bash
# 前端发布脚本（web-h5 → 生产服务器）
# 生产域名：sysuzgxytj.top（2026-08-16 起），旧域名 hiwebsun.top 并列保留。
# 两个域名解析到同一台服务器，SSH 目标沿用 hiwebsun.top 即可。
# 关键实践：切换 dist 前把上一代 assets 合并进新目录，
# 避免浏览器缓存旧 index.html 的用户因旧哈希资源 404 而白屏。
#
# 用法：在仓库根目录执行  bash deploy/release-web.sh
set -euo pipefail

SERVER="root@hiwebsun.top"
WEB_DIR="/www/web-h5"
TS="$(date +%Y%m%d-%H%M%S)"
STAGE_DIR="/root/web-h5-dist-new-${TS}"

cd "$(dirname "$0")/.."

echo "==> 1/4 生产构建（VITE_API_BASE=/api）"
cd apps/web-h5
rm -rf dist
VITE_API_BASE=/api npm run build
cd - > /dev/null

echo "==> 2/4 上传到服务器暂存目录 ${STAGE_DIR}"
ssh "${SERVER}" "mkdir -p ${STAGE_DIR}"
scp -q -r apps/web-h5/dist/. "${SERVER}:${STAGE_DIR}/"

echo "==> 3/4 服务器上合并上一代 assets 并原子切换"
ssh "${SERVER}" "
  set -e
  # 上一代资源并入新目录（不覆盖同名文件）
  cp -an ${WEB_DIR}/dist/assets/. ${STAGE_DIR}/assets/ 2>/dev/null || true
  cd ${WEB_DIR}
  mv dist dist.replaced-${TS}
  cp -a ${STAGE_DIR} dist
  nginx -t
"

echo "==> 4/4 验收"
curl -sf -o /dev/null -w "sysuzgxytj.top 首页状态码: %{http_code}\n" https://sysuzgxytj.top/
curl -sf -o /dev/null -w "hiwebsun.top  首页状态码: %{http_code}\n" https://hiwebsun.top/
echo "完成。旧目录保留在 ${WEB_DIR}/dist.replaced-${TS}，确认稳定后可手动清理。"
