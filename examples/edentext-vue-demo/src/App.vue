<script setup lang="ts">
import { ref } from 'vue';
import CloudDocxEditorDialog from './CloudDocxEditorDialog.vue';

const dialog = ref<InstanceType<typeof CloudDocxEditorDialog> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const notice = ref('');

function chooseDocx(): void {
  fileInput.value?.click();
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void dialog.value?.open(file);
}

function onSaved(kind: 'created' | 'version'): void {
  notice.value = kind === 'created'
    ? '已导出新建文档（demo 模拟云盘创建文件）'
    : '已导出编辑结果（demo 模拟上传新版本）';
  window.setTimeout(() => { notice.value = ''; }, 4000);
}
</script>

<template>
  <main class="demo-page">
    <section class="demo-card">
      <div class="brand-mark">E</div>
      <p class="eyebrow">EDENTEXT · VUE EMBED</p>
      <h1>云盘 DOCX 在线编辑示例</h1>
      <p class="intro">
        这个页面模拟 <code>CloudDocxEditorDialog.vue</code>：选择本地 DOCX 编辑，或新建空白文档；
        保存通过宿主 API 导出 DOCX 字节，再由 demo 下载文件。
      </p>

      <div class="actions">
        <button class="button button-primary" type="button" @click="chooseDocx">
          打开本地 DOCX
        </button>
        <button class="button button-secondary" type="button" @click="dialog?.openForCreate('新建文档.docx', 0, { spaceType: 'PERSONAL' })">
          新建空白 DOCX
        </button>
      </div>
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        @change="onFileChange"
      >

      <p class="demo-note">
        当前 demo 用浏览器下载模拟云盘“上传新版本/创建文件”；正式集成时替换成 CloudFile API 即可。
      </p>
      <Transition name="notice">
        <div v-if="notice" class="notice" role="status">{{ notice }}</div>
      </Transition>
    </section>

    <CloudDocxEditorDialog ref="dialog" @saved="onSaved" />
  </main>
</template>
