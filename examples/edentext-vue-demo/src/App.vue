<script setup lang="ts">
import { ref } from 'vue';
import { EdentextEditor, type EdentextEditorApi } from 'edentext-vue';
import 'edentext-vue/style.css';

const editor = ref<EdentextEditorApi | null>(null);

function onReady(api: EdentextEditorApi): void {
  editor.value = api;
}

function onError(error: Error): void {
  console.error('[edentext-vue-demo]', error);
}
</script>

<template>
  <!-- The demo owns only the host. Ribbon, editor, pagination, dialogs and status
       bar are rendered by EdenText's original App.svelte. -->
  <main class="demo-root">
    <EdentextEditor
      ref="editor"
      locale="zh-Hans"
      document-language="zh-CN"
      initial-new-document
      asset-base-url="/assets"
      @ready="onReady"
      @error="onError"
    />
  </main>
</template>
