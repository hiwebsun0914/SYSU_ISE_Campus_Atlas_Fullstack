# Web 图鉴功能下线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 下线 Web H5 独立图鉴功能，把用户入口与文案迁移到校园地图/校园探索，同时保持地图和 COS 数据链路不变。

**Architecture:** 删除 `/atlas` 路由和独立 `Index.vue`，由现有通配路由为旧地址返回 404；其余页面按语义跳转首页或 `/map`。地图继续读取 `campusPlaces.js` 中的 `Position/` 图片，定位打卡与隐藏地点拍照打卡继续使用现有共享模块和后端接口。

**Tech Stack:** Vue 3、Vue Router 4、Vite 6、Express、腾讯云 COS、Codex 应用内浏览器。

## Global Constraints

- 范围仅限 Web H5；不修改 Android 或微信小程序。
- `/atlas` 不重定向，必须显示现有 404。
- 功能名称使用“校园地图”，产品/活动品牌使用“校园探索”，完成度使用“探索进度”。
- 不修改 `campusPlaces.js`、`locationMap.js`、`userProgress.js`、`checkinFlow.js` 的运行逻辑。
- 不修改后端 COS 配置、Bucket、域名、STS 策略、`Position/` 或 `checkin/` 前缀。
- 不修改 `/locations`、`/checkin/map`、`/checkin/presign`、`/checkin/commit` 或 `/checkin/photo/*` 接口。
- 保留 `docs/BEGINNER_DEVELOPMENT_GUIDE.md` 原样且不纳入提交。

## File Structure

- Delete: `apps/web-h5/src/pages/Index.vue` — 已下线的独立图鉴页面。
- Modify: `apps/web-h5/src/router/index.ts` — 移除 `/atlas` 业务路由，保留通配 404。
- Modify: `apps/web-h5/src/pages/Home.vue` — 删除图鉴导航，四列移动导航，更新活动文案和图标导入。
- Modify: `apps/web-h5/src/pages/myCheckins.vue` — 地点浏览入口改为 `/map`，图鉴品牌/进度文案改为探索语境。
- Modify: `apps/web-h5/src/pages/PlaceTest.vue` — 返回目标改为 `/`，图鉴品牌文案改为校园探索。
- Modify: `apps/web-h5/src/pages/futureCard.vue` — 返回和页面标题改为校园探索。
- Modify: `apps/web-h5/src/pages/admin/AdminHome.vue` — 管理端可见文案改为地图/校园探索。
- Modify: `apps/web-h5/src/pages/connect.vue` — 团队名称改为校园探索开发团队。
- Modify: `apps/web-h5/src/utils/checkinFlow.js` — 仅把过时的 `/atlas` 注释改为“共享拍照打卡流程”，不改代码。
- Modify: `apps/web-h5/src/pages/HiddenCheckpointDetail.vue` — 仅更新过时注释，不改共享上传调用。

---

### Task 1: 建立用户行为失败基线

**Files:**
- Inspect: `apps/web-h5/src/pages/Home.vue`
- Inspect: `apps/web-h5/src/router/index.ts`
- Inspect: `apps/web-h5/src/data/campusPlaces.js`
- Inspect: `apps/web-h5/src/pages/HiddenCheckpointDetail.vue`

**Interfaces:**
- Consumes: 当前运行中的 Vite 页面 `http://localhost:8080/`。
- Produces: 可重复的 RED 证据，证明图鉴入口和 `/atlas` 页面目前仍存在，并记录地图/COS 保护基线。

- [ ] **Step 1: 在应用内浏览器记录首页 RED 基线**

运行浏览器只读检查：

```js
const links = Array.from(document.querySelectorAll('a')).map(a => ({
  text: (a.textContent || '').trim(),
  href: a.getAttribute('href'),
}))
({
  atlasLinks: links.filter(x => x.href === '#/atlas' || x.href === '/atlas'),
  mobileItems: document.querySelectorAll('.mobile-nav > *').length,
})
```

Expected RED: `atlasLinks.length > 0` 且 `mobileItems === 5`。

- [ ] **Step 2: 在应用内浏览器记录旧路由 RED 基线**

打开 `http://localhost:8080/#/atlas` 并读取页面正文前 200 字。

Expected RED: 页面显示“欢迎参加校园打卡活动”等图鉴内容，而不是 `404`。

- [ ] **Step 3: 记录地图/COS 保护基线**

运行：

```bash
rg -n "Position/" apps/web-h5/src/data/campusPlaces.js
rg -n "request\('/checkin/map'" apps/web-h5/src/stores/userProgress.js
rg -n "checkinFlow" apps/web-h5/src/pages/HiddenCheckpointDetail.vue
rg -n "checkin/\$\{uid\}|checkin/<uid>" services/weapp-auth-server/routes/checkin.js
```

Expected: `campusPlaces.js` 有 101 个 `Position/` 图片引用；`userProgress.js` 调用 `/checkin/map`；隐藏地点引用 `checkinFlow`；后端保留 `checkin/` 用户路径。

### Task 2: 下线独立图鉴入口和路由

**Files:**
- Modify: `apps/web-h5/src/pages/Home.vue:12-18,186-192,224-230,464`
- Modify: `apps/web-h5/src/router/index.ts:7-11`
- Delete: `apps/web-h5/src/pages/Index.vue`

**Interfaces:**
- Consumes: Vue Router 的现有通配路由 `/:pathMatch(.*)*`。
- Produces: 四项首页导航、`/map` 唯一地点浏览入口、`/atlas` 404。

- [ ] **Step 1: 重跑 Task 1 的浏览器检查并确认仍为 RED**

Expected: 首页仍有 `/atlas`，移动导航仍为 5 项，旧路由仍加载图鉴。

- [ ] **Step 2: 最小修改首页导航**

在 `Home.vue`：

```vue
<nav class="desktop-nav" aria-label="桌面端主要导航">
  <RouterLink to="/" aria-current="page">首页</RouterLink>
  <RouterLink to="/map">校园地图</RouterLink>
  <button type="button" @click="goProtected('/message')">留言互动</button>
  <button type="button" @click="goProtected('/myCheckins')">我的主页</button>
</nav>
```

```vue
<nav class="mobile-nav" aria-label="移动端主要导航">
  <RouterLink to="/" aria-current="page"><House :size="21" aria-hidden="true" /><span>首页</span></RouterLink>
  <RouterLink to="/map"><MapPinned :size="21" aria-hidden="true" /><span>地图</span></RouterLink>
  <button type="button" @click="goProtected('/message')"><MessageCircleMore :size="21" aria-hidden="true" /><span>互动</span></button>
  <button type="button" @click="goProtected('/myCheckins')"><CircleUserRound :size="21" aria-hidden="true" /><span>我的</span></button>
</nav>
```

从 `@lucide/vue` 导入列表删除不再使用的 `Map`，并把 `.mobile-nav` 的 `grid-template-columns` 改为 `repeat(4,1fr)`。

- [ ] **Step 3: 删除业务路由与页面**

从 `router/index.ts` 删除：

```ts
{ path: '/atlas', component: () => import('../pages/Index.vue') },
```

删除 `apps/web-h5/src/pages/Index.vue`。不要修改通配 404。

- [ ] **Step 4: 刷新浏览器验证 GREEN**

Expected: 首页 `atlasLinks.length === 0`、`mobileItems === 4`；`/#/atlas` 正文为 `404`；`/#/map` 能加载“校园地图”。

- [ ] **Step 5: 提交入口与路由下线**

```bash
git add apps/web-h5/src/pages/Home.vue apps/web-h5/src/router/index.ts apps/web-h5/src/pages/Index.vue
git commit -m "refactor(web): remove atlas route and navigation"
```

### Task 3: 迁移跳转与所有 Web 用户文案

**Files:**
- Modify: `apps/web-h5/src/pages/Home.vue`
- Modify: `apps/web-h5/src/pages/myCheckins.vue`
- Modify: `apps/web-h5/src/pages/PlaceTest.vue`
- Modify: `apps/web-h5/src/pages/futureCard.vue`
- Modify: `apps/web-h5/src/pages/admin/AdminHome.vue`
- Modify: `apps/web-h5/src/pages/connect.vue`
- Modify: `apps/web-h5/src/utils/checkinFlow.js`
- Modify: `apps/web-h5/src/pages/HiddenCheckpointDetail.vue`

**Interfaces:**
- Consumes: `/` 首页、`/map` 地图路由和原有 `router.push`。
- Produces: 无 `/atlas` 跳转、无面向用户的“图鉴”文案；共享打卡代码仅更新注释。

- [ ] **Step 1: 写下文案与跳转 RED 检查**

运行：

```bash
rg -n "图鉴|/atlas" apps/web-h5/src --glob '!pages/Index.vue'
```

Expected RED: 命中 `Home.vue`、`myCheckins.vue`、`PlaceTest.vue`、`futureCard.vue`、`AdminHome.vue`、`connect.vue` 以及两处共享流程注释。

- [ ] **Step 2: 迁移个人主页入口和进度文案**

在 `myCheckins.vue` 完成以下精确替换：

- `笃行校园图鉴` → `笃行校园探索`
- `图鉴进度与打卡记录` → `探索进度与打卡记录`
- `打开完整图鉴` → `打开校园地图`
- 该按钮与命令面板的 `router.push('/atlas')` → `router.push('/map')`
- `校园图鉴完成度` → `校园探索完成度`
- `图鉴启程` → `探索启程`
- `图鉴共建者` → `探索共建者`
- 命令项 `校园图鉴` → `校园地图`，提示改为“查看全部地点与解锁状态”，关键词改为“地图 地点 map”
- 页面标题 `个人主页｜笃行校园图鉴` → `个人主页｜笃行校园探索`

内部变量名和 CSS 类（如 `atlasProgress`、`atlas-section`）保持不变，避免无关重构。

- [ ] **Step 3: 迁移人格测试、时光信笺、首页、管理端和反馈页文案**

精确修改：

- `PlaceTest.vue`：三个返回按钮改为“返回校园探索首页”语义，`goHome()` 改为 `router.push('/')`；页脚、分享卡片和响应式伪元素中的“图鉴”改为“校园探索”。
- `futureCard.vue`：`返回图鉴` → `返回首页`；标题品牌改为“笃行校园探索”。
- `Home.vue`：`CAMPUS ATLAS · 校园图鉴` → `CAMPUS EXPLORE · 校园探索`；活动标志 alt 改为“校园探索活动标志”。
- `AdminHome.vue`：`地图、图鉴、投稿` → `地图、探索进度、投稿`；标题品牌改为“笃行校园探索”。
- `connect.vue`：团队名称改为“智工迎新活动组校园探索开发团队”。

- [ ] **Step 4: 更新共享代码中的过时注释，不改运行逻辑**

在 `checkinFlow.js` 和 `HiddenCheckpointDetail.vue` 中，把“与 `/atlas` 一致/复用 `/atlas`”改成“共享拍照打卡流程”。不得改动函数体、请求路径或导出。

- [ ] **Step 5: 验证文案与跳转 GREEN**

运行：

```bash
rg -n "图鉴|/atlas" apps/web-h5/src
```

Expected: 无输出，退出码为 1。随后在浏览器打开首页、个人主页、人格测试和时光信笺，确认可见文案使用“校园探索/校园地图/探索进度”，相关入口分别进入 `/` 或 `/map`。

- [ ] **Step 6: 提交文案与跳转迁移**

```bash
git add apps/web-h5/src/pages/Home.vue apps/web-h5/src/pages/myCheckins.vue apps/web-h5/src/pages/PlaceTest.vue apps/web-h5/src/pages/futureCard.vue apps/web-h5/src/pages/admin/AdminHome.vue apps/web-h5/src/pages/connect.vue apps/web-h5/src/utils/checkinFlow.js apps/web-h5/src/pages/HiddenCheckpointDetail.vue
git commit -m "refactor(web): rename atlas experience to campus explore"
```

### Task 4: COS、地图与构建回归验证

**Files:**
- Verify unchanged: `apps/web-h5/src/data/campusPlaces.js`
- Verify unchanged: `apps/web-h5/src/data/locationMap.js`
- Verify unchanged: `apps/web-h5/src/stores/userProgress.js`
- Verify unchanged logic: `apps/web-h5/src/utils/checkinFlow.js`
- Verify unchanged: `services/weapp-auth-server/routes/checkin.js`

**Interfaces:**
- Consumes: 地图 `Position/` 图片、`/checkin/map`、隐藏地点 `checkinFlow`、后端 `checkin/` 前缀。
- Produces: 删除图鉴未破坏地图或 COS 的证据。

- [ ] **Step 1: 验证共享文件未被误改**

运行：

```bash
git diff 78e2729 -- apps/web-h5/src/data/campusPlaces.js apps/web-h5/src/data/locationMap.js apps/web-h5/src/stores/userProgress.js services/weapp-auth-server/routes/checkin.js
git diff 78e2729 --word-diff=porcelain -- apps/web-h5/src/utils/checkinFlow.js
```

Expected: 第一条无输出；第二条只有注释文字变化，请求路径、函数和导出无变化。

- [ ] **Step 2: 验证静态链路与数量**

运行：

```bash
test "$(rg -c 'Position/' apps/web-h5/src/data/campusPlaces.js)" -eq 101
rg -n "request\('/checkin/map'" apps/web-h5/src/stores/userProgress.js
rg -n "checkinFlow" apps/web-h5/src/pages/HiddenCheckpointDetail.vue
rg -n "checkin/\$\{uid\}|checkin/<uid>" services/weapp-auth-server/routes/checkin.js
```

Expected: 所有命令退出 0；地点图片计数为 101。

- [ ] **Step 3: 运行 Web 构建**

```bash
cd apps/web-h5 && npm run build
```

Expected: Vite 退出 0。既有 Noto Sans 字体路径警告允许存在，但不能新增错误。

- [ ] **Step 4: 运行后端测试**

```bash
cd services/weapp-auth-server && npm test
```

Expected: Node 测试全部通过，失败数为 0。

- [ ] **Step 5: 在浏览器完成地图图片运行时检查**

打开 `http://localhost:8080/#/map`，选择任意地点并检查：

```js
const image = document.querySelector('.checkin-cover-img')
({
  src: image?.currentSrc || image?.src || '',
  loaded: Boolean(image && image.complete && image.naturalWidth > 0),
})
```

Expected: `src` 包含 `/Position/`，`loaded === true`；控制台无新增 error。

- [ ] **Step 6: 完成差异与工作区检查**

```bash
git diff --check
git status --short --branch
git log -3 --oneline
```

Expected: 无未提交的本次代码修改；仅保留用户原有的未跟踪 `docs/BEGINNER_DEVELOPMENT_GUIDE.md`。不推送远端。
