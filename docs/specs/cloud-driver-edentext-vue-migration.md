# Cloud Driver EdenText Vue migration

中文版：[cloud-driver-edentext-vue-migration.zh-CN.md](cloud-driver-edentext-vue-migration.zh-CN.md)

**Status:** The EdenText Vue branch and package bridge are implemented and synchronized to upstream `v0.15.0`. Native and Vue builds, the full unit suite, package integration checks, and local browser validation pass. Cloud Driver integration is implemented in the working tree; authenticated cloud end-to-end checks remain pending.
**Updated:** 2026-11-27

## Branch layout

The fork keeps the existing `main`, `main-new` and `foryly` branches unchanged. Two branches establish the ongoing upstream workflow:

| Branch | Purpose | Current state |
|---|---|---|
| `upstream-main` | Exact mirror of `stffnb/edentext:main`; no local commits | At `204a53bd`, pushed to the fork |
| `vue-component` | Vue host and package changes maintained separately from upstream | Based on `upstream/main` at `204a53bd`; 15 commits ahead, 0 behind after the follow-up maintenance commit |

The Vue changes were ported in order from `e0ad1d0f` and `02d647d3`, then reconciled against the latest upstream implementation. Old branch work was not merged wholesale. The old `main`, `main-new` and `foryly` refs remain available as historical references.

At the previous upstream snapshot `c98c48a096ad603eed42f0fb0b4ee7db141d9a66` on 2026-10-09, the legacy branch divergence was:

| Branch | Ahead of `upstream/main` | Behind `upstream/main` |
|---|---:|---:|
| `main` | 2 | 188 |
| `main-new` | 5 | 6 |
| `foryly` | 3 | 188 |

### Synchronize the mirror

```bash
git fetch upstream --prune
git switch upstream-main
git merge --ff-only upstream/main
git push jiuyuehe upstream-main
```

This keeps `upstream-main` identical to upstream. If the fast-forward or push fails, inspect both refs before deciding how to proceed; do not force-push the mirror.

### Synchronize the Vue branch

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

Resolve each rebase conflict against the new upstream implementation, then rebuild and verify before pushing. Rebase rewrites the Vue branch history, so update the fork with `--force-with-lease`; never use an unconditional force push.

## What is implemented

### EdenText package

The Vue 3 package mounts the original Svelte EdenText app and exposes a typed host API:

- `replaceDocument(source, filename)` replaces a document without a native prompt and rejects when import fails.
- `exportDocumentBytes('docx' | 'odt')` returns bytes without invoking browser download or native save UI.
- `setAuthor(name)` applies the active author to comments, revisions and export metadata.
- `embedded` hides native file actions and sends Ctrl/Cmd+S to the host.
- `assetBaseUrl` directs runtime requests to package assets; scoped CSS keeps the editor styles under its Vue host.

The build also includes the Vue demo and a cloud-drive-style dialog that demonstrates open, replace, author and host-save interactions.

### Cloud Driver

The integration is in `src/views/cloud-drive/components/file-manager/components/CloudDocxEditorDialog.vue`. It retains the existing cloud download, blank-template, create/version upload, dynamic permission, retry, stale-request, event and standalone-window flows. EdenText handles document display/edit/export; the existing Cloud Driver APIs remain responsible for server I/O.

The dialog waits for `ready`, imports the fetched DOCX through `replaceDocument`, and saves through `exportDocumentBytes('docx')`. The host author is applied after import. Embedded save requests call the same host save handler. A Vite asset plugin serves the package runtime files in development and emits them under `dist/edentext-assets` for production builds; the component derives this URL from the configured application base path.

## Local package installation

Publishing to npm is not needed for local integration. The current local handoff is:

```powershell
# D:\yliyun_project\edentext
npm run build:lib
npm pack ./packages/edentext-vue --pack-destination output

# Cloud Driver repository
pnpm install
```

Cloud Driver currently references `file:../../../edentext/output/edentext-vue-0.1.0.tgz`. This works for the present sibling checkout layout and is only a local development dependency. The tarball is ignored build output, so this path is not suitable for a clean CI checkout or other developers. The release owner selected public npm and version `0.1.2`; after publication, update the Cloud Driver manifest and pnpm lockfile to `edentext-vue@0.1.2` for shared and CI installs. The package remains `AGPL-3.0-only`; SaaS deployment licensing must be resolved separately.

## Verification status

Completed in EdenText:

- `npm run check`
- `npm run check:lib`
- `npm --prefix examples/edentext-vue-demo run typecheck`
- `npm test` — 189 files passed, 6 skipped; 2,643 tests passed, 32 skipped, 4 todo
- `npm run test:npm`
- `npm run build:demo:vue`
- `npm run build:app`
- `npm run build:lib`
- `npm pack ./packages/edentext-vue --dry-run`

Verification results in Cloud Driver:

- `pnpm build:local` passes and emits 73 package asset files (64.3 MiB) under `dist/edentext-assets`; checked dictionary, thesaurus and font files.
- `pnpm ts:check` remains failing with broad project diagnostics in unrelated files. No diagnostic referenced the edited dialog; the Vite config was exercised by the passing production build.

Still required:

- Browser checks using real cloud credentials: edit and upload a new version, create and upload a template, retry after failure, switch documents quickly, verify no browser download on host save, and open/close the standalone Tauri window.
- Check runtime requests and fonts under the deployed web base path and the Tauri `/` base path.
- Expand the local DOCX corpus beyond the validated text, table, header/footer, and page-layout cases before rollout; record any import/export differences.

### Upstream sync on 2026-10-19

- `upstream-main` and `upstream/main` both point to `906aee14eb16b9d789ae85cd398465c75c6e68d5`; the mirror was pushed to the fork.
- Rebased the six existing Vue branch commits onto the latest upstream main and added this sync maintenance update. The Vue branch is 7 commits ahead and 0 behind; six commits contain the Vue integration.
- `npm run check`, `npm run check:lib`, `npm test`, `npm run build:demo:vue`, `npm run build:app`, and `npm pack ./packages/edentext-vue --dry-run` passed. The test run reported 179 files passed, 5 skipped; 1,958 tests passed, 30 skipped.
- The Svelte check command is scoped to `src` and the root Svelte config so it does not inspect the nested Vue demo's Vite config.

### Upstream sync on 2026-10-23

- Fast-forwarded `upstream-main` by 35 commits to `b68972d5` and pushed the exact mirror to the fork.
- Rebased the Vue branch onto that upstream commit. The current branch is 8 commits ahead and 0 behind.
- The new upstream added a core `textDirection` extension with the same name as EdenText's block-scoped extension. Disabled the duplicate core extension for body and header/footer editors; the browser demo now logs no duplicate-extension warning.
- Vue demo smoke check: created a blank DOCX through the host save API, reopened that DOCX through the Vue dialog, then exported it as a new version. The browser reported 0 errors and 0 warnings; dictionary and thesaurus requests returned HTTP 200.
- `npm run check`, `npm run check:lib`, Vue demo typecheck, `npm test`, `npm run build:demo:vue`, `npm run build:app`, and package dry-run all passed on this baseline.

### Upstream sync on 2026-10-24

- Fast-forwarded `upstream-main` by 5 commits to `b5ee86aa` (`v0.12.0`) and pushed the exact mirror to the fork.
- Rebased the 8 existing fork commits onto the release commit, then added this sync record; `vue-component` is 9 commits ahead and 0 behind `upstream/main`.
- Verified the Vue package after the rebase: `npm run check`, `npm run check:lib`, demo typecheck, `npm test` (1,962 passed; 30 skipped), `npm run build:demo:vue`, `npm run build:app`, and `npm pack ./packages/edentext-vue --dry-run` all passed.
- Browser smoke check on the Vue demo created and exported a blank DOCX, reopened the downloaded DOCX through the file picker, and exported it as a new version. The browser reported 0 errors and 0 warnings; all 37 observed static requests returned HTTP 200.
- The upstream application is `0.12.0`; the independent `edentext-vue` package remains `0.1.0`. A Vue package release needs its own valid package version and publishing target; the main application release workflow does not publish the Vue package.
- Production builds still report Lightning CSS warnings for `::highlight` and large chunks; both builds complete successfully.

### Public npm release `edentext-vue@0.1.2`

- Set the package version to `0.1.2` on the Vue branch and successfully published it to the public npm registry after completing browser-based account verification.

### zh-en package-size optimization (2026-10-24)

- The Vue library build now externalizes PDF font references and Harper's WebAssembly binary to the configured `assetBaseUrl`; the grammar binary remains lazy-loaded.
- The package includes only `en` and `en-GB` Hunspell dictionaries and the shared English thesaurus. Chinese document language tags remain supported; Chinese spell-check data is not available.
- `npm pack --dry-run` measured 16.18 MB compressed and 38.72 MB unpacked, down from the previous 35.26 MB and 112.81 MB. `dist/index.js` decreased from 18.48 MB to 1.24 MB; the grammar entry chunk decreased from 21.55 MB to 284 bytes. The WASM is still included as a separate runtime asset and fetched only when grammar checking is enabled.
- The optimized package version is `0.1.3`; it has not been published. The existing public `0.1.2` remains unchanged.

### Production Vue demo resource check

- Opened a local 44.7 KB Chinese/English DOCX in the production-built Vue demo. The editor displayed the document and cleared its host loading state in 793 ms on this machine.
- The demo landing page transferred 778,287 bytes; DOMContentLoaded was 173 ms and the load event was 176 ms. Opening the document triggered 3,187,911 additional transferred bytes across 21 requests; all 29 observed requests returned HTTP 200.
- The additional requests included six font files, lazy editor/DOCX modules, and the English Hunspell dictionary. No thesaurus or Harper WASM request occurred during this open. Browser console had no errors or warnings.

### Upstream sync on 2026-11-27

- The initial synchronization fetched 390 upstream commits through `8731355c`. A follow-up fetch on the same day added 373 more commits through `204a53bd`; local and fork `upstream-main` now both point to `204a53bd`.
- Rebased all 14 Vue branch commits onto `204a53bd` and added this follow-up maintenance record; the branch is now 15 commits ahead and 0 behind. Existing `main`, `main-new`, `foryly`, both exact restore stashes, and unrelated local work were preserved.
- Resolved new conflicts from upstream collaboration, layout, host-template, script, and dependency changes while preserving the Vue package, runtime asset scoping, and native bridge. Restored local CJK inference and TOC-style fixes remain uncommitted and were adapted to the new APIs.
- Fixed the Windows npm package integration runner to start the installed Vite CLI through Node and to terminate its process directly instead of using POSIX-only process-group cleanup.
- Normalized CSP inline-script source to LF before hashing. Browser HTML parsing normalizes CRLF, so the previous Windows hash calculation could block the production startup script.
- Embedded Ctrl/Cmd+S and the modern toolbar save button now notify both the Vue host callback and the native iframe bridge.
- The Vue wrapper now sets the runtime embedded flag before dynamically importing `App.svelte`. Embedded document data therefore stays in memory and does not write document-level localStorage or sessionStorage entries. The app became a lazy chunk; `dist/index.js` is about 3.61 kB, with the main application in a separate lazy chunk.
- Added a regression test for framework-embedded storage isolation. Scoped the Vue demo typecheck with its own TypeScript config and made its DOCX Blob copy explicitly ArrayBuffer-backed for TypeScript 6. Normalized temporary POSIX paths in the Docker entrypoint test so Windows `awk` does not consume backslashes as escapes.
- Final verification passed: `npm run check`, `npm run check:lib`, demo typecheck, `npm test` (189 files passed, 6 skipped; 2,643 passed, 32 skipped, 4 todo), `npm run test:npm`, `npm run build:demo:vue`, `npm run build:app`, and `npm run build:lib`. The rebuilt package entry is about 3.61 kB, with a 1,729.80 kB lazy application chunk; the demo application chunk is about 1.35 MB.
- Vue dev browser check with a real DOCX: ready in 3,686 ms; 1,016 characters across 3 pages; no horizontal overflow; English/Chinese locale switching passed; Ctrl+S exported an 18,566-byte DOCX that reopened with the inserted marker intact; header/footer corpus rendered correctly. No CSP violation, browser error, or document-level storage key was observed.
- Cold-cache production Vue check with a real DOCX: the landing page transferred 129,387 bytes, DOMContentLoaded was 35 ms, and the load event was 37 ms; no editor application chunk was preloaded. The document was ready in 1,236 ms with 1,016 characters across 3 pages. Across landing, import, and reopen, 35 same-origin resource entries transferred 4,055,822 bytes, including six fonts, lazy editor/DOCX modules, and the English dictionary; every observed response succeeded. Ctrl+S exported a DOCX that reopened in 844 ms with the edit marker intact. There were no CSP violations, browser errors, failed requests, or document-level storage keys; UI preferences still use localStorage by design.
- The `edentext-vue@0.1.3` package remains unpublished; public `0.1.2` is unchanged. The stale earlier `0.1.3` tarball must not be published without rebuilding. Production builds still report large-chunk warnings.
- Runtime asset-base URL and i18n target are module singletons. Validation covers the normal single-editor Cloud Driver dialog; multiple simultaneously mounted Vue editors still need separate verification.

## License gate

The package is marked `AGPL-3.0-only`. The EdenText repository also describes commercial licensing for proprietary and hosted use. Resolve the license with the rights holder and qualified counsel before deploying this editor in the SaaS product. Package publication does not change its license; third-party font, dictionary and thesaurus notices also apply.
