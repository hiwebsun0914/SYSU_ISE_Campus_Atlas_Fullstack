# SYSU ISE Campus Guide (Web -> Android APK)

本项目原本是 `Vite + Vue` Web 应用，已接入 `Capacitor` 并生成 Android 原生工程，可用于打包 APK。

## 当前状态

- 已完成 `Capacitor` 初始化（`capacitor.config.json`）
- 已生成 Android 工程（`android/`）
- 已完成 Web 资源同步到 Android（`dist -> android/app/src/main/assets/public`）
- 已配置 Gradle 下载镜像与 Maven 镜像（适合当前网络环境）
- 当前机器未安装 Android SDK，因此无法在本机完成最终 APK 编译

## 我已执行的集成步骤（已完成）

```bash
npm i @capacitor/core @capacitor/android
npm i -D @capacitor/cli
npx cap init "SYSU ISE Campus Guide" "com.sysu.isecampusguide" --web-dir=dist
npm run build
npx cap add android
npx cap sync android
```

## 新增脚本（已写入 `package.json`）

```bash
# 构建前端并同步到 android 工程
npm run cap:sync

# 用 Android Studio 打开项目
npm run android:open

# 命令行构建 Debug APK（需要先安装 Android SDK）
npm run apk:debug
```

## 生成 APK（你本机补齐 Android SDK 后）

### 1. 安装必备环境

- Android Studio（建议最新稳定版）
- Android SDK（通过 Android Studio 安装）
- JDK（已安装 Java，可继续使用；Android Studio 自带 JBR/JDK 也可）

建议至少安装：
- Android SDK Platform（一个较新的 API，例如 API 34/35/36）
- Android SDK Build-Tools
- Android SDK Command-line Tools

### 2. 配置 SDK 路径（二选一）

方式 A：设置环境变量（推荐）

Windows PowerShell（示例）：

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

重开终端后生效。

方式 B：在 `android/local.properties` 中写入：

```properties
sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
```

### 3. 构建 Debug APK

```bash
npm run apk:debug
```

输出文件：

`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. 构建 Release APK（正式包）

推荐在 Android Studio 中操作：

- `Build` -> `Generate Signed Bundle / APK`
- 选择 `APK`
- 配置签名 `keystore`
- 生成 `release` 包

常见输出路径：

`android/app/build/outputs/apk/release/app-release.apk`

## 网络环境兼容说明（已处理）

为避免当前环境无法访问官方源导致构建失败，已做以下调整：

- `android/gradle/wrapper/gradle-wrapper.properties`
  - `distributionUrl` 改为华为云 Gradle 镜像
  - `networkTimeout` 调整为 `600000`
- `android/build.gradle`
  - 在 `repositories` 中增加阿里云 Maven 镜像（`google` / `public`）

## 注意事项（Web 转 App 常见坑）

### 1. `vite.config.js` 的 `/api` 代理只在开发环境生效

APK 中不会使用 Vite 开发服务器代理。生产环境接口需要直接请求真实后端域名，并确保后端 CORS 配置正确。

### 2. 每次修改前端代码后都要同步到 Android 工程

```bash
npm run cap:sync
```

否则 Android 工程里的页面资源不会更新。

## 常用命令速查

```bash
# 本地 Web 开发
npm run dev

# 仅构建 Web
npm run build

# 构建并同步到 Android
npm run cap:sync

# 打开 Android Studio
npm run android:open

# 生成 Debug APK（需 SDK）
npm run apk:debug
```
