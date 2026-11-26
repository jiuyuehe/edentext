# Cloud Driver EdenText Vue 迁移说明

English: [cloud-driver-edentext-vue-migration.md](cloud-driver-edentext-vue-migration.md)

**状态：** EdenText Vue 分支和包侧桥接已实现，并同步到上游 `v0.15.0`。原生应用与 Vue 构建、完整单元测试、包集成检查和本地浏览器验证均通过。Cloud Driver 集成已在工作区落地；使用真实云盘账号的端到端检查仍待完成。
**更新日期：** 2026-11-27

## 分支结构

Fork 中保留现有的 `main`、`main-new` 和 `foryly`。新增两条分支用于持续同步上游和维护 Vue 集成：

| 分支 | 用途 | 当前状态 |
|---|---|---|
| `upstream-main` | `stffnb/edentext:main` 的纯镜像，不包含自有提交 | 当前指向 `8731355c`（`v0.15.0`），已推送到 fork |
| `vue-component` | 独立维护 Vue 宿主和包功能 | 基于 `upstream/main` 的 `8731355c`；同步维护提交前领先 12 个提交、落后 0 个 |

Vue 改动按顺序移植自 `e0ad1d0f` 和 `02d647d3`，并针对最新上游实现进行了适配。没有把旧分支整体合并进来。旧的 `main`、`main-new` 和 `foryly` 引用仍保留作历史参考。

在 2026-10-09 的旧上游快照 `c98c48a096ad603eed42f0fb0b4ee7db141d9a66` 下，旧分支与 `upstream/main` 的差异为：

| 分支 | 超前 `upstream/main` | 落后 `upstream/main` |
|---|---:|---:|
| `main` | 2 | 188 |
| `main-new` | 5 | 6 |
| `foryly` | 3 | 188 |

### 同步纯镜像分支

```bash
git fetch upstream --prune
git switch upstream-main
git merge --ff-only upstream/main
git push jiuyuehe upstream-main
```

这些命令会让 `upstream-main` 与上游保持一致。如果快进合并或推送失败，先检查两端分支的差异，再决定如何处理；不要强制推送镜像分支。

### 同步 Vue 分支

```bash
git fetch upstream --prune
git switch vue-component
git rebase upstream/main
npm run check
npm run check:lib
npm test
npm run build:demo:vue
npm run build:app
npm run build:lib
npm pack ./packages/edentext-vue --dry-run
git push --force-with-lease jiuyuehe vue-component
```

遇到冲突时，应结合新的上游实现逐项解决，然后重新构建和验证。Rebase 会改写 Vue 分支历史，因此更新 fork 时使用 `--force-with-lease`；不要使用无条件强制推送。

## 已实现内容

### EdenText Vue 包

Vue 3 包挂载原有的 Svelte EdenText 应用，并提供带类型的宿主 API：

- `replaceDocument(source, filename)` 无原生确认提示地替换文档；导入失败时返回拒绝状态。
- `exportDocumentBytes('docx' | 'odt')` 在内存中返回文档字节，不触发浏览器下载或原生保存界面。
- `setAuthor(name)` 设置评论、修订和导出元数据使用的作者。
- `embedded` 隐藏原生文件操作，并将 Ctrl/Cmd+S 保存请求转发给宿主。
- `assetBaseUrl` 指定包运行时资源路径；CSS 选择器限制在 Vue 宿主内，避免影响页面其他部分。

构建还包括 Vue demo 和云盘风格对话框，用于演示打开、替换、作者设置和由宿主接管保存等交互。

### Cloud Driver

集成代码位于 `src/views/cloud-drive/components/file-manager/components/CloudDocxEditorDialog.vue`。现有的云端下载、空白模板、新建/版本上传、动态权限、重试、防止过期请求覆盖、事件和独立窗口流程均予以保留。EdenText 负责文档显示、编辑和导出；Cloud Driver 继续通过原有 API 处理服务器读写。

对话框等待 `ready` 事件后，通过 `replaceDocument` 导入已下载的 DOCX，并通过 `exportDocumentBytes('docx')` 获取保存内容。导入后设置当前用户为作者。嵌入模式下的保存请求会调用同一个宿主保存处理器。Vite 资源插件在开发环境提供包运行时资源，在生产构建中将其输出到 `dist/edentext-assets`；Vue 组件根据应用配置的 base path 生成资源 URL。

## 本地安装未发布的包

本地集成不要求先发布到 npm。当前本地打包和交接方式如下：

```powershell
# D:\yliyun_project\edentext
npm run build:lib
npm pack ./packages/edentext-vue --pack-destination output

# Cloud Driver 仓库
pnpm install
```

Cloud Driver 当前使用依赖路径 `file:../../../edentext/output/edentext-vue-0.1.0.tgz`。该路径只适用于当前两个仓库的相对目录布局，作为本地开发依赖使用。Tarball 属于被忽略的构建产物，因此干净的 CI checkout 或其他开发者环境中没有这个文件。发布负责人已选择公共 npm 并指定版本 `0.1.2`；发布后应将 Cloud Driver 的依赖清单和 pnpm 锁文件改为 `edentext-vue@0.1.2`，以供团队及 CI 安装。该包仍使用 `AGPL-3.0-only`；在 SaaS 中部署前还需单独解决授权问题。

## 验证状态

EdenText 中已完成：

- `npm run check`
- `npm run check:lib`
- `npm --prefix examples/edentext-vue-demo run typecheck`
- `npm test`：183 个测试文件通过、6 个跳过；2,466 项测试通过、32 项跳过、4 项 todo
- `npm run test:npm`
- `npm run build:demo:vue`
- `npm run build:app`
- `npm run build:lib`
- `npm pack ./packages/edentext-vue --dry-run`

Cloud Driver 验证结果：

- `pnpm build:local` 通过，并在 `dist/edentext-assets` 输出 73 个包资源文件（64.3 MiB）；已检查词典、同义词库和字体文件。
- `pnpm ts:check` 仍被项目其他位置的大量类型诊断阻断。修改后的对话框没有相关诊断；Vite 配置已由通过的生产构建验证。

仍需完成：

- 使用真实云盘账号做浏览器检查：编辑文档并上传新版本、用模板创建并上传文件、失败后重试、快速切换文件、确认宿主保存不触发浏览器下载，以及打开和关闭 Tauri 独立窗口。
- 检查部署后的 Web base path 和 Tauri 的 `/` base path 下，运行时资源和字体能否正常加载。
- 在已验证的正文、表格、页眉页脚和页面布局样例基础上扩大本地 DOCX 抽查范围；记录不兼容之处，不要在发布前默认宣称完全往返一致。

### 2026-10-19 上游同步记录

- `upstream-main` 和 `upstream/main` 均指向 `906aee14eb16b9d789ae85cd398465c75c6e68d5`；镜像分支已推送到 fork。
- Vue 分支原有的 6 个功能提交已 rebase 到最新上游 main，并增加本次同步维护提交。Vue 分支领先 7 个提交、落后 0 个提交，其中 6 个提交包含 Vue 集成。
- `npm run check`、`npm run check:lib`、`npm test`、`npm run build:demo:vue`、`npm run build:app` 和 `npm pack ./packages/edentext-vue --dry-run` 均通过。本轮测试结果为 179 个文件通过、5 个跳过；1,958 项通过、30 项跳过。
- Svelte 检查命令已限定在 `src` 和根目录 Svelte 配置，避免扫描 Vue demo 的嵌套 Vite 配置。

### 2026-10-23 上游同步记录

- `upstream-main` 快进同步上游 35 个提交至 `b68972d5`，并已将纯镜像推送到 fork。
- Vue 分支已 rebase 到该上游提交；当前领先 8 个提交、落后 0 个提交。
- 新上游在 Tiptap 核心中加入了同名 `textDirection` 扩展，与 EdenText 的段落级实现重复。已在正文和页眉页脚编辑器中禁用重复的核心扩展；浏览器检查不再出现重复扩展警告。
- Vue demo 浏览器冒烟检查：通过宿主保存 API 新建并导出 DOCX，再通过 Vue 对话框重新打开该 DOCX，并导出为新版本。浏览器报告 0 个错误、0 个警告；词典和同义词库请求均返回 HTTP 200。
- 在此基线上，`npm run check`、`npm run check:lib`、Vue demo 类型检查、`npm test`、`npm run build:demo:vue`、`npm run build:app` 和包 dry-run 全部通过。

### 2026-10-24 上游同步记录

- `upstream-main` 快进同步上游 5 个提交至发布提交 `b5ee86aa`（tag：`v0.12.0`），并已将纯镜像推送到 fork。
- Vue 分支原有的 8 个 fork 提交已 rebase 到该上游发布提交，本次新增同步记录后 `vue-component` 领先 9 个提交、落后 0 个提交。
- rebase 后重新验证 Vue 包：`npm run check`、`npm run check:lib`、demo 类型检查、`npm test`（1,962 项通过、30 项跳过）、`npm run build:demo:vue`、`npm run build:app` 和 `npm pack ./packages/edentext-vue --dry-run` 均通过。
- 本地浏览器冒烟测试通过：在 Vue demo 中新建并导出空白 DOCX，通过文件选择器重新打开该 DOCX，再导出为新版本。浏览器错误和警告均为 0；观测到的 37 个静态资源请求全部返回 HTTP 200。
- 上游主应用版本为 `0.12.0`；独立的 `edentext-vue` 包版本仍为 `0.1.0`。Vue 包需要单独确定合法的包版本和发布目标；主应用的发布流程不会发布 Vue 包。
- 生产构建仍有 Lightning CSS 对 `::highlight` 的提示及大体积分块提示，但构建均成功。

### 公共 npm 发布 `edentext-vue@0.1.2`

- Vue 分支上的 Vue 包版本设为 `0.1.2`，完成浏览器账号验证后已成功发布到公共 npm registry。

### zh-en 包体积优化（2026-10-24）

- Vue 库构建现在会把 PDF 字体引用和 Harper WebAssembly 二进制移至 `assetBaseUrl` 运行时资源；语法检查模块仍按需加载。
- 包内只包含 `en`、`en-GB` Hunspell 词典和共享的英文同义词库。中文文档语言标记仍受支持；当前没有中文拼写词典。
- `npm pack --dry-run` 测得压缩包 16.18 MB、解包 38.72 MB，低于原先的 35.26 MB 和 112.81 MB。`dist/index.js` 从 18.48 MB 降至 1.24 MB；语法检查入口块从 21.55 MB 降至 284 bytes。WASM 仍作为独立运行时资源随包提供，仅在开启语法检查时加载。
- 精简后的包版本为 `0.1.3`，尚未发布；当前公共发布版 `0.1.2` 保持不变。

### 生产版 Vue demo 资源检查

- 在生产构建后的本地 Vue demo 中打开了一个 44.7 KB 的中英文 DOCX。文档正常显示，宿主加载状态在本机 793 ms 后结束。
- demo 首页传输了 778,287 bytes；DOMContentLoaded 为 173 ms，load 事件为 176 ms。打开文档后额外传输 3,187,911 bytes，共有 21 个新增请求；观察到的 29 个请求均返回 HTTP 200。
- 新增资源包括 6 个字体文件、按需加载的编辑器/DOCX 模块和英文 Hunspell 词典。本次打开没有请求同义词库或 Harper WASM。浏览器控制台无错误或警告。

### 2026-11-27 上游同步记录

- 拉取上游 390 个提交，并将 `upstream-main` 和 `upstream/main` 快进到 `8731355c`（`v0.15.0`）；纯镜像已推送到 fork。
- 将 Vue 分支原有的 12 个提交 rebase 到上游 `main`；本次维护记录提交前，分支领先 12 个提交、落后 0 个。现有 `main`、`main-new`、`foryly`、精确恢复 stash 和其他本地工作均保留。
- 将本地兼容改动与上游的三语言槽 DOCX 模型、新版 RTL/修订处理、动态语言资源、iframe 嵌入和页面几何实现协调；保留并接入本地 CJK 语言推断。已解决 rebase 在编辑器、ribbon、i18n、主题和测试初始化中造成的语法冲突。
- 修复 Windows 下 npm 包集成测试：通过 Node 启动已安装的 Vite CLI，并在 Windows 直接结束该进程，不再使用仅适用于 POSIX 的进程组清理方式。
- CSP 内联脚本哈希计算前先将源码统一为 LF。浏览器解析 HTML 时会规范化 CRLF，之前的 Windows 哈希计算可能阻断生产环境启动脚本。
- 嵌入模式下的 Ctrl/Cmd+S 和现代工具栏保存按钮现在同时通知 Vue 宿主回调与原生 iframe 桥接。
- Vue 包装器现在会在动态导入 `App.svelte` 前设置运行时 embedded 标志。因此嵌入文档仅保存在内存中，不写入文档级 localStorage 或 sessionStorage。应用已拆为懒加载分块：`dist/index.js` 约 3.61 kB，主应用位于独立懒加载分块。
- 新增框架嵌入模式存储隔离回归测试。最终验证通过：`npm run check`、`npm run check:lib`、demo 类型检查、`npm test`（183 个文件通过、6 个跳过；2,466 项通过、32 项跳过、4 项 todo）、`npm run test:npm`、`npm run build:demo:vue`、`npm run build:app` 和 `npm run build:lib`。
- Vue 开发环境真实 DOCX 浏览器检查：3,686 ms 就绪；1,016 个字符、3 页；无横向溢出；中英文界面切换通过；Ctrl+S 导出 18,566 bytes DOCX，重新打开后插入标记保留；页眉页脚样例渲染正确。未观察到 CSP 违规、浏览器错误或文档级存储键。
- 正确限定目录后的 Vue 生产预览：首页资源 490,003 bytes（未压缩）；打开编辑器时加载 6,746,514 bytes 懒加载资源；真实 DOCX 在 3,627 ms 就绪。所有观测请求均返回 HTTP 200，无浏览器错误或文档级存储键。语言、ribbon 和页面 UI 偏好仍按设计写入 localStorage。
- `edentext-vue@0.1.3` 尚未发布；公共版本 `0.1.2` 保持不变。此前生成的 `0.1.3` tarball 已过期，未经重新构建不得发布。生产构建仍会提示大体积分块。
- 运行时资源 base URL 和 i18n 目标为模块级单例。当前验证覆盖常规单编辑器 Cloud Driver 对话框；多个 Vue 编辑器同时挂载仍需单独验证。

## 授权事项

该包标记为 `AGPL-3.0-only`。EdenText 仓库也说明专有软件和托管场景可能需要商业授权。在 SaaS 中部署编辑器前，应与权利人及合格法律顾问确认授权方案。发布包不会改变其许可证；字体、词典和同义词库的第三方声明也继续适用。
