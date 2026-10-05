import { app, BrowserWindow, dialog, Menu, net, protocol, shell } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// One fixed secure origin keeps localStorage across launches and lets the
// File System Access API run, so saveFile.ts needs no desktop branch.
const ORIGIN = 'app://edentext';
const ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : fileURLToPath(new URL('../dist', import.meta.url));

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// The native dialogs follow the system language, mapped like the app's first-run locale
// (resolveBrowserLocale). app.getLocale() is only filled once the app is ready.
const TEXT = {
  en: { discard: 'Discard unsaved changes?', discardButtons: ['Discard', 'Cancel'], available: (v) => `EdenText ${v} is available.`, installed: (v) => `You have ${v}.`, updateButtons: ['Download', 'Later', 'Skip This Version'], menu: ['About %', 'Hide %', 'Hide Others', 'Show All', 'Quit %', 'Edit', 'Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select All', 'Window', 'Minimize', 'Zoom', 'Close'] },
  de: { discard: 'Ungespeicherte Änderungen verwerfen?', discardButtons: ['Verwerfen', 'Abbrechen'], available: (v) => `EdenText ${v} ist verfügbar.`, installed: (v) => `Installiert ist ${v}.`, updateButtons: ['Herunterladen', 'Später', 'Diese Version überspringen'], menu: ['Über %', '% ausblenden', 'Andere ausblenden', 'Alle einblenden', '% beenden', 'Bearbeiten', 'Widerrufen', 'Wiederholen', 'Ausschneiden', 'Kopieren', 'Einsetzen', 'Alles auswählen', 'Fenster', 'Im Dock ablegen', 'Zoomen', 'Schließen'] },
  es: { discard: '¿Descartar los cambios sin guardar?', discardButtons: ['Descartar', 'Cancelar'], available: (v) => `EdenText ${v} está disponible.`, installed: (v) => `Versión instalada: ${v}.`, updateButtons: ['Descargar', 'Más tarde', 'Omitir esta versión'], menu: ['Acerca de %', 'Ocultar %', 'Ocultar otros', 'Mostrar todo', 'Salir de %', 'Edición', 'Deshacer', 'Rehacer', 'Cortar', 'Copiar', 'Pegar', 'Seleccionar todo', 'Ventana', 'Minimizar', 'Zoom', 'Cerrar'] },
  fr: { discard: 'Abandonner les modifications non enregistrées ?', discardButtons: ['Abandonner', 'Annuler'], available: (v) => `EdenText ${v} est disponible.`, installed: (v) => `Version installée : ${v}.`, updateButtons: ['Télécharger', 'Plus tard', 'Ignorer cette version'], menu: ['À propos de %', 'Masquer %', 'Masquer les autres', 'Tout afficher', 'Quitter %', 'Édition', 'Annuler', 'Rétablir', 'Couper', 'Copier', 'Coller', 'Tout sélectionner', 'Fenêtre', 'Placer dans le Dock', 'Réduire/agrandir', 'Fermer'] },
  pt: { discard: 'Descartar as alterações não guardadas?', discardButtons: ['Descartar', 'Cancelar'], available: (v) => `O EdenText ${v} está disponível.`, installed: (v) => `Versão instalada: ${v}.`, updateButtons: ['Transferir', 'Mais tarde', 'Ignorar esta versão'], menu: ['Acerca do %', 'Ocultar %', 'Ocultar outros', 'Mostrar tudo', 'Sair do %', 'Edição', 'Desfazer', 'Refazer', 'Cortar', 'Copiar', 'Colar', 'Selecionar tudo', 'Janela', 'Minimizar', 'Zoom', 'Fechar'] },
  el: { discard: 'Απόρριψη των μη αποθηκευμένων αλλαγών;', discardButtons: ['Απόρριψη', 'Ακύρωση'], available: (v) => `Το EdenText ${v} είναι διαθέσιμο.`, installed: (v) => `Έχετε την έκδοση ${v}.`, updateButtons: ['Λήψη', 'Αργότερα', 'Παράλειψη αυτής της έκδοσης'], menu: ['Σχετικά με το %', 'Απόκρυψη %', 'Απόκρυψη άλλων', 'Εμφάνιση όλων', 'Τερματισμός %', 'Επεξεργασία', 'Αναίρεση', 'Επανάληψη', 'Αποκοπή', 'Αντιγραφή', 'Επικόλληση', 'Επιλογή όλων', 'Παράθυρο', 'Ελαχιστοποίηση', 'Ζουμ', 'Κλείσιμο'] },
  ru: { discard: 'Отказаться от несохранённых изменений?', discardButtons: ['Отказаться', 'Отмена'], available: (v) => `Доступна версия EdenText ${v}.`, installed: (v) => `Установлена версия ${v}.`, updateButtons: ['Скачать', 'Позже', 'Пропустить эту версию'], menu: ['О программе %', 'Скрыть %', 'Скрыть остальные', 'Показать все', 'Завершить %', 'Правка', 'Отменить', 'Повторить', 'Вырезать', 'Скопировать', 'Вставить', 'Выбрать все', 'Окно', 'Свернуть', 'Изменить масштаб', 'Закрыть'] },
  uk: { discard: 'Відкинути незбережені зміни?', discardButtons: ['Відкинути', 'Скасувати'], available: (v) => `Доступна версія EdenText ${v}.`, installed: (v) => `Встановлено версію ${v}.`, updateButtons: ['Завантажити', 'Пізніше', 'Пропустити цю версію'], menu: ['Про %', 'Сховати %', 'Сховати інші', 'Показати всі', 'Вийти з %', 'Редагування', 'Відмінити', 'Повторити', 'Вирізати', 'Скопіювати', 'Вставити', 'Вибрати все', 'Вікно', 'Згорнути', 'Масштаб', 'Закрити'] },
  ja: { discard: '保存されていない変更を破棄しますか?', discardButtons: ['破棄', 'キャンセル'], available: (v) => `EdenText ${v} が利用可能です。`, installed: (v) => `インストール済みのバージョン: ${v}`, updateButtons: ['ダウンロード', '後で', 'このバージョンをスキップ'], menu: ['%について', '%を非表示', 'ほかを非表示', 'すべてを表示', '%を終了', '編集', '取り消す', 'やり直す', 'カット', 'コピー', 'ペースト', 'すべてを選択', 'ウインドウ', 'しまう', '拡大/縮小', '閉じる'] },
  'zh-Hans': { discard: '放弃未保存的更改？', discardButtons: ['放弃', '取消'], available: (v) => `EdenText ${v} 已发布。`, installed: (v) => `当前版本：${v}`, updateButtons: ['下载', '稍后', '跳过此版本'], menu: ['关于%', '隐藏%', '隐藏其他', '全部显示', '退出%', '编辑', '撤销', '重做', '剪切', '拷贝', '粘贴', '全选', '窗口', '最小化', '缩放', '关闭'] },
  'zh-Hant': { discard: '放棄未儲存的變更？', discardButtons: ['放棄', '取消'], available: (v) => `EdenText ${v} 已推出。`, installed: (v) => `目前版本：${v}`, updateButtons: ['下載', '稍後', '略過此版本'], menu: ['關於%', '隱藏%', '隱藏其他', '顯示全部', '結束%', '編輯', '還原', '重做', '剪下', '拷貝', '貼上', '全選', '視窗', '縮到最小', '縮放', '關閉'] },
};
// macOS needs a menu for its standard shortcuts; elsewhere the ribbon has every command and
// Chromium handles the editing keys itself. Labels: menu in TEXT, % for the app name.
function setMenu() {
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null);
  const [about, hide, hideOthers, showAll, quit, edit, undo, redo, cut, copy, paste, selectAll, window, minimize, zoom, close] =
    text().menu.map((l) => l.replace('%', app.name));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: 'about', label: about }, { type: 'separator' },
      { role: 'hide', label: hide }, { role: 'hideOthers', label: hideOthers }, { role: 'unhide', label: showAll },
      { type: 'separator' }, { role: 'quit', label: quit },
    ] },
    { label: edit, submenu: [
      { role: 'undo', label: undo }, { role: 'redo', label: redo }, { type: 'separator' },
      { role: 'cut', label: cut }, { role: 'copy', label: copy }, { role: 'paste', label: paste }, { role: 'selectAll', label: selectAll },
    ] },
    { label: window, submenu: [{ role: 'minimize', label: minimize }, { role: 'zoom', label: zoom }, { role: 'close', label: close }] },
  ]));
}

function text() {
  const tag = app.getLocale().toLowerCase();
  if (tag === 'zh' || tag.startsWith('zh-')) return TEXT[/^zh-(hant|tw|hk|mo)\b/.test(tag) ? 'zh-Hant' : 'zh-Hans'];
  return TEXT[tag.slice(0, 2)] ?? TEXT.en;
}

// Points at a newer release instead of installing it: an unsigned macOS app cannot
// update itself. Offline or rate-limited, the app simply starts without asking.
const RELEASES = 'https://github.com/stffnb/edentext/releases/latest';
// The one release the user chose to skip; the next one asks again.
const skippedFile = () => path.join(app.getPath('userData'), 'skipped-version');
const skipped = () => { try { return readFileSync(skippedFile(), 'utf8'); } catch { return ''; } };
async function checkForUpdate(win) {
  if (!app.isPackaged) return;
  const res = await net.fetch('https://api.github.com/repos/stffnb/edentext/releases/latest');
  if (!res.ok) return;
  const latest = String((await res.json()).tag_name ?? '').replace(/^v/, '');
  if (latest === skipped() || latest.localeCompare(app.getVersion(), undefined, { numeric: true }) <= 0) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    message: text().available(latest),
    detail: text().installed(app.getVersion()),
    buttons: text().updateButtons,
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) void shell.openExternal(RELEASES);
  if (response === 2) writeFileSync(skippedFile(), latest);
}

function createWindow() {
  const win = new BrowserWindow({ width: 1280, height: 900, title: 'EdenText' });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${ORIGIN}/`)) return { action: 'allow' };
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // A file dropped outside the editor would otherwise replace the app.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) e.preventDefault();
  });
  // The page's beforeunload guard blocks closing silently; ask instead.
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, { type: 'question', message: text().discard, buttons: text().discardButtons, defaultId: 1, cancelId: 1 });
    if (choice === 0) e.preventDefault();
  });
  void win.loadURL(`${ORIGIN}/index.html`);
  win.webContents.once('did-finish-load', () => checkForUpdate(win).catch(() => {}));
}

app.whenReady().then(() => {
  setMenu();
  protocol.handle('app', (req) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url).pathname));
    if (!file.startsWith(ROOT)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
