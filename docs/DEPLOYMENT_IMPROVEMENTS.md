# 部署与运维改进清单

> 来源：2026-08-14 生产发布复盘。按优先级排序，✅ 为已完成。

## 1. 前端发布保留上一代资源（防缓存白屏）✅ 工具已备

**问题**：`dist` 整体替换后，浏览器缓存了旧 `index.html` 的用户会请求已删除的旧哈希资源，导致白屏（2026-08-14 18:04 真实发生，已现场修复）。

**对策**：发布时把上一代 `assets` 合并进新目录再切换，旧引用在宽限期内仍然有效。
脚本：`deploy/release-web.sh`，以后前端发布直接运行它即可。
定期清理：确认所有用户缓存自然过期后（约一周），删除 `dist` 里早于上一代的资源，以及 `/www/web-h5/` 下累积的 `dist.replaced-*` 目录。

## 2. 后端 systemd 托管（开机自启 + 崩溃自愈）⏳ 待启用

**问题**：后端目前是裸 `node app.js` 进程（setsid  detached），服务器重启后不会自动拉起；进程崩溃也不会有任何恢复动作。

**对策**：unit 文件已备好 `deploy/weapp-auth-server.service`。启用步骤（在服务器上执行）：

```bash
cp /root/weapp-auth-server/../deploy/weapp-auth-server.service /etc/systemd/system/weapp-auth-server.service
# 或从仓库里上传该文件后：
systemctl daemon-reload
# 先停掉当前裸进程，再交给 systemd
kill $(ss -tlnp | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
systemctl enable --now weapp-auth-server
systemctl status weapp-auth-server --no-pager
```

启用后日常操作变为：`systemctl restart weapp-auth-server`（重启）、`journalctl -u weapp-auth-server -n 100`（看日志）。

## 3. 后端性能：users.json 同步全量读写 ⏳ 已缓议

**问题**：鉴权中间件和路由对每个请求都 `readFileSync` 整个 `users.json`（且多数接口读两遍），阻塞事件循环，用户量增长后所有人一起变慢（2026-08-14 用户反馈切页卡顿的根因）。

**方案**（当时已确认、留待后续实施）：
1. 加 users 内存缓存层：启动读一次入内存，写操作更新缓存 + 异步落盘；
2. 中期把中间件/路由切到已有的 SQLite 层（`db.js`），淘汰 JSON 文件；
3. 前端个人主页合并重叠接口、加短时效缓存。

注意：实施前先确认服务器进程模型（单进程才可放心用内存缓存）。

## 4. 积分方案调整 ⏳ 待产品确认

现状：普通点 1 分、隐藏点 1.5 分、路线完成一律 +5 分（满分 142.5）。
2026-08-14 提议（未实施）：普通 2 分 / 隐藏 5 分；路线奖励按长度分档（探索西区 +10、军训沿途 +10、中轴线 +15），满分 364、全整数。
涉及文件：`services/weapp-auth-server/lib/locationSettings.js`（默认值）、`services/weapp-auth-server/data/routes.js`（bonus）。注意改默认值不影响已发放的历史积分，且服务器 `location-settings.json` 的覆盖值优先于默认值。

## 5. 运维记录

- 2026-08-14 备份目录：`/root/deploy-backups/campus-atlas-20260814-172703`
- 隐藏点历史积分补分（5 条 +2.5 分）：脚本 `services/weapp-auth-server/backfill-hidden-points-20260814.js`（PR #36 归档）
