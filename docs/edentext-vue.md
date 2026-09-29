# EdenText Vue 3 npm 包使用与发布指南

`edentext-vue` 是 EdenText 原生 Web 应用的 Vue 3 薄封装。Vue 组件负责挂载和销毁原生 `App.svelte`，并提供新建、打开、静默替换、内存导出、保存请求和语言/作者设置等宿主命令。

Ribbon、编辑器、分页、页眉页脚、表格、图片、审阅、查找替换、模板、ODT/DOCX/PDF 等功能全部来自原生 EdenText，不在 Vue 层重新实现。

## 对外 API

### 安装

```bash
npm install edentext-vue vue
```

`vue` 是 peer dependency。该包只支持 Vue 3 和浏览器，不支持 SSR、Node 服务端转换，也不包含 React 入口。

### 最小调用

宿主必须给组件一个明确高度，并将包的 `dist/assets` 内容复制到可访问的静态目录：

```vue
<script setup lang="ts">
import { EdentextEditor } from 'edentext-vue';
import 'edentext-vue/style.css';
</script>

<template>
  <div class="editor-host">
    <EdentextEditor
      locale="zh-Hans"
      document-language="zh-CN"
      initial-new-document
      asset-base-url="/edentext-assets"
    />
  </div>
</template>

<style>
.editor-host {
  width: 100%;
  height: 100vh;
}
</style>
```

组件内部显示的是 EdenText 原生 UI，不需要也不应该在 Vue 页面外部重新做一个工具栏。`style.css` 会把 UI 选择器、主题和页面尺寸变量收进 `.edentext-vue-host`；`asset-base-url` 用于 logo、图标、拼写词典和同义词数据。字体由 `style.css` 的相对资源引用加载。

### Props

```ts
interface EdentextEditorProps {
  /** 原生 EdenText 界面语言。可选：en、de、es、fr、pt、ru、ja、zh-Hans、zh-Hant。 */
  locale?: UiLocale;
  /** 文档默认语言、拼写检查语言和导出语言。可选值由 EdenText 的语言表决定。 */
  documentLanguage?: string;
  /** 挂载完成后调用一次原生“新建文档”，用于打开空文档。 */
  initialNewDocument?: boolean;
  /** 隐藏原生文件操作，并将 Ctrl/Cmd+S 转发给宿主。 */
  embedded?: boolean;
  /** 评论、修订和导出元数据使用的作者名。 */
  author?: string;
  /** 包运行时资源目录的基准 URL。 */
  assetBaseUrl?: string;
}
```

`locale` 和 `documentLanguage` 在组件挂载后发生变化时，会调用原生 EdenText 的语言设置函数，不会重建编辑器，也不会替换正文。

### 实例 API

```ts
interface EdentextEditorApi {
  newDocument(): void;

  /** 打开原生文件选择器。 */
  openFile(): Promise<void>;

  /** 复用原生导入器打开 ODT/DOCX。filename 用于判断格式和显示文档名。 */
  openDocument(
    source: File | Blob | ArrayBuffer | Uint8Array,
    filename?: string,
  ): Promise<void>;

  /** 静默替换当前文档；导入失败时 reject。 */
  replaceDocument(
    source: File | Blob | ArrayBuffer | Uint8Array,
    filename: string,
  ): Promise<void>;

  /** 调用原生 Save；已打开文件会保存回原文件，未保存文件会进入原生保存流程。 */
  save(): Promise<void>;

  /** 调用原生 Save As；由原生 UI 选择目标文件或触发浏览器下载。 */
  saveAs(format: 'odt' | 'docx'): Promise<void>;

  /** 调用原生导出流程；ODT/DOCX 走 Save As，PDF 走 EdenText 原生 PDF 导出。 */
  exportDocument(format: 'odt' | 'docx' | 'pdf'): Promise<void>;

  /** 在内存中构建 ODT/DOCX 字节，不打开文件选择器或触发下载。 */
  exportDocumentBytes(format: 'odt' | 'docx'): Promise<Uint8Array>;

  /** 设置评论、修订和导出元数据使用的作者名。 */
  setAuthor(name: string): void;

  setUiLocale(locale: UiLocale): void;
  setDocumentLanguage(language: string): void;
  focus(): void;
  destroy(): void;
}
```

通过 Vue 模板 ref 使用：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import {
  EdentextEditor,
  type EdentextEditorApi,
} from 'edentext-vue';
import 'edentext-vue/style.css';

const editor = ref<EdentextEditorApi | null>(null);

function onReady(api: EdentextEditorApi) {
  editor.value = api;
}

async function openFile(file: File) {
  await editor.value?.replaceDocument(file, file.name);
}

async function saveToHost() {
  const bytes = await editor.value?.exportDocumentBytes('docx');
  if (!bytes) return;
  const file = new File([bytes], 'draft.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  await uploadDocx(file); // 调用宿主自己的上传接口
}
</script>

<template>
  <div class="editor-host">
    <EdentextEditor
      ref="editor"
      locale="zh-Hans"
      document-language="zh-CN"
      embedded
      author="Current User"
      @ready="onReady"
      @save-request="saveToHost"
    />
  </div>
</template>
```

`ready` 事件只在原生 EdenText editor 实例真正创建完成后触发；在此之前不要调用实例方法。`error` 事件报告挂载错误。`embedded` 隐藏原生 New/Open/Save 菜单与文档名；Ctrl/Cmd+S 和 `api.save()` 会触发 `save-request`，由宿主选择上传、下载或其他保存方式。组件卸载时会自动卸载 Svelte 原生应用和其资源；通常不需要手动调用 `destroy()`。

### 新建、打开、另存和语言

```ts
editor.value?.newDocument();
await editor.value?.openFile();
await editor.value?.openDocument(bytes, 'draft.docx');
await editor.value?.replaceDocument(bytes, 'draft.docx');
await editor.value?.save();
await editor.value?.saveAs('odt');
await editor.value?.exportDocument('pdf');
const docxBytes = await editor.value?.exportDocumentBytes('docx');
editor.value?.setAuthor('Current User');
editor.value?.setUiLocale('zh-Hans');
editor.value?.setDocumentLanguage('zh-CN');
```

`openDocument` 保留原生打开时的替换确认和错误提示。`replaceDocument` 是明确的宿主替换命令，会跳过替换确认，并在导入失败时 reject。`exportDocumentBytes` 复用原生 DOCX/ODT exporter，在内存中生成字节并保留文档密码，不调用文件选择器或浏览器下载。普通模式下 `save`/`saveAs` 保持原生保存行为。

Vue 层不提供 `v-model`，也不暴露 TipTap、ProseMirror、Svelte 实例或另外一套 JSON 文档状态。宿主可调用 `replaceDocument` 打开文件，再用 `exportDocumentBytes` 把输出交给自己的上传 API。

## 仓库内运行 Vue demo

```bash
npm install
npm run build:lib
npm run demo:vue
```

然后访问 Vite 输出的本地地址。demo 提供“打开本地 DOCX”和“新建空白 DOCX”，通过 cloud-drive 风格弹窗验证静默打开、作者设置、宿主保存请求和字节导出。保存会下载结果文件来模拟上传前的输出；正式集成时将下载替换为云盘 API。

运行 demo 时 `predev`/`prebuild` 会把 package 中的词典和同义词文件复制到 `examples/edentext-vue-demo/public/assets/`。正式部署时把 package 的 `dist/assets/*` 放到 `asset-base-url` 对应目录。

也可以只构建 demo：

```bash
npm run build:demo:vue
```

## 构建 npm 包

根目录执行：

```bash
npm install
npm run check:lib
npm run build:lib
npm pack ./packages/edentext-vue --dry-run
```

`build:lib` 会完成三件事：

1. 用 `vite.lib.config.ts` 构建 ESM 入口；
2. 用 `vue-tsc` 输出 `dist/vue/index.d.ts` 等声明文件；
3. 把字体、Hunspell 词典、同义词库和许可证资源复制到 `dist/assets/`。

产物位于 `packages/edentext-vue/dist/`，包的导出约定为：

```json
{
  "name": "edentext-vue",
  "peerDependencies": { "vue": "^3.4.0" },
  "exports": {
    ".": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/index.js"
    },
    "./style.css": "./dist/style.css",
    "./assets/*": "./dist/assets/*"
  }
}
```

## 发布到 npm

先登录并确认包名可用：

```bash
npm login
npm whoami
npm view edentext-vue name
```

修改 `packages/edentext-vue/package.json` 的版本号，然后执行发布前检查：

```bash
npm run check
npm run check:lib
npm test
npm run build:app
npm run build:lib
npm pack ./packages/edentext-vue --dry-run
```

确认 dry-run 内容后发布：

```bash
npm publish ./packages/edentext-vue --access public
```

`prepack` 会把根目录的 `LICENSE` 和 `THIRD-PARTY-NOTICES.md` 放入包目录，`postpack` 会清理临时文件。发布前应确认 tarball 至少包含：

- `dist/index.js`
- `dist/vue/index.d.ts`
- `dist/style.css`
- `dist/assets/*`
- `LICENSE`
- `THIRD-PARTY-NOTICES.md`

发布后用干净的 Vue 3 项目验证：

```bash
npm install vue edentext-vue
```

验证原生 Ribbon、空文档、输入编辑、原生打开、保存/另存、UI 国际化、内容默认语言、字体和词典资源均正常加载。

## 设计边界

- Vue 是集成入口，不是第二个编辑器实现。
- 原生 EdenText UI 和功能继续由 `src/App.svelte` 维护。
- 不发布 React 组件，不发布 `@edentext/core`。
- 浏览器端运行；不支持 SSR 和 Node 服务端文档转换。
- 许可证为 `AGPL-3.0-only`。
