# Cloud Driver EdenText Vue migration

**Status:** The EdenText Vue branch and package bridge are implemented. The Cloud Driver dialog and local tarball integration are implemented in the working tree. Cloud Driver type/build verification and authenticated end-to-end checks remain pending.
**Updated:** 2026-10-09

## Branch layout

The fork keeps the existing `main`, `main-new` and `foryly` branches unchanged. Two branches establish the ongoing upstream workflow:

| Branch | Purpose | Current state |
|---|---|---|
| `upstream-main` | Exact mirror of `stffnb/edentext:main`; no local commits | At `c98c48a096ad603eed42f0fb0b4ee7db141d9a66`, pushed to the fork |
| `vue-component` | Vue host and package changes based on the current upstream main | Two commits ahead of upstream; local implementation tip `e7077f16`; push pending |

The Vue changes were ported in order from `e0ad1d0f` and `02d647d3`, then reconciled against the latest upstream implementation. Old branch work was not merged wholesale. The old `main`, `main-new` and `foryly` refs remain available as historical references.

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

Cloud Driver currently references `file:../../../edentext/output/edentext-vue-0.1.0.tgz`. This works for the present sibling checkout layout and is only a local development dependency. The tarball is ignored build output, so this path is not suitable for a clean CI checkout or other developers. Before sharing or deploying the Cloud Driver change, choose an approved private registry or a CI-accessible package artifact and update the manifest and lockfiles. Do not publish publicly until the release owner approves the package and licensing path.

## Verification status

Completed in EdenText:

- `npm run check`
- `npm run check:lib`
- `npm test` — 229 files passed, 5 skipped; 1,487 tests passed, 28 skipped
- `npm run build:demo:vue`
- `npm run build:app`
- `npm pack ./packages/edentext-vue --dry-run` and a local tarball pack

Still required:

- Cloud Driver `pnpm ts:check` and a production build.
- Browser checks using real cloud credentials: edit and upload a new version, create and upload a template, retry after failure, switch documents quickly, verify no browser download on host save, and open/close the standalone Tauri window.
- Check runtime requests and fonts under the deployed web base path and the Tauri `/` base path.
- Inspect representative DOCX files containing tables, images, headers/footers and page layout. Record any import/export differences before rollout.

## License gate

The package is marked `AGPL-3.0-only`. The EdenText repository also describes commercial licensing for proprietary and hosted use. Resolve the license with the rights holder and qualified counsel before deploying this editor in the SaaS product. Package publication does not change its license; third-party font, dictionary and thesaurus notices also apply.
