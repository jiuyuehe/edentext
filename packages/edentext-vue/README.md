# edentext-vue

Vue 3 thin wrapper for the original EdenText browser editor. It mounts the
native EdenText UI and exposes host commands for open/replace, byte export,
save requests, author identity, and language settings. It does not recreate the
toolbar or expose TipTap, ProseMirror or Svelte APIs.

```vue
<script setup lang="ts">
import { EdentextEditor } from 'edentext-vue';
import 'edentext-vue/style.css';
</script>

<template>
  <div style="height: 100vh">
    <EdentextEditor
      locale="zh-Hans"
      document-language="zh-CN"
      embedded
      initial-new-document
      asset-base-url="/edentext-assets"
    />
  </div>
</template>
```

Copy the package's `dist/assets/*` into `/edentext-assets` (or another static
directory) and set `asset-base-url` to that path. The package scopes its editor
CSS and theme to the host container. `embedded` hides native file actions and
emits `save-request` when the user presses Ctrl/Cmd+S.

The package is browser-only, supports Vue 3, contains no React entry or React
dependency, and is licensed under AGPL-3.0-only. See the repository guide at
[`docs/edentext-vue.md`](../../docs/edentext-vue.md) for the complete API and
npm publishing workflow.
