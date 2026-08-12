# Web 图鉴功能下线设计

## 背景与目标

Web H5 的“校园图鉴”与“校园地图”在地点浏览能力上重复。本次变更下线独立图鉴页面，并将用户统一引导到校园地图，同时确保地图、打卡、隐藏打卡点和腾讯云 COS 图片继续正常工作。

成功标准：

- 首页桌面端和移动端不再显示图鉴入口。
- `/#/atlas` 不再匹配业务路由，显示现有 404。
- Web 端面向用户的“图鉴”文案按语境替换为“校园地图”“校园探索”或“探索进度”。
- 地图地点图片、定位打卡、拍照打卡和审核数据不受影响。

## 现状与依赖边界

独立图鉴页面是 `apps/web-h5/src/pages/Index.vue`，由 `/atlas` 路由加载。它读取 `/locations`、`/checkin/status`、`/checkin/photo/latest` 和共享的 `checkinFlow`。

地图页面是 `apps/web-h5/src/pages/Map.vue`，地点数据来自 `campusPlaces.js`，地点图片使用同一 COS Bucket 下的 `Position/` 对象。地图定位打卡通过 `userProgress.js` 调用 `/checkin/map`。

拍照打卡对象使用同一 Bucket 下的 `checkin/<user>/<location>/` 前缀。`checkinFlow.js` 仍被隐藏打卡点使用，因此不能随图鉴页面一起删除。后端 COS 配置、`/locations`、`/checkin/*` 接口、地点数据和用户进度数据均属于共享能力，也必须保留。

## 方案

采用“完整前端下线、共享服务保留”：

1. 从首页桌面端和移动端导航删除 `/atlas` 入口；移动导航从五列调整为四列。
2. 从路由表删除 `/atlas`，并删除不再引用的 `Index.vue`，使旧地址落入现有 404。
3. 清理 Web H5 内所有指向 `/atlas` 的用户入口：
   - 个人主页中的“打开完整图鉴”和命令入口改为校园地图并跳转 `/map`。
   - 校园人格测试中的品牌按钮、退出按钮和结果页返回按钮统一改为“返回校园探索首页”并跳转 `/`；不再跳转 `/atlas`。
4. 按语境替换面向用户的名称：
   - 具体浏览功能使用“校园地图”。
   - 产品、活动或团队名称使用“校园探索”。
   - 完成度、记录和徽章语境使用“探索进度”“探索启程”“探索共建者”等。
5. 不修改以下共享资源：
   - `campusPlaces.js` 及其 `Position/` 图片 URL。
   - `locationMap.js`、`userProgress.js`、`checkinFlow.js`。
   - 后端 COS Bucket、区域、公开域名和 STS 配置。
   - `/locations`、`/checkin/map`、`/checkin/presign`、`/checkin/commit`、`/checkin/photo/*` 等接口。
   - COS 中已有的 `Position/`、`checkin/` 对象。

## 数据流保护

地图浏览继续沿用：

`Map.vue → campusPlaces.js → Position/* 图片`

地图定位打卡继续沿用：

`Map.vue → userProgress.js → POST /checkin/map → 用户进度数据`

隐藏地点拍照打卡继续沿用：

`Hidden Checkpoints → checkinFlow.js → /checkin/presign → COS checkin/* → /checkin/commit`

删除图鉴页面不会改变以上三条链路。

## 404 与导航行为

- `/atlas` 不设置重定向，交由通配路由显示现有 404。
- 首页地图卡片、桌面导航和移动导航均进入 `/map`。
- 校园人格测试的返回操作进入 `/`；个人主页的地点浏览入口进入 `/map`。

## 测试与验收

实施时先增加会失败的回归检查，再进行最小修改。验收包括：

- 首页 DOM 不含 `/atlas` 链接或“图鉴”导航项，移动导航为四项。
- `/atlas` 显示 404；`/map` 正常加载。
- 全仓 Web H5 业务代码中没有残留的 `/atlas` 跳转或面向用户的“图鉴”文案。
- 地图至少一个地点的图片 URL 仍指向 `Position/`，地点卡片图片可加载。
- 地图定位打卡仍调用 `/checkin/map`。
- 隐藏地点仍保留对 `checkinFlow` 的引用，后端 `checkin/` COS 前缀及相关接口未变。
- Web 生产构建成功，后端相关测试通过。

## 非目标

- 不删除或迁移 COS 中的任何对象。
- 不更换 Bucket、域名、目录前缀或访问策略。
- 不重构地图、打卡和审核业务。
- 不修改 Android 或微信小程序客户端；本次范围仅为 Web H5。
