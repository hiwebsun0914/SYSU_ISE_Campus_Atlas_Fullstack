# SYSU ISE Campus Atlas Fullstack

中山大学智能工程学院校园图鉴全栈项目，包含 H5、Android、微信小程序、Node.js 后端，以及服务器当前使用的 Nginx 配置和 H5 部署快照。

项目主要提供校园地点浏览、登录注册、校园打卡、个人打卡记录、排行榜、漂流瓶、头像上传和管理员审核等功能。

## 目录说明

| 目录 | 内容 | 主要技术 |
| --- | --- | --- |
| `apps/web-h5/` | 浏览器端 H5 源码 | Vue 3、Vite |
| `apps/android/` | H5 与 Android 原生工程 | Vue 3、Vite、Capacitor |
| `apps/wechat-miniprogram/` | 微信小程序及云函数 | 微信小程序原生框架 |
| `services/weapp-auth-server/` | 登录、打卡、漂流瓶、管理等 API | Node.js、Express、JWT、腾讯云 COS |
| `deploy/nginx/` | 服务器 `/etc/nginx/` 的配置快照 | Nginx |
| `deploy/web-h5-dist/` | 服务器 `/www/web-h5/dist/` 的部署快照 | 编译后的静态文件 |

大致调用关系如下：

```text
Web H5 / Android / 微信小程序
              │
              ▼
         Nginx（HTTPS）
          │          │
          │          └── H5 静态文件
          ▼
Node.js API（默认 3000 端口）
          │
          ├── 本地 JSON 运行数据
          └── 腾讯云 COS 图片存储
```

## 开始之前

建议先安装：

- Git
- Node.js 22 或更高版本（Android 子项目使用的 Capacitor 8 要求 Node.js 22+）
- npm（随 Node.js 安装）
- 微信开发者工具（运行小程序时需要）
- Android Studio 和 Android SDK（生成 APK 时需要）

克隆仓库：

```bash
git clone https://github.com/hiwebsun0914/SYSU_ISE_Campus_Atlas_Fullstack.git
cd SYSU_ISE_Campus_Atlas_Fullstack
```

## 第一步：启动后端

进入后端目录并安装依赖：

```bash
cd services/weapp-auth-server
npm install
```

复制配置模板：

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

至少要把 `.env` 中的 `JWT_SECRET` 改成一个足够长的随机字符串。头像上传、打卡图片和图片签名功能还需要配置腾讯云 COS；只测试登录和基础接口时可以暂不配置 COS。

启动服务：

```bash
npm start
```

浏览器访问 `http://localhost:3000/health`。看到包含 `"ok": true` 的 JSON，表示后端已经启动。

> 后端目前使用 JSON 文件保存用户和业务数据，适合演示与小规模活动。多人并发或长期生产使用时，建议迁移到正式数据库。

## 第二步：启动 Web H5

打开第二个终端：

```bash
cd apps/web-h5
npm install
```

复制本地配置：

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

默认示例会请求本机 `http://localhost:3000`。然后运行：

```bash
npm run dev
```

访问终端显示的地址，通常是 `http://localhost:8080`。

常用命令：

```bash
npm run dev       # 开发模式
npm run build     # 生成 dist/ 生产文件
npm run preview   # 本地预览生产文件
```

## 微信小程序

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择 `apps/wechat-miniprogram/`。
4. 确认 `project.config.json` 中的 AppID 属于你有权限使用的小程序；否则换成自己的 AppID。
5. 执行 `npm install`，然后在微信开发者工具中选择“工具 → 构建 npm”。
6. 根据环境修改 `miniprogram/utils/request.js` 中的 `API_BASE`。

小程序正式请求必须使用已在微信公众平台配置的 HTTPS 合法域名。本地调试可在开发者工具中临时关闭域名校验，但不要把这个做法用于正式发布。

## Android 应用

Android 项目是通过 Capacitor 将 Vue H5 打包为原生应用。进入目录并安装依赖：

```bash
cd apps/android
npm install
```

复制 `.env.example` 为 `.env.local`，并把 `VITE_NATIVE_API_BASE` 改成手机能够访问的 HTTPS 后端地址。手机中的 `localhost` 指手机自身，不能直接代表开发电脑。

常用命令：

```bash
npm run dev           # 先在浏览器调试页面
npm run cap:sync      # 构建 H5，并同步到 Android 工程
npm run android:open  # 使用 Android Studio 打开工程
npm run apk:debug     # 命令行生成 Debug APK
```

Debug APK 通常生成在：

```text
apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```

正式发布必须在 Android Studio 中配置自己的签名文件。签名文件和密码不能提交到 Git。

## 部署到服务器

### 部署 H5

在 `apps/web-h5/` 中创建生产配置，使 `VITE_API_BASE=/api`，然后执行：

```bash
npm install
npm run build
```

将新生成的 `dist/` 内容上传到服务器的 `/www/web-h5/dist/`。仓库中的 `deploy/web-h5-dist/` 是打包本仓库时服务器上的历史部署快照，不是今后应手工修改的源码。

### 部署后端

将 `services/weapp-auth-server/` 上传到服务器，复制 `.env.example` 为 `.env` 并填写生产配置，再执行：

```bash
npm install --omit=dev
npm start
```

生产环境建议使用 systemd、PM2 或其他进程管理器保持服务运行，并把运行数据放在有备份和访问控制的位置。

### 使用 Nginx 配置

`deploy/nginx/` 保存的是服务器配置快照，其中域名、证书路径和网站目录与当前服务器有关。不要在其他服务器上直接覆盖整个 `/etc/nginx/`；应按实际域名和路径调整站点配置，然后检查并平滑重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 哪些内容没有放进仓库

为了安全和控制仓库体积，以下内容已通过 `.gitignore` 排除：

- `node_modules`、Gradle 缓存、构建缓存和一般 `dist` 目录
- 真实 `.env`、云密钥、JWT 密钥、证书私钥和 Android 签名文件
- 服务器访问日志
- `users.json`、`checkins.json`、`bottles.json` 等真实运行数据
- 微信开发者工具私人配置和 IDE 配置

首次启动后端时会按需创建部分 JSON 数据文件。需要迁移线上数据时请单独加密备份，不要提交到公开 GitHub 仓库。

## 常见问题

### 页面能打开，但接口报错

先确认后端 `/health` 正常，再检查前端的 `VITE_API_BASE`、Nginx `/api/` 代理和浏览器控制台中的 CORS 报错。

### Android 可以打开页面，但无法请求接口

确认 `VITE_NATIVE_API_BASE` 是手机可访问的完整 HTTPS 地址。修改配置后必须重新执行 `npm run cap:sync`。

### 图片上传失败

检查后端 `.env` 中的 COS Bucket、Region、公开资源域名和两组密钥变量。当前代码的不同路由分别使用 `COS_SECRET_*` 与 `TENCENT_SECRET_*`，因此示例配置要求两组都填写为同一套腾讯云凭据。

### 小程序提示域名不合法

在微信公众平台配置 request/uploadFile/downloadFile 合法域名，并确保服务器证书有效。

