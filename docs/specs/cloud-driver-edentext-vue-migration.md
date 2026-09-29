# Cloud Driver DOCX Editor replacement spec

**Status:** EdenText package and local demo implemented; Cloud Driver adoption and license approval remain pending  
**Date:** 2026-09-29

## Implementation status

The package-side bridge is implemented in this repository: silent `replaceDocument`, in-memory DOCX/ODT export, author identity, embedded save requests, scoped CSS, configurable runtime asset URLs, and the cloud-drive-style Vue demo. The demo verifies the create/edit/save interaction with a local download standing in for the Cloud Driver upload API.

The separate Cloud Driver repository has not been modified by this package-side change. Its existing dialog, version/create upload calls, standalone Tauri entry point, and production integration checks remain to be completed there. Resolve the AGPL/commercial license gate before shipping the package in the SaaS product.

## 1. Goal

Replace `@eigenpal/docx-editor-vue` inside `CloudDocxEditorDialog.vue` with the `EdentextEditor` Vue 3 package from this repository, while preserving the cloud-drive workflows:

- Edit an existing DOCX and save it as a new cloud-file version.
- Create a DOCX from the existing blank template and upload it to the selected folder/scope.
- Keep the loading, retry, error, success, close, refresh and created behavior.
- Keep the same dialog and standalone Tauri editor-window entry points.

This is an integration of the existing EdenText application UI, not a second editor implementation. Markdown editing and cloud-drive APIs are out of scope.

## 2. Current code paths

### Cloud Driver

`src/views/cloud-drive/components/file-manager/CloudDocxEditorDialog.vue` owns the workflow. It downloads an existing file through `CloudFileApi.downloadFile(file.id)`, or fetches `resource/file/newdocx.docx` for create mode. It passes the resulting `ArrayBuffer` to the editor, then obtains an `ArrayBuffer` from `editorRef.save()`.

The host wraps those bytes in a DOCX `Blob` and `File`, then calls:

- `CloudFileVersionApi.uploadVersion(...)` for edit mode, preserving the file's space, source, bucket and path metadata.
- `CloudFileApi.uploadFile(parentId, file, scope)` for create mode.

The dialog is opened both from the lazy-loaded file manager and from `src/views/cloud-drive/editor-window/index.vue` for standalone desktop editing. Preserve its `open(file)`, `openForCreate(...)`, `editFile`/`createConfig` props, and `refresh`/`created`/`closed` emits so those callers do not need a parallel workflow.

### EdenText Vue package

`src/lib/vue/EdentextEditor.vue` mounts the original Svelte application. Its current API is documented in `docs/edentext-vue.md` and typed in `src/lib/native/types.ts`:

- `openDocument(source, filename)` accepts `File`, `Blob`, `ArrayBuffer` or `Uint8Array`.
- `save()`, `saveAs(format)` and `exportDocument(format)` run the native save/download flow and return `Promise<void>`.
- The Vue component emits `ready(api)` and `error(error)`.
- It renders EdenText's complete native UI; the wrapper does not currently accept slots or an embedded/hosted mode.

## 3. API compatibility and required package work

| Existing behavior | EdenText fit | Required decision/work |
|---|---|---|
| Pass downloaded DOCX bytes into editor | `openDocument` accepts `ArrayBuffer` | Call only after the `ready` event. Pass a `.docx` filename so the imported name and format are deterministic. |
| Pass blank-template bytes into editor | Same import path | Pass a DOCX filename and keep create mode's destination filename separately in the host. |
| Receive DOCX bytes without downloading locally | No equivalent: current `saveAs('docx')` opens a native picker or browser download | **Blocker:** add `exportDocumentBytes('docx'): Promise<Uint8Array>` (or a `Blob` return) that builds bytes without triggering a picker, download, alert or native save. Preserve the imported document password when producing output; reject on export errors. |
| Replace the document in a modal without an extra prompt | `openDocument` routes through the normal importer. The importer asks for confirmation when the editor already contains content restored from browser storage. | **Blocker:** provide an explicit host replacement path, e.g. `replaceDocument(source, filename)`, which replaces the current document without a browser confirmation. Keep the user-facing confirmation for the ordinary native Open command. |
| Show load failure in the cloud dialog and allow Retry | The current import path catches failures and shows `alert`; its promise may still resolve | **Blocker:** the host replacement call must resolve only on success and reject (or return a typed failure) on import failure/cancel. In embedded mode, do not show a second native alert for an error already reported to the host. |
| Attribute editing to the signed-in user | Old component passes `authorName`; EdenText has no Vue `author` prop/API | Add a host author setting and apply it after import. Map it to EdenText's comment/revision author behavior. Verify whether the old `author` prop also changes core document metadata before overwriting imported metadata. |
| Keep cloud save as the authoritative Save action | EdenText displays its own native New/Open/Save actions | Add an embedded/hosted UI option that hides native file actions (and the document-name control if desired) while retaining editing tools. Keep save/upload in the existing dialog actions and standalone title-bar slot. Avoid relying on private CSS selectors in the SaaS app. |
| Load package styles and runtime assets | Package exports `style.css` and copies runtime assets to `dist/assets/` | **Blocker:** scope/reset package CSS to the editor host. `src/styles/global.css` currently contains `*` margin/padding reset, `:root` variables, and `html, body` rules; importing it as-is can alter the surrounding Element Plus application. Also make dictionary/thesaurus URLs configurable or package-relative: current loaders use `import.meta.env.BASE_URL` paths (`/dictionaries/...`, `/thesaurus/...`), while package build copies those files under `dist/assets/`. |

The byte-export API must be the only path used by Cloud Driver's Save button. Native download behavior must not be used as a workaround because the cloud file/version APIs require the bytes in the page process.

## 4. Cloud Driver implementation shape

Keep all backend calls and state transitions in `CloudDocxEditorDialog.vue`. Replace the editor import and component only after the package API and CSS/assets above are ready.

1. Import `EdentextEditor`, `EdentextEditorApi`, and `edentext-vue/style.css`. Keep the existing `FloatingWindow`, action buttons, loading/error/success states, and save/upload functions.
2. Render EdenText in the existing body grid with an explicit `width: 100%; height: 100%; min-height: 0` host. Set `locale="zh-Hans"` and `document-language="zh-CN"`. Configure the new asset base for the host's static asset directory.
3. Store the API received from `@ready`. Once ready and a `documentBuffer` is present, call the host replacement API with the buffer and the current DOCX filename. Do not mark loading complete until import succeeds. On rejection, set `loadError` so the existing Retry button remains authoritative.
4. In `handleSave`, call `exportDocumentBytes('docx')`, create the existing DOCX `Blob`/`File`, and leave the current create/version upload branches unchanged. Keep double-click protection, success timing and emits unchanged.
5. Clear the API reference when the editor unmounts or the dialog resets. Invalidate pending open requests when `loadRequestId` changes, as the current loader already does.
6. In create mode, use the existing blank template and destination filename. The displayed/suggested editor filename must not replace `createFileName` used by the upload API.
7. Provide the current user's author value after document import. Do not change `CloudFileApi`, `CloudFileVersionApi`, permission checks, or file identity metadata.

Suggested host API contract after the EdenText package changes:

```ts
interface EdentextEditorApi {
  replaceDocument(source: File | Blob | ArrayBuffer | Uint8Array, filename: string): Promise<void>;
  exportDocumentBytes(format: 'odt' | 'docx'): Promise<Uint8Array>;
  setAuthor(name: string): void;
}
```

The methods operate on the real native editor state and must not expose TipTap, ProseMirror, Svelte, or a second document model. Keep normal native `openDocument`/`saveAs` behavior for the standalone EdenText app.

## 5. UI, lifecycle and compatibility requirements

- The cloud host remains responsible for server loading and server saving. EdenText is responsible for rendering/editing/exporting the document.
- Mount only when the cloud document bytes are ready. If the editor must stay mounted during retry, ensure a failed import can be retried without leaving stale document state.
- An `openDocument` in this host must replace any localStorage-restored document silently and deterministically. Closing or reopening a cloud dialog must not accidentally export the previous cloud document.
- The document's name is display metadata only. Edit mode saves under `currentFile.name`; create mode saves under `createFileName`.
- Keep DOCX MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Full Ribbon and paginated editing UI are acceptable inside the existing 1280×820 floating window and the standalone full-window view; verify resize and narrow viewport behavior before release.
- Do not keep the old editor's private `any` cast. Use the published `EdentextEditorApi` type.
- Verify the package's Svelte/Vue CSS does not reset the host page, and that fonts, dictionaries and thesaurus requests resolve from the configured package asset directory under both web base paths and Tauri's `/` base path.
- DOCX fidelity is a release check, not assumed parity. Use representative cloud files with tables, images, headers/footers, comments/revisions and page layout; record unsupported-import warnings rather than silently claiming exact round-trip parity.

## 6. Acceptance criteria

1. Existing DOCX: server download → editor opens without an unexpected replace prompt → edit → cloud version upload. No browser save dialog/download occurs.
2. Create DOCX: blank template opens → edit → create upload uses the requested name, parent ID and scope → `created` fires.
3. Retry after a network or import error works; stale loads cannot replace a more recently selected file.
4. Save errors remain in the host notification path; successful save closes the dialog and emits the same `refresh`/`created` event as before.
5. The file manager and standalone Tauri window still open/close through their existing public dialog API.
6. EdenText's CSS does not change unrelated Element Plus layout/styles, and its font/dictionary/thesaurus assets load from the packaged asset path.
7. Type checking and a production build succeed in both repositories; manually verify DOCX open/edit/export in browser and the Tauri standalone window.

## 7. Installing the unpublished package

Publishing to npmjs.org is required only if the consumer should run the registry command `pnpm add edentext-vue` (or `npm install edentext-vue`) and resolve it from the public npm registry. Publishing is not required to integrate or test it locally.

The Cloud Driver uses pnpm, so the recommended local handoff is a package tarball:

```powershell
# In D:\yliyun_project\edentext
npm run build:lib
npm pack ./packages/edentext-vue

# In D:\yliyun_project\yly-saas-cdms-ai\yly-saas-web\yly-saas-web-cloud-driver
pnpm add D:\yliyun_project\edentext\edentext-vue-0.1.0.tgz
```

`npm pack` runs the package's `prepack` hook, which adds the root license and third-party notice to the tarball. The library build must run first because the package entry points reference `packages/edentext-vue/dist`. Rebuild/repack and reinstall the tarball when validating a new local package change. For team/CI use, publish to an approved private registry or use the public npm registry after release; do not commit a machine-specific tarball path into a shared lockfile if it will not exist for CI.

## 8. License gate

`packages/edentext-vue/package.json` identifies the package as `AGPL-3.0-only`; `LICENSE.commercial.md` says the editor is dual-licensed and specifically calls out proprietary/closed-source and hosted/SaaS embedding as use cases that may need a separate commercial agreement. Before shipping this integration in the SaaS product, resolve the license with the copyright holder and qualified counsel. Publishing the package does not change that license. Third-party data/font terms in `THIRD-PARTY-NOTICES.md` also remain applicable.

## 9. Suggested delivery sequence

1. Resolve the license path for the intended SaaS distribution.
2. Implement and type the host-specific replace/export/author API in EdenText; scope package styles and fix runtime asset URLs.
3. Build and pack the package; install that tarball into the Cloud Driver branch.
4. Replace only the editor integration in `CloudDocxEditorDialog.vue`, preserving the existing dialog and cloud APIs.
5. Run each repository's relevant type/build checks and complete the acceptance checks above before changing the npm release channel.
