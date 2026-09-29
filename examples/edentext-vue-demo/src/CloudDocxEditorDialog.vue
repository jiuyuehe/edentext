<script setup lang="ts">
import { computed, ref } from 'vue';
import { EdentextEditor, type EdentextEditorApi } from 'edentext-vue';

defineOptions({ name: 'CloudDocxEditorDialogDemo' });

interface CreateScope {
  spaceType?: 'PERSONAL' | 'DEPT' | 'PUBLIC';
  spaceId?: number;
}

type EditorMode = 'edit' | 'create';

const emit = defineEmits<{
  saved: [kind: 'created' | 'version'];
  closed: [];
}>();

const visible = ref(false);
const mode = ref<EditorMode>('edit');
const currentFile = ref<File | null>(null);
const createFileName = ref('');
const createParentId = ref(0);
const createScope = ref<CreateScope>({});
const documentBuffer = ref<ArrayBuffer | null>(null);
const editorApi = ref<EdentextEditorApi | null>(null);
const editorMounted = ref(false);
const editorKey = ref(0);
const loading = ref(false);
const loadError = ref('');
const saving = ref(false);
const saveSuccess = ref(false);
let loadRequestId = 0;

const isCreateMode = computed(() => mode.value === 'create');
const dialogTitle = computed(() => isCreateMode.value
  ? `新建 DOCX - ${createFileName.value || '新建文档.docx'}`
  : `在线编辑 DOCX - ${currentFile.value?.name || '-'}`);
const authorName = '演示用户';

async function open(file: File): Promise<void> {
  const requestId = ++loadRequestId;
  mode.value = 'edit';
  currentFile.value = file;
  createFileName.value = '';
  documentBuffer.value = null;
  editorApi.value = null;
  loadError.value = '';
  saveSuccess.value = false;
  loading.value = true;
  visible.value = true;
  editorMounted.value = true;
  editorKey.value += 1;

  try {
    const buffer = await file.arrayBuffer();
    if (requestId !== loadRequestId) return;
    documentBuffer.value = buffer;
    if (editorApi.value) await replaceInEditor(requestId);
  } catch (error) {
    if (requestId === loadRequestId) setLoadError(error);
  }
}

function openForCreate(fileName: string, parentId: number, scope: CreateScope = {}): void {
  loadRequestId += 1;
  mode.value = 'create';
  currentFile.value = null;
  createFileName.value = fileName;
  createParentId.value = parentId;
  createScope.value = { ...scope };
  documentBuffer.value = null;
  editorApi.value = null;
  loadError.value = '';
  saving.value = false;
  saveSuccess.value = false;
  loading.value = true;
  visible.value = true;
  editorMounted.value = true;
  editorKey.value += 1;
}

function onEditorReady(api: EdentextEditorApi): void {
  editorApi.value = api;
  api.setAuthor(authorName);
  if (isCreateMode.value) {
    loading.value = false;
    return;
  }
  if (documentBuffer.value) void replaceInEditor(loadRequestId);
}

async function replaceInEditor(requestId: number): Promise<void> {
  const api = editorApi.value;
  const buffer = documentBuffer.value;
  const file = currentFile.value;
  if (!api || !buffer || !file || requestId !== loadRequestId) return;

  loading.value = true;
  loadError.value = '';
  try {
    await api.replaceDocument(buffer, file.name);
    if (requestId === loadRequestId) loading.value = false;
  } catch (error) {
    if (requestId === loadRequestId) setLoadError(error);
  }
}

function onEditorError(error: Error): void {
  setLoadError(error);
}

function setLoadError(error: unknown): void {
  loadError.value = error instanceof Error ? error.message : '文档加载失败，请重试';
  loading.value = false;
}

async function retry(): Promise<void> {
  const requestId = ++loadRequestId;
  loadError.value = '';
  loading.value = true;
  if (isCreateMode.value) {
    editorApi.value = null;
    editorKey.value += 1;
    return;
  }
  if (!documentBuffer.value && currentFile.value) {
    try {
      documentBuffer.value = await currentFile.value.arrayBuffer();
    } catch (error) {
      if (requestId === loadRequestId) setLoadError(error);
      return;
    }
  }
  if (editorApi.value && documentBuffer.value) await replaceInEditor(requestId);
  else editorKey.value += 1;
}

async function handleSave(): Promise<void> {
  if (!editorApi.value || saving.value || saveSuccess.value) return;
  saving.value = true;
  try {
    const bytes = await editorApi.value.exportDocumentBytes('docx');
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const fileName = isCreateMode.value ? createFileName.value || '新建文档.docx' : currentFile.value?.name || '新建文档.docx';
    downloadDocx(new Blob([bytes], { type: mimeType }), fileName);
    if (isCreateMode.value) console.info('[demo cloud upload]', { fileName, parentId: createParentId.value, scope: createScope.value });
    saveSuccess.value = true;
    emit('saved', isCreateMode.value ? 'created' : 'version');
    window.setTimeout(close, 850);
  } catch (error) {
    setLoadError(error);
  } finally {
    saving.value = false;
  }
}

function downloadDocx(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function close(): void {
  loadRequestId += 1;
  visible.value = false;
  editorMounted.value = false;
  editorApi.value = null;
  documentBuffer.value = null;
  currentFile.value = null;
  loading.value = false;
  loadError.value = '';
  saveSuccess.value = false;
  emit('closed');
}

defineExpose({ open, openForCreate, close });
</script>

<template>
  <Teleport to="body">
    <Transition name="cloud-editor">
      <div v-if="visible" class="cloud-editor-backdrop" @click.self="close">
        <section class="cloud-editor-window" role="dialog" aria-modal="true" :aria-label="dialogTitle">
          <header class="cloud-editor-titlebar">
            <div class="title-group">
              <span class="title-icon">E</span>
              <div class="title-copy">
                <strong>{{ dialogTitle }}</strong>
                <span>{{ isCreateMode ? '新建文件' : '编辑云盘文件' }} · 保存由宿主接管</span>
              </div>
            </div>
            <div class="title-actions">
              <button class="save-button" type="button" :disabled="loading || saving || Boolean(loadError)" @click="handleSave">
                <span v-if="saving" class="button-spinner" />
                {{ saving ? '正在导出…' : isCreateMode ? '创建文件' : '保存新版本' }}
              </button>
              <button class="close-button" type="button" aria-label="关闭编辑器" @click="close">×</button>
            </div>
          </header>

          <div class="cloud-editor-body">
            <div v-if="editorMounted" class="editor-viewport">
              <EdentextEditor
                :key="editorKey"
                embedded
                initial-new-document
                locale="zh-Hans"
                document-language="zh-CN"
                :author="authorName"
                asset-base-url="/assets"
                class="editor-host"
                @ready="onEditorReady"
                @error="onEditorError"
                @save-request="handleSave"
              />
              <div v-if="loading || loadError" class="editor-state-layer">
                <div v-if="loadError" class="state-card error-card">
                  <span class="state-icon">!</span>
                  <strong>文档加载失败</strong>
                  <span>{{ loadError }}</span>
                  <button type="button" class="retry-button" @click="retry">重试</button>
                </div>
                <div v-else class="state-card">
                  <span class="large-spinner" />
                  <strong>正在加载文档…</strong>
                </div>
              </div>
              <div v-if="saveSuccess" class="editor-state-layer success-layer">
                <div class="state-card success-card">
                  <span class="success-icon">✓</span>
                  <strong>DOCX 已导出</strong>
                  <span>demo 已模拟云盘保存成功</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cloud-editor-backdrop {
  position: fixed;
  z-index: 4000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(20 28 38 / 56%);
  backdrop-filter: blur(5px);
}

.cloud-editor-window {
  display: flex;
  flex-direction: column;
  width: min(1280px, 100%);
  height: min(820px, 100%);
  min-height: 420px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 14px;
  background: #f7f8fa;
  box-shadow: 0 28px 90px rgb(14 24 36 / 34%);
}

.cloud-editor-titlebar {
  z-index: 1;
  display: flex;
  flex: 0 0 66px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 18px;
  border-bottom: 1px solid #e6e8ec;
  background: #fff;
}

.title-group,
.title-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  background: #e9eff5;
  color: #4c6c8a;
  font-weight: 800;
}

.title-copy { display: grid; gap: 3px; min-width: 0; }
.title-copy strong { overflow: hidden; color: #182230; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.title-copy span { color: #818a96; font-size: 11px; }

.save-button,
.retry-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 15px;
  border: 0;
  border-radius: 7px;
  background: #4c6c8a;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
}

.save-button:disabled { cursor: not-allowed; opacity: 0.55; }
.close-button { width: 32px; height: 32px; border: 0; border-radius: 7px; background: transparent; color: #657180; cursor: pointer; font-size: 23px; line-height: 1; }
.close-button:hover { background: #f1f3f5; }
.cloud-editor-body { display: grid; flex: 1; min-height: 0; overflow: hidden; }
.editor-viewport { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.editor-host { display: block; width: 100%; height: 100%; min-height: 0; }
.editor-state-layer { position: absolute; z-index: 10; inset: 0; display: grid; place-items: center; background: rgb(247 248 250 / 84%); backdrop-filter: blur(4px); }
.state-card { display: grid; justify-items: center; gap: 10px; max-width: min(420px, calc(100% - 36px)); color: #667180; text-align: center; font-size: 13px; }
.state-card strong { color: #293444; font-size: 15px; }
.state-card > span:not(.state-icon):not(.large-spinner):not(.success-icon) { line-height: 1.55; overflow-wrap: anywhere; }
.state-icon,.success-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 50%; background: #fff1ed; color: #c45d3b; font-size: 20px; font-weight: 800; }
.retry-button { margin-top: 4px; }
.large-spinner,.button-spinner { display: block; width: 27px; height: 27px; border: 3px solid #dbe3eb; border-top-color: #4c6c8a; border-radius: 50%; animation: spin 0.8s linear infinite; }
.button-spinner { width: 13px; height: 13px; border-width: 2px; border-color: rgb(255 255 255 / 36%); border-top-color: #fff; }
.success-layer { background: rgb(247 248 250 / 91%); }
.success-icon { background: #e8f6ec; color: #25824a; font-size: 22px; }
.success-card strong { color: #25824a; }
.cloud-editor-enter-active,.cloud-editor-leave-active { transition: opacity 0.16s ease; }
.cloud-editor-enter-active .cloud-editor-window,.cloud-editor-leave-active .cloud-editor-window { transition: transform 0.16s ease; }
.cloud-editor-enter-from,.cloud-editor-leave-to { opacity: 0; }
.cloud-editor-enter-from .cloud-editor-window,.cloud-editor-leave-to .cloud-editor-window { transform: translateY(9px) scale(0.99); }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .cloud-editor-backdrop { padding: 0; }
  .cloud-editor-window { width: 100%; height: 100%; min-height: 0; border-radius: 0; }
  .cloud-editor-titlebar { flex-basis: 58px; padding: 0 11px; }
  .title-icon { display: none; }
  .title-copy span { display: none; }
  .save-button { padding: 0 10px; }
}
</style>
