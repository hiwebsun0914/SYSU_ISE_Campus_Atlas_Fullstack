# 校园图鉴项目新手开发与本地测试教程

本文面向第一次参与网站开发的同学，目标是让大家能够安全地下载代码、运行网站、修改页面、完成本地测试，并通过功能分支和 Pull Request 提交代码。

> 本教程主要介绍 Web H5 和 Node.js 后端。第一次参与开发时，不需要配置 Android、微信小程序、Nginx 或腾讯云服务器。

## 1. 开始前先了解项目

项目主要分为以下部分：

```text
SYSU_ISE_Campus_Atlas_Fullstack/
├─ apps/
│  ├─ web-h5/                 # Vue 3 网页，初学者主要修改这里
│  ├─ android/                # Android App
│  └─ wechat-miniprogram/     # 微信小程序
├─ services/
│  └─ weapp-auth-server/      # Node.js 后端 API
├─ deploy/                    # 服务器部署配置和历史快照
└─ docs/                      # 项目文档
```

网页运行时的数据流：

```text
浏览器页面 → Web 请求工具 → Node.js 后端 → JSON 数据/COS 图片
```

初学者常见修改范围：

- 页面文字、输入框和按钮：`apps/web-h5/src/pages/`
- 网页样式：对应 `.vue` 文件的 `<style>` 部分
- 页面路由：`apps/web-h5/src/router/index.ts`
- 后端接口：`services/weapp-auth-server/`

不要直接修改：

- `node_modules/`
- `dist/`
- `deploy/web-h5-dist/assets/` 中压缩后的 JS/CSS
- `.git/`
- 服务器真实 `.env`
- COS 密钥、JWT 密钥、证书私钥

## 2. 需要安装的软件

所有协作者都需要：

| 软件 | 建议版本 | 用途 |
| --- | --- | --- |
| Git | 最新稳定版 | 下载代码和提交修改 |
| Node.js | 22 或更高版本 | 运行前端和后端 |
| npm | 随 Node.js 安装 | 安装项目依赖 |
| Visual Studio Code | 最新稳定版 | 编辑代码 |
| Chrome 或 Edge | 最新稳定版 | 测试网站和查看开发者工具 |

建议安装的 VS Code 扩展：

- Vue - Official
- ESLint
- Prettier
- GitLens（可选）

### 2.1 Windows 安装

安装以下软件：

- [Git for Windows](https://git-scm.com/download/win)
- [Node.js](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)

安装完成后打开 PowerShell：

```powershell
git --version
node --version
npm --version
```

`node --version` 应为 `v22` 或更高版本。

如果命令不存在，关闭并重新打开 PowerShell；仍然无效时，重新安装软件并确认勾选了添加到 PATH 的选项。

### 2.2 macOS 安装

可以直接下载安装包，也可以使用 Homebrew：

```bash
brew install git node
brew install --cask visual-studio-code
```

检查版本：

```bash
git --version
node --version
npm --version
```

`node --version` 应为 `v22` 或更高版本。

## 3. 第一次下载项目

选择一个专门存放代码的目录。

### Windows PowerShell

```powershell
cd $HOME\Documents
git clone https://github.com/hiwebsun0914/SYSU_ISE_Campus_Atlas_Fullstack.git
cd SYSU_ISE_Campus_Atlas_Fullstack
```

### macOS Terminal

```bash
cd ~/Documents
git clone https://github.com/hiwebsun0914/SYSU_ISE_Campus_Atlas_Fullstack.git
cd SYSU_ISE_Campus_Atlas_Fullstack
```

确认仓库状态：

```bash
git status
```

第一次下载完成后，应该看到工作区没有修改。

## 4. 每次开始开发前

不要直接在 `main` 上修改代码。先更新主分支，再创建自己的功能分支。

```bash
git switch main
git pull --ff-only origin main
git switch -c fix/简短功能名称
```

示例：

```bash
git switch -c fix/registration-real-name
```

分支名建议：

- 修复问题：`fix/问题名称`
- 开发功能：`feature/功能名称`
- 修改文档：`docs/文档名称`

一个分支只处理一个主题，不要把无关修改放进同一个 Pull Request。

## 5. 路线 A：只运行和修改网页

适合修改页面文字、布局、按钮、样式和普通交互。

### 5.1 安装 Web 依赖

Windows：

```powershell
cd apps\web-h5
npm ci
```

macOS：

```bash
cd apps/web-h5
npm ci
```

如果仓库的依赖锁文件刚发生较大变化，`npm ci` 失败时再询问项目负责人，不要直接运行 `npm audit fix --force`。

### 5.2 创建本地配置

Windows：

```powershell
Copy-Item .env.example .env.local
```

macOS：

```bash
cp .env.example .env.local
```

对于当前项目，建议将 `apps/web-h5/.env.local` 设置为：

```dotenv
VITE_API_BASE=/api
VITE_API_TIMEOUT=10000
VITE_API_RETRY=0
```

说明：

- `/api` 会通过 Vite 的开发代理请求接口，避免浏览器跨域问题。
- 修改 `.env.local` 后需要重启 `npm run dev`。
- `.env.local` 是本机配置，已被 Git 忽略，不会上传 GitHub。
- 当前 `vite.config.js` 的开发代理指向线上 API。使用这一模式测试注册、打卡、留言等写操作会影响线上数据，必须使用团队约定的测试账号，禁止随意制造测试数据。

### 5.3 启动网页

Windows 和 macOS 都执行：

```bash
npm run dev
```

看到以下信息表示启动成功：

```text
Local: http://localhost:8080/
```

浏览器打开：

<http://localhost:8080/>

开发服务器窗口要保持打开。停止服务时按：

```text
Ctrl + C
```

修改 `.vue` 文件后，Vite 通常会自动热更新页面，不需要每次重启。

## 6. 路线 B：本地同时运行前端和后端

适合修改登录、注册、打卡、排行榜、漂流瓶或其他 API 功能。

本地全栈测试需要两个终端：

- 终端 1：运行后端，端口 `3000`
- 终端 2：运行 Web，端口 `8080`

### 6.1 配置并运行本地后端

打开第一个终端。

Windows：

```powershell
cd services\weapp-auth-server
npm ci
Copy-Item .env.example .env
```

macOS：

```bash
cd services/weapp-auth-server
npm ci
cp .env.example .env
```

打开 `services/weapp-auth-server/.env`，至少修改：

```dotenv
PORT=3000
JWT_SECRET=请替换成一段足够长的随机字符串
```

生成本地 JWT 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将输出粘贴到 `JWT_SECRET=` 后面。

不测试图片上传时，可以暂时不配置 COS。头像、打卡图片、预签名上传等功能必须由项目负责人提供测试环境配置，禁止把生产 COS 密钥发到群聊或提交到 GitHub。

启动后端：

```bash
npm start
```

浏览器打开：

<http://localhost:3000/health>

如果显示类似内容，后端启动成功：

```json
{
  "ok": true,
  "time": 1234567890
}
```

### 6.2 让 Web 请求本地后端

当前仓库的 `apps/web-h5/vite.config.js` 默认把 `/api` 代理到线上域名。需要进行纯本地联调时，不要各自随意修改并提交该文件；请由团队统一决定是否把代理目标改为：

```js
target: 'http://localhost:3000'
```

本地联调时，`apps/web-h5/.env.local` 仍建议使用：

```dotenv
VITE_API_BASE=/api
```

这样浏览器只请求同源的 `http://localhost:8080/api/...`，再由 Vite 转发到本地后端，可以避免跨域 Cookie 和 CORS 问题。

如果为了本地联调临时修改了 `vite.config.js`，提交前必须执行：

```bash
git diff
```

确认没有把个人本地地址或临时配置提交到功能分支。

更推荐后续由项目负责人把代理目标改造成环境变量，例如 `VITE_DEV_PROXY_TARGET`，从根本上避免协作者修改受 Git 管理的配置文件。

### 6.3 启动 Web

打开第二个终端：

Windows：

```powershell
cd apps\web-h5
npm ci
npm run dev
```

macOS：

```bash
cd apps/web-h5
npm ci
npm run dev
```

测试顺序：

1. 打开 `http://localhost:3000/health`，确认后端正常。
2. 打开 `http://localhost:8080`，确认页面正常。
3. 打开浏览器开发者工具的 Network 面板。
4. 测试注册、登录或目标功能。
5. 确认请求 URL、状态码和返回内容正确。

## 7. 浏览器测试方法

打开 Chrome 或 Edge 开发者工具：

- Windows：`F12` 或 `Ctrl + Shift + I`
- macOS：`Command + Option + I`

重点查看：

### Console

检查是否有红色 JavaScript 错误。

### Network

重新操作目标功能，检查接口请求：

- `200`：通常成功
- `400`：输入或请求数据不符合要求
- `401`：未登录或登录状态失效
- `403`：没有权限
- `404`：接口路径错误
- `500`：后端发生错误
- `status 0`、`Network Error`：常见原因是后端未运行、代理错误、CORS、HTTPS/HTTP 混用或超时

### Responsive Design

网页主要面向手机，必须测试：

- 约 375px 宽的手机尺寸
- 文字是否溢出
- 按钮是否容易点击
- 输入框是否被键盘遮挡
- 弹窗和图片是否超出屏幕

## 8. 每次修改后的最低测试清单

只修改页面时：

- [ ] 页面能打开
- [ ] 修改内容显示正确
- [ ] 登录页和注册页可以切换
- [ ] 浏览器 Console 没有新增红色错误
- [ ] 手机宽度下布局正常
- [ ] 相关旧功能仍能使用

修改接口时：

- [ ] `http://localhost:3000/health` 正常
- [ ] 正确输入能够成功
- [ ] 错误输入有合理提示
- [ ] 未登录状态处理正确
- [ ] Network 中接口状态码和返回内容正确
- [ ] 不会把测试数据写入生产环境

提交代码前必须执行生产构建：

```bash
cd apps/web-h5
VITE_API_BASE=/api npm run build
```

构建最后应显示：

```text
✓ built in ...
```

看到 `Build failed` 时禁止部署和提交合并。

## 9. Windows、macOS 和 Linux 的文件名大小写

生产服务器使用 Linux，严格区分文件名大小写。

例如，实际文件是：

```text
src/pages/admin/review.vue
```

代码必须写成：

```js
import('../pages/admin/review.vue')
```

不能写成：

```js
import('../pages/admin/Review.vue')
```

macOS 和 Windows 上可能看不出这个问题，但 Linux 构建会失败。

提交前检查所有 `import` 路径的大小写与真实文件名完全一致。只修改文件名大小写时，建议使用：

```bash
git mv 原文件名 临时文件名
git mv 临时文件名 正确文件名
```

## 10. Git 提交与 Pull Request

先查看修改：

```bash
git status
git diff
```

只暂存本次相关文件：

```bash
git add 具体文件路径
```

不要习惯性使用 `git add .`，避免把无关文件或临时文件一起提交。

创建提交：

```bash
git commit -m "简洁说明本次修改"
```

推送功能分支：

```bash
git push -u origin 当前分支名
```

然后在 GitHub 创建 Pull Request：

- Base/目标分支：`main`
- Compare/来源分支：自己的功能分支
- 不要直接推送 `main`
- 不要自行合并尚未审核的 PR

PR 说明至少包含：

- 改了什么
- 为什么修改
- 如何测试
- 测试结果
- 需要审核员关注什么

## 11. 更新别人已经合并的代码

先确认自己的工作已提交：

```bash
git status
```

然后更新主分支：

```bash
git switch main
git pull --ff-only origin main
```

开始新任务时重新创建分支：

```bash
git switch -c feature/新的任务
```

如果切换分支时提示本地修改会被覆盖，不要执行 `git reset --hard`，先联系项目负责人处理。

## 12. 配置文件与安全规则

绝对不能上传：

- `services/weapp-auth-server/.env`
- `apps/web-h5/.env.local`
- 腾讯云 SecretId/SecretKey
- JWT 生产密钥
- SSH 私钥
- Android keystore
- 用户真实数据
- 服务器密码

提交前检查：

```bash
git status
git diff --cached
```

如果发现密钥已经提交，不能只删除文件；应立即通知项目负责人撤销并轮换密钥。

## 13. COS 什么时候需要配置

以下开发通常不需要 COS：

- 修改文字和样式
- 修改普通页面交互
- 测试基础注册和登录
- 修改路由
- 运行生产构建

以下功能需要测试 COS 配置：

- 上传头像
- 上传打卡图片
- 查询或展示依赖 COS 的新图片
- STS 临时密钥和预签名上传

普通代码更新、Git 提交和服务器发布不需要手动同步 COS。COS 中已有图片不会因为发布代码而消失。

## 14. 常见问题

### `npm` 或 `node` 命令不存在

重新安装 Node.js 22，并重新打开终端。

### `npm ci` 失败

确认当前目录中存在 `package-lock.json`，并检查 Node.js 版本。不要直接使用 `--force`。

### 端口被占用

检查是否已经启动过同一个服务，回到旧终端按 `Ctrl + C`。

Web 默认端口：`8080`。

后端默认端口：`3000`。

### 页面能打开但显示 `Network Error`

依次检查：

1. 后端是否运行。
2. `.env.local` 是否正确。
3. 修改环境变量后是否重启 Vite。
4. Vite 代理目标是否与测试环境一致。
5. Network 面板中的实际请求 URL。
6. 是否存在 CORS 或 HTTPS/HTTP 混用。

### Vite 提示重启

看到以下信息属于正常行为：

```text
.env.local changed, restarting server...
server restarted.
```

### `npm audit` 报漏洞

先记录并通知项目负责人。不要自行执行：

```bash
npm audit fix --force
```

自动升级可能引入破坏性版本变化。安全修复应单独建立分支并完成回归测试。

### 本地构建成功，Linux 服务器构建失败

优先检查：

- 文件名和 `import` 路径大小写
- 未被 Git 跟踪的文件
- Node.js 版本差异
- 环境变量缺失
- 是否误依赖本地缓存或旧的 `node_modules`

## 15. 遇到问题时如何提供信息

不要只说“运行不了”。请同时提供：

- 使用 Windows 还是 macOS
- 当前执行目录
- 执行的完整命令
- 从第一条红色错误开始的完整输出
- `node --version`
- `npm --version`
- `git status -sb`
- 浏览器 Console 或 Network 截图

发送截图前遮挡：

- 密码
- Token
- Cookie
- SecretId/SecretKey
- 用户隐私数据
- 服务器公网 IP（不需要公开时）

## 16. 推荐的团队约定

建议团队进一步补充并统一以下内容：

1. 提供独立的测试后端和测试 COS，避免新手误操作生产数据。
2. 将 Vite 开发代理目标改为环境变量 `VITE_DEV_PROXY_TARGET`，避免每个人修改受 Git 管理的配置文件。
3. 明确测试账号、管理员测试账号和测试数据清理规则。
4. 给每个任务建立 GitHub Issue，写明需求和验收标准。
5. 所有修改通过功能分支和 PR，不允许直接推送 `main`。
6. PR 合并前至少由一名其他成员审核。
7. 建立自动化 CI，在 PR 中运行 Web 生产构建。
8. 在 Linux CI 中构建，提前发现文件名大小写问题。
9. 统一代码格式化和 ESLint 规则。
10. 建立服务器部署、回滚、数据备份和密钥轮换文档。

## 17. 新手每日开发流程速查

```text
更新 main
  ↓
创建功能分支
  ↓
安装依赖并启动项目
  ↓
只修改任务相关文件
  ↓
浏览器手动测试
  ↓
运行生产构建
  ↓
检查 git diff
  ↓
提交并推送功能分支
  ↓
创建 Pull Request
  ↓
等待审核和合并
```

遇到不确定的命令，尤其是包含 `reset --hard`、`rm -rf`、`--force`、数据库删除或服务器覆盖操作时，先停止并询问项目负责人。
