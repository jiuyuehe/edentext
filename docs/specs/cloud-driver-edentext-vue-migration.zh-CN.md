# Cloud Driver EdenText Vue 迁移说明

English: [cloud-driver-edentext-vue-migration.md](cloud-driver-edentext-vue-migration.md)

**状态：** EdenText Vue 分支和包侧桥接已实现。Cloud Driver 对话框及本地 tarball 集成已在工作区落地，生产构建通过；全项目类型检查仍有其他文件中的错误。使用真实账号的端到端检查待完成。
**更新日期：** 2026-10-09

## 分支结构

Fork 中保留现有的 `main`、`main-new` 和 `foryly`。新增两条分支用于持续同步上游和维护 Vue 集成：

| 分支 | 用途 | 当前状态 |
|---|---|---|
| `upstream-main` | `stffnb/edentext:main` 的纯镜像，不包含自有提交 | 当前指向 `c98c48a096ad603eed42f0fb0b4ee7db141d9a66`，已推送到 fork |
| `vue-component` | 独立维护 Vue 宿主和包功能 | 基于当前上游 main，包含 Vue 集成和后续维护改动 |

Vue 改动按顺序移植自 `e0ad1d0f` 和 `02d647d3`，并针对最新上游实现进行了适配。没有把旧分支整体合并进来。旧的 `main`、`main-new` 和 `foryly` 引用仍保留作历史参考。

在上表所列的上游快照下，旧分支与 `upstream/main` 的差异为：

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

Cloud Driver 当前使用依赖路径 `file:../../../edentext/output/edentext-vue-0.1.0.tgz`。该路径只适用于当前两个仓库的相对目录布局，作为本地开发依赖使用。Tarball 属于被忽略的构建产物，因此干净的 CI checkout 或其他开发者环境中没有这个文件。团队共享或部署 Cloud Driver 改动前，应选定已批准的私有 registry 或 CI 可访问的包产物，并更新依赖清单和锁文件。在发布负责人确认包的授权路径之前，不要发布到公共 npm。

## 验证状态

EdenText 中已完成：

- `npm run check`
- `npm run check:lib`
- `npm test`：229 个测试文件通过，5 个跳过；1,487 项测试通过，28 项跳过
- `npm run build:demo:vue`
- `npm run build:app`
- `npm pack ./packages/edentext-vue --dry-run` 和本地 tarball 打包

Cloud Driver 验证结果：

- `pnpm build:local` 通过，并在 `dist/edentext-assets` 输出 73 个包资源文件（64.3 MiB）；已检查词典、同义词库和字体文件。
- `pnpm ts:check` 仍被项目其他位置的大量类型诊断阻断。修改后的对话框没有相关诊断；Vite 配置已由通过的生产构建验证。

仍需完成：

- 使用真实云盘账号做浏览器检查：编辑文档并上传新版本、用模板创建并上传文件、失败后重试、快速切换文件、确认宿主保存不触发浏览器下载，以及打开和关闭 Tauri 独立窗口。
- 检查部署后的 Web base path 和 Tauri 的 `/` base path 下，运行时资源和字体能否正常加载。
- 使用包含表格、图片、页眉页脚和页面布局的代表性 DOCX 文件抽查导入导出。记录不兼容之处，不要在发布前默认宣称完全往返一致。

## 授权事项

该包标记为 `AGPL-3.0-only`。EdenText 仓库也说明专有软件和托管场景可能需要商业授权。在 SaaS 中部署编辑器前，应与权利人及合格法律顾问确认授权方案。发布包不会改变其许可证；字体、词典和同义词库的第三方声明也继续适用。
