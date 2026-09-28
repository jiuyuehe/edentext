# edentext-vue

Vue 3 thin wrapper for the original EdenText browser editor. It mounts the
native EdenText UI and exposes only host commands such as new, open, save as,
UI language and document language. It does not recreate the toolbar and does
not expose TipTap, ProseMirror or Svelte APIs.

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
      initial-new-document
      asset-base-url="/edentext-assets"
    />
  </div>
</template>
```

The package is browser-only, supports Vue 3, contains no React entry or React
dependency, and is licensed under AGPL-3.0-only. See the repository guide at
[`docs/edentext-vue.md`](../../docs/edentext-vue.md) for the complete API and
npm publishing workflow.
