# 用户个人主页与管理员空间：接口规范与使用准则

本文是 Web H5 用户个人主页与管理员空间的联调契约。页面、接口、角色权限和运行数据应一起发布；只部署前端会导致资料编辑、审核、统计等操作不可用。

## 1. 功能与页面入口

| 模块 | Web 路由 | 访问条件 | 主要能力 |
| --- | --- | --- | --- |
| 用户个人主页 | `/#/myCheckins` | 已登录用户 | 基本资料、打卡与图鉴进度、积分、徽章、成就、投稿状态、ISETI、意见反馈 |
| 用户个人主页兼容入口 | `/#/profile` | 已登录用户 | 自动重定向到 `/#/myCheckins` |
| 管理员空间 | `/#/admin` | `admin` 或 `owner` | 审核、异常记录、地点与积分、数据统计 |
| 旧管理员入口 | `/#/admin/review`、`/#/admin/submissions` | `admin` 或 `owner` | 自动重定向到管理员空间内对应工作区 |

两套页面在路由、导航和视觉语义上完全隔离。普通用户访问 `/#/admin` 时会进入管理员专用登录页；登录后的角色仍由后端 `/auth/me` 判定，不信任浏览器缓存中的角色字段。

页面按移动端优先设计，支持 320px 及以上视口；桌面宽屏只增加可用空间，不改变操作顺序。

## 2. API 基础约定

### 2.1 Base URL

- 本地直连：`http://localhost:3000`
- 本地 Web 默认：`/api`，由 Vite 代理到后端
- 生产 Web：建议设置 `VITE_API_BASE=/api`，由 Nginx 反向代理
- 后端同时兼容带 `/api` 和不带 `/api` 的路径，例如 `/api/auth/me` 与 `/auth/me`

下文只写不带 `/api` 的业务路径。

### 2.2 认证

受保护接口必须携带 JWT：

```http
Authorization: Bearer <token>
Accept: application/json
Content-Type: application/json
```

登录成功返回的 `token` 有效期为 7 天。后端为兼容旧客户端，也能读取 `x-auth-token`、`x-token` 和名为 `token` 的 Cookie；新代码必须使用标准 Bearer Header。查询参数 `?token=` 仅供本地调试，生产环境禁止使用，以免令牌进入日志和浏览器历史。

### 2.3 响应与错误

JSON 成功响应统一包含 `code: 0`：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {}
}
```

为保持现有客户端兼容，列表接口通常将 `list` 放在顶层。调用方应同时检查 HTTP 状态和 `code`，不要只检查其中一个。

```json
{
  "code": 1,
  "errorCode": "PROFILE_INVALID",
  "field": "studentId",
  "message": "学号格式不正确"
}
```

| HTTP 状态 | 含义 | 客户端处理 |
| --- | --- | --- |
| `200` / `201` | 请求完成 | 继续检查 `code === 0` |
| `400` | 字段、状态或业务规则不合法 | 在对应字段附近显示 `message`；不要自动重试 |
| `401` | 未登录、令牌过期或用户不存在 | 清除本地登录信息并跳转登录页 |
| `403` | 已登录但角色无权访问 | 普通页面提示权限不足；管理员入口切换账号 |
| `404` | 目标用户、地点或作品不存在 | 刷新列表，避免继续操作旧记录 |
| `503` | JSON 存储暂时不可用 | 保留用户输入并允许手动重试 |

时间字段主要为 Unix 毫秒时间戳；历史 `checkinRecords.time` 可能是 ISO 8601 字符串。客户端必须兼容两种格式。

## 3. 角色与权限

| 角色 | 来源 | 个人主页 | 审核与统计 | 分配管理员 |
| --- | --- | --- | --- | --- |
| `visitor` | 普通注册用户默认角色 | 是 | 否 | 否 |
| `admin` | `owner` 在管理员空间授予 | 是 | 是 | 否 |
| `owner` | 用户数据中的 `owner`，或服务端环境变量命中 | 是 | 是 | 是 |

生产环境至少应配置一名受保护的超级管理员：

```dotenv
ADMIN_OWNER_IDS=1723017600000
# 或按账号名配置，多项用英文逗号分隔
ADMIN_OWNER_USERNAMES=campus-owner,backup-owner
```

使用准则：

1. `owner` 是权限恢复入口，不能在页面中修改自己，也不能降级其他受保护的 `owner`。
2. `admin` 是审核员，可处理照片、投稿、异常和地点设置，但不能授予或撤销角色。
3. `ADMIN_OWNER_IDS` 比账号名稳定；账号允许修改昵称时优先使用 ID。
4. 角色变更必须调用后端接口；禁止只改 `localStorage.userInfo.role`。
5. 生产环境禁止开启 `DEV_BYPASS_AUTH`。

## 4. 会话与公共依赖接口

### `POST /auth/login`

严格登录，不会自动注册。

```json
{
  "username": "campus-owner",
  "password": "<password>"
}
```

成功返回：

```json
{
  "code": 0,
  "token": "<jwt>",
  "userInfo": {
    "id": 1723017600000,
    "username": "campus-owner",
    "avatar": "https://...",
    "phone": "",
    "realName": "",
    "studentId": "",
    "bio": "",
    "personality": null,
    "role": "owner"
  }
}
```

已知业务错误码：`1001` 账号不存在、`1002` 密码错误。新客户端应优先使用本接口；`POST /login_or_register` 仅作为旧端兼容入口。

### `GET /auth/me`

返回个人主页的权威账户快照。除登录响应中的资料字段外，还包括：

- `points`
- `unlockedLocations`
- `lockingLocations`
- `completedRoutes`
- `checkinRecords`
- `createdAt`、`updatedAt`

管理员路由守卫也使用本接口重新确认 `role`。

### `GET /locations`

公开接口。返回基础地点数据与管理员覆盖设置合并后的结果：

```json
{
  "code": 0,
  "data": {
    "locations": [
      {
        "id": 1,
        "name": "何尔达屋",
        "position": "南校园",
        "description": "...",
        "image": "https://...",
        "points": 1
      }
    ]
  }
}
```

## 5. 用户个人主页接口

### 5.1 首页聚合读取

个人主页并行请求以下接口：

| 方法与路径 | 用途 | 关键响应字段 |
| --- | --- | --- |
| `GET /auth/me` | 资料、积分、打卡记录、路线、ISETI | `userInfo` |
| `GET /checkin/status` | 最新图鉴审核状态 | `unlockedLocations`、`lockingLocations` |
| `GET /submissions/mine` | 当前用户全部投稿 | `list[]`，含 `status`、`featured`、`reviewNote` 等 |
| `GET /feedback/mine` | 当前用户反馈历史 | `list[]` |

任一辅助接口失败时，页面保留其他已成功模块，并显示局部提示；`/auth/me` 返回 `401` 时才退出登录。

### 5.2 `PUT /user/profile`

局部更新个人资料。只发送发生变化的字段，至少发送一个字段。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `username` | string | 2–24 个字符；全局不能重名 |
| `realName` | string | 最多 30 个字符；可为空 |
| `studentId` | string | 可为空；否则为 6–24 位字母、数字、`_` 或 `-`；全局不能重复 |
| `phone` | string | 可为空；5–30 位数字、空格及常用电话符号 |
| `bio` | string | 最多 160 个字符 |
| `avatar` | string | 可为空；否则必须为长度不超过 500 的 HTTP(S) URL |

```json
{
  "username": "逸仙同学",
  "studentId": "23300001",
  "bio": "正在收集康乐园的建筑与故事。"
}
```

成功响应位于 `data.userInfo`。字段错误可能带 `field`；重名错误码为 `USERNAME_TAKEN` 或 `STUDENT_ID_TAKEN`。更新头像 URL 时，后端会清除旧的 `avatarKey`，避免旧 COS 图片覆盖新地址。

### 5.3 `PUT /user/personality`

保存 ISETI（PLACE@SYSU）结果。测试页完成后调用，个人主页从 `/auth/me` 读取。

```json
{
  "mainCode": "GROW",
  "subCode": "WIKI",
  "badges": ["aiVerifier", "photoKeeper"],
  "placeId": 12,
  "placeName": "图书馆",
  "line": "从校园故事继续向前。",
  "task": "找到一个年份并记录下来。"
}
```

主类型枚举：`GROW`、`SIDE`、`DONE`、`DDL`、`HOST`、`SYNC`、`TRY`、`PING`。

副类型枚举：`TREE`、`MAPS`、`RUN`、`LENS`、`WIKI`、`BASE`。

徽章枚举：`ddlIgniter`、`groupStarter`、`fixedSeat`、`mealCaller`、`aiVerifier`、`detour`、`photoKeeper`，去重后最多保存 3 个。`placeId` 必须是正整数。客户端不得自行拼造人格名称；名称由后端按枚举生成。

成功响应位于 `data.personality`，并包含固定的 `testId: "PLACE_AT_SYSU"` 和 `version: 1`。

### 5.4 `POST /feedback`

提交意见反馈。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `category` | string | `suggestion`、`bug`、`content`、`other` 之一 |
| `content` | string | 5–1000 个字符 |
| `contact` | string | 可为空；最多 100 个字符 |

成功时返回 HTTP `201`，新记录位于 `data.feedback`，初始 `status` 为 `submitted`。

### 5.5 `GET /feedback/mine`

只返回令牌所属用户的反馈，按创建时间倒序排列。响应为 `{ "code": 0, "list": [...] }`。前端不得通过用户 ID 查询他人的反馈。

## 6. 管理员空间接口

本节所有接口均要求 `admin` 或 `owner`。角色管理接口额外要求 `owner`。

### 6.1 总览与统计

| 方法与路径 | 参数 | 响应 |
| --- | --- | --- |
| `GET /admin/dashboard` | 无 | `data.currentAdmin`、`metrics`、近 7 日 `activity`、`hotspots`、`anomalyPreview` |
| `GET /admin/anomalies` | `type=all\|distance\|duplicate\|unknown_location\|stale_pending` | `list` 与严重度统计 `stat` |

`metrics` 包括 `pendingTotal`、`pendingCheckins`、`pendingSubmissions`、`userCount`、`submissionCount`、`checkinCount`、`anomalyCount`、`featuredCount`。

异常是根据现有记录实时派生的审计信号，不会修改用户数据：

- `distance`：定位距离超过 `CHECKIN_ANOMALY_DISTANCE_M`
- `duplicate`：同一用户同日同地点出现多条成功打卡
- `unknown_location`：记录引用不存在的地点 ID
- `stale_pending`：待审核时间超过 `CHECKIN_PENDING_STALE_HOURS`

### 6.2 用户与角色

| 方法与路径 | 权限 | 请求/响应 |
| --- | --- | --- |
| `GET /admin/users` | `admin`、`owner` | 返回 `list` 及 `canManageRoles` |
| `PATCH /admin/users/:id/role` | 仅 `owner` | Body：`{ "role": "visitor" }` 或 `{ "role": "admin" }` |

不能修改自己的权限，不能修改受环境变量或持久化 `owner` 角色保护的账号。角色更新后，被修改用户下一次访问管理员接口时立即按新角色校验。

### 6.3 打卡点内容与积分

| 方法与路径 | 请求/响应 |
| --- | --- |
| `GET /admin/locations?query=<keyword>` | 搜索并返回合并后的地点列表和 `total` |
| `PATCH /admin/locations/:id` | 局部更新地点；结果位于 `data.location` |

允许更新的字段：

| 字段 | 规则 |
| --- | --- |
| `name` | 1–80 个字符 |
| `position` | 最多 120 个字符 |
| `description` | 最多 20000 个字符；服务端移除危险脚本、内联事件和 `javascript:` |
| `image` | 可为空；否则为最多 2000 字符的 HTTP(S) URL |
| `points` | 0–100 的整数 |

地点变更以覆盖层写入 `LOCATION_SETTINGS_FILE`，不会改写基础地点数据。积分调整只影响以后首次通过的该地点打卡，不追溯重算历史积分。

### 6.4 照片打卡审核

| 方法与路径 | 请求/响应 |
| --- | --- |
| `GET /admin/checkins?status=pending\|approved\|all` | 返回审核列表和完整队列统计 `stat` |
| `POST /admin/checkins/:id/approve` | 可选 Body：`{ "note": "照片可清楚识别建筑。" }` |
| `POST /admin/checkins/:id/reject` | Body：`{ "note": "照片无法识别建筑特征。" }` |

`:id` 是 `userId_locationId` 组合键，也兼容 `userId:locationId`。客户端必须对整个 ID 使用 URL 编码。

审核通过规则：

1. 从 `lockingLocations` 移除并加入 `unlockedLocations`。
2. 只有首次解锁才发放该地点当前积分并写入 `checkinRecords`。
3. 若本次解锁完成路线，继续发放现有路线奖励。
4. 重复调用不会重复发放地点积分。
5. 返回 `pointsAwarded`、`newlyUnlocked`、`newlyCompletedRoutes` 和更新后的积分/图鉴状态。

审核驳回会移除待审核项并写入最近 100 条 `checkinReviewRecords`。虽然兼容接口允许空备注，产品端必须要求填写清晰理由，建议至少 4 个字符。

### 6.5 投稿审核

| 方法与路径 | 参数或 Body | 状态规则 |
| --- | --- | --- |
| `GET /admin/submissions` | `status=all\|pending\|approved\|rejected\|featured`；`category=all\|creative\|photography` | 返回 `list`、总统计和按类别统计 |
| `GET /admin/submissions/stats` | 无 | 只返回 `stat` |
| `POST /admin/submissions/:id/approve` | 可选 `{ "note": "..." }` | 待审核或待处理申诉 → 已通过 |
| `POST /admin/submissions/:id/reject` | 必填 `{ "note": "..." }` | 待审核或待处理申诉 → 未通过 |
| `POST /admin/submissions/:id/feature` | `{ "featured": true }` | 仅已通过作品可标记/取消优秀 |
| `POST /admin/submissions/:id/down` | 无 | 已通过 → 已下架 |
| `POST /admin/submissions/:id/restore` | 无 | 已下架 → 已通过 |
| `POST /admin/submissions/compute-winners` | 无 | 按当前票数刷新获奖名单 |
| `GET /admin/submissions/export` | `category=all\|creative\|photography` | 下载 CSV；已处理公式注入风险 |

审核动作应在按钮提交期间禁用重复操作；成功后重新拉取列表和总览，不要只在前端猜测统计变化。优秀标记不是独立审核状态，必须与 `status: "approved"` 同时满足。

## 7. 前端调用与交互准则

1. 所有写操作在请求完成前禁用提交按钮，失败时保留表单或审核备注。
2. `401` 统一清理 `token` 和 `userInfo`；`403` 不应清除有效的普通用户会话。
3. 个人主页优先显示服务端数据。本机旧版 ISETI 结果只在服务端没有结果时自动同步一次。
4. 用户资料采用局部更新；避免把未加载的空字段覆盖到服务器。
5. 列表操作使用后端返回的稳定 `id`，不要使用数组下标。
6. 所有用户生成文本按纯文本渲染；地点介绍即使经过服务端过滤，也应使用受控渲染方式。
7. 管理员页面进入和每次受保护 API 调用都必须依赖服务端权限，不把隐藏按钮当作安全边界。
8. 移动端操作目标保持至少 44px，弹窗需支持触屏滚动、关闭和错误聚焦。

## 8. 运行数据与环境配置

本功能新增或使用以下持久化文件：

| 环境变量 | 默认位置 | 内容 |
| --- | --- | --- |
| `USERS_FILE` | `services/weapp-auth-server/users.json` | 账户、资料、角色、积分、ISETI、打卡状态 |
| `FEEDBACK_FILE` | `services/weapp-auth-server/feedback.json` | 用户反馈 |
| `LOCATION_SETTINGS_FILE` | `services/weapp-auth-server/location-settings.json` | 地点内容与积分覆盖设置 |
| `SUBMISSIONS_FILE` | `services/weapp-auth-server/submissions.json` | 投稿与审核状态 |

这些都是运行数据，已被 `.gitignore` 排除，不能提交到 PR。生产部署应将文件放在版本发布目录之外的持久化卷并定期备份；多实例或高并发部署应迁移到数据库，避免多个进程并发写 JSON。

最小生产配置示例：

```dotenv
PORT=3000
JWT_SECRET=<至少 32 字节的随机字符串>
USERS_FILE=/srv/campus-atlas-data/users.json
FEEDBACK_FILE=/srv/campus-atlas-data/feedback.json
LOCATION_SETTINGS_FILE=/srv/campus-atlas-data/location-settings.json
SUBMISSIONS_FILE=/srv/campus-atlas-data/submissions.json
ADMIN_OWNER_IDS=<稳定的用户 ID>
CHECKIN_ANOMALY_DISTANCE_M=200
CHECKIN_PENDING_STALE_HOURS=48
```

COS 图片审核还需要正确配置 `COS_BUCKET`、`COS_REGION`、`PUBLIC_ASSET_DOMAIN` 与腾讯云凭据。真实密钥只能放在服务器环境变量或密钥管理服务中。

## 9. 发布与验收

代码合并到 GitHub 不会自动同步到 `hiwebsun.top`，除非仓库已经配置自动部署。一次完整发布必须同时完成：

1. 合并 PR，并在目标服务器拉取合并后的提交。
2. 在 `apps/web-h5` 设置 `VITE_API_BASE=/api` 后执行 `npm install && npm run build`，替换站点静态文件。
3. 更新 `services/weapp-auth-server`，安装依赖并重启 Node 服务。
4. 确认生产 `.env` 包含 owner、持久化文件和 COS 配置；不要用示例值覆盖现有密钥。
5. 执行 `nginx -t` 后再平滑重载 Nginx。

合并或上线前至少运行：

```bash
cd apps/web-h5
npm run build

cd ../../services/weapp-auth-server
npm test
```

人工验收清单：

- 普通用户能打开个人主页并编辑资料、查看进度/投稿/ISETI、提交反馈。
- 普通用户访问管理员入口会进入管理员登录页，不能读取任一 `/admin/*` 接口。
- `admin` 能处理照片与投稿、查看异常、编辑地点和查看统计，但看不到可用的角色修改操作。
- `owner` 能授予和撤销 `admin`，但不能修改自己或受保护 owner。
- 审核通过只发放一次积分；驳回理由、投稿优秀状态和地点设置刷新后仍存在。
- 320px、390px 和桌面视口下无横向溢出，所有主要操作可触达。
