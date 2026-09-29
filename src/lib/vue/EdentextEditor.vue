<script setup lang="ts">
import { mount, unmount } from 'svelte';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import NativeEdenTextApp from '../../App.svelte';
import '../../styles/global.css';
import { startNativeApp } from '../native/bootstrap';
import { setRuntimeAssetBaseUrl } from '../runtimeAssets';
import type { NativeEdenTextApi } from '../native/types';
import type { EdentextEditorApi, EdentextEditorProps } from './types';

const props = defineProps<EdentextEditorProps>();
const emit = defineEmits<{
  ready: [api: EdentextEditorApi];
  error: [error: Error];
  saveRequest: [];
}>();

const host = ref<HTMLElement | null>(null);
let nativeComponent: unknown = null;
let nativeApi: NativeEdenTextApi | null = null;
let publicApi: EdentextEditorApi | null = null;
let stopNativeApp: (() => void) | null = null;

function destroy(): void {
  if (nativeComponent) {
    void unmount(nativeComponent as never);
    nativeComponent = null;
  }
  nativeApi = null;
  publicApi = null;
}

function onNativeReady(api: NativeEdenTextApi): void {
  nativeApi = api;
  publicApi = {
    ...api,
    destroy,
  };
  emit('ready', publicApi);
}

function requireApi(): NativeEdenTextApi {
  if (!nativeApi) throw new Error('EdenText is not ready yet');
  return nativeApi;
}

onMounted(() => {
  if (!host.value) return;
  setRuntimeAssetBaseUrl(props.assetBaseUrl);
  stopNativeApp = startNativeApp(host.value);
  try {
    nativeComponent = mount(NativeEdenTextApp, {
      target: host.value,
      props: {
        initialUiLocale: props.locale,
        initialDocumentLanguage: props.documentLanguage,
        initialNewDocument: props.initialNewDocument,
        embedded: props.embedded,
        author: props.author,
        assetBaseUrl: props.assetBaseUrl,
        themeTarget: host.value,
        onSaveRequest: () => emit('saveRequest'),
        onReady: onNativeReady,
      },
    });
  } catch (error) {
    emit('error', error instanceof Error ? error : new Error(String(error)));
  }
});

watch(() => props.locale, (value, previous) => {
  if (value && value !== previous) nativeApi?.setUiLocale(value);
});

watch(() => props.documentLanguage, (value, previous) => {
  if (value && value !== previous) nativeApi?.setDocumentLanguage(value);
});

watch(() => props.author, (value, previous) => {
  if (value !== previous && value !== undefined) nativeApi?.setAuthor(value);
});

onBeforeUnmount(() => {
  destroy();
  stopNativeApp?.();
  stopNativeApp = null;
  setRuntimeAssetBaseUrl(undefined);
});

defineExpose<EdentextEditorApi>({
  newDocument: () => requireApi().newDocument(),
  openFile: () => requireApi().openFile(),
  openDocument: (source, filename) => requireApi().openDocument(source, filename),
  replaceDocument: (source, filename) => requireApi().replaceDocument(source, filename),
  save: () => requireApi().save(),
  saveAs: (format) => requireApi().saveAs(format),
  exportDocument: (format) => requireApi().exportDocument(format),
  exportDocumentBytes: (format) => requireApi().exportDocumentBytes(format),
  setAuthor: (name) => requireApi().setAuthor(name),
  setUiLocale: (locale) => requireApi().setUiLocale(locale),
  setDocumentLanguage: (language) => requireApi().setDocumentLanguage(language),
  focus: () => requireApi().focus(),
  destroy,
});
</script>

<template>
  <div ref="host" class="edentext-vue-host"></div>
</template>

<style>
.edentext-vue-host {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
