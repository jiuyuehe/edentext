// Browser DOM run: the layout the vitest suite cannot see. A corpus document is
// opened and its pagination watched through a settle, a reload, a zoom and an edit —
// the page count is what every layer on the page is measured against. Fails on any
// uncaught page error.
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { ROOT, MOD, checker, previewServer, openApp, settle } from '../browser.mjs';

const PORT = +(process.env.DOM_PORT ?? 4185);
const { check, failures } = checker();
const server = await previewServer(PORT);
const { browser, page, pageErrors } = await openApp(PORT);

// "Page 1 of 4" in the status bar is the editor's own count, after its settle loop.
const pageCount = () => page.evaluate(() => {
  const m = /of (\d+)/.exec(document.querySelector('.statusbar')?.textContent ?? '');
  return m ? +m[1] : 0;
});
const settled = async (want) => {
  await page.waitForFunction((n) => {
    const m = /of (\d+)/.exec(document.querySelector('.statusbar')?.textContent ?? '');
    return m && (n ? +m[1] === n : +m[1] > 1);
  }, want, { timeout: 30_000 }).catch(() => {});
  return pageCount();
};

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });

  // What the browser asks before closing the tab: a beforeunload nobody cancels lets it go.
  const holdsOn = () => page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  check(!(await holdsOn()), 'an empty document lets the tab close');

  // Save on a document with no file behind it settles the format first: the download
  // route cannot read one back from the browser's own dialog.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await page.click('.tiptap');
  await page.keyboard.type('Format first');
  check(await holdsOn(), 'a document that was never saved warns before the tab closes');
  await page.keyboard.press(`${MOD}+s`);
  const [firstSave] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.locator('dialog[open] button', { hasText: '(.docx)' }).first().click(),
  ]);
  check(firstSave.suggestedFilename().endsWith('.docx'),
    `Ctrl+S on an unsaved document asks for the format (${firstSave.suggestedFilename()})`);
  check(!(await holdsOn()), 'the saved document lets the tab close again');

  // A multi-page corpus document, through the file input (no picker in headless).
  await page.setInputFiles('input.file-input[accept*=".odt"]', join(ROOT, 'tests/corpus/05-breaks.odt'));
  await page.waitForFunction(() => (document.querySelector('.tiptap')?.textContent ?? '').length > 200,
    null, { timeout: 30_000 });
  const opened = await settled();
  check(opened > 1, `corpus document opens and paginates (${opened} pages)`);

  // The settle loop re-measures for a while after the last change; the count it lands
  // on has to be the one it keeps.
  await page.waitForTimeout(2000);
  const still = await pageCount();
  check(still === opened, `the page count holds still after the settle (${opened} → ${still})`);

  // The same document out of the autosave paginates the same way.
  await page.waitForFunction(() => (localStorage.getItem('edentext-doc') ?? '').length > 1000,
    null, { timeout: 15_000 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  const restored = await settled(opened);
  check(restored === opened, `the restored document keeps its page count (${restored})`);

  // Zoom is a transform over the same layout, so it must not move a page break.
  await page.evaluate(() => localStorage.setItem('edentext-zoom', '50'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  const zoomed = await settled(opened);
  check(zoomed === opened, `zooming out keeps the page count (${zoomed} at 50%)`);
  await page.evaluate(() => localStorage.setItem('edentext-zoom', '100'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settled(opened);

  // A language for all text rewrites every block's attrs, the blocks on both sides of each
  // page break included; the breaks have to stay where they were, and through the undo.
  // Kept-together paragraphs break between blocks, and a language of their own first
  // gives clearing it something to change. Every step is undone again after.
  const breaks = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-page-break-spacer]'),
    (s) => Math.round(s.getBoundingClientRect().top)).join(','));
  // A slow runner may still be paginating after a fixed pause: read until two reads agree.
  const relabel = async (how) => {
    await page.evaluate(how);
    await page.waitForTimeout(1500);
    let prev, cur = await breaks();
    for (let i = 0; i < 20 && cur !== prev; i++) { await page.waitForTimeout(750); [prev, cur] = [cur, await breaks()]; }
    return cur;
  };
  const undo = () => document.querySelector('.tiptap').editor.commands.undo();
  const breaksKept = await relabel(() => document.querySelector('.tiptap').editor.chain()
    .selectAll().updateAttributes('paragraph', { keepLines: true }).setTextSelection(1).run());
  const breaksLabelled = await relabel(() => document.querySelector('.tiptap').editor.chain()
    .selectAll().setBlockLanguage('fr-FR').setTextSelection(1).run());
  // The caret stays at the top, and the view scrolled away from it stays where it is.
  const scrolled = () => page.evaluate(() => Math.round(document.querySelector('.editor').scrollTop));
  await page.evaluate(() => { const ed = document.querySelector('.editor'); ed.scrollTop = ed.scrollHeight; });
  const scrollBefore = await scrolled();
  await page.locator('.statusbar .lang-picker select').selectOption('doc:de');
  await page.waitForTimeout(300);
  const scrollAfter = await scrolled();
  await page.evaluate(() => { document.querySelector('.editor').scrollTop = 0; });
  const breaksCleared = await relabel(() => {});
  const breaksUndone = await relabel(undo);
  check(breaksKept.includes(',') && [breaksLabelled, breaksCleared, breaksUndone].every((b) => b === breaksKept),
    `a language for all text keeps the page breaks (${breaksKept} → ${breaksLabelled} → ${breaksCleared} → ${breaksUndone})`);
  check(scrollBefore > 0 && scrollAfter === scrollBefore,
    `a language for all text leaves the view where it was (scrollTop ${scrollBefore} → ${scrollAfter})`);
  await page.evaluate(undo);
  await page.evaluate(undo);
  await settled(opened);

  // The caret is placed through the editor: a click lands wherever the element's centre
  // happens to be. The focus itself arrives on the next animation frame, so a key sent
  // before it is lost — wait for it.
  const caretTo = async (pos) => {
    await page.evaluate((p) => document.querySelector('.tiptap').editor.commands.focus(p), pos);
    await page.waitForFunction(() => document.activeElement === document.querySelector('.tiptap'), null, { timeout: 5000 });
  };
  const firstParagraphEnd = () => page.evaluate(() => document.querySelector('.tiptap').editor.state.doc.firstChild.nodeSize - 1);

  // A page break after the first paragraph pushes the rest down a page, and undo takes
  // it back. (A break before the empty last paragraph yields no page.)
  await caretTo(await firstParagraphEnd());
  await page.keyboard.press(`${MOD}+Enter`);
  const broken = await settled(opened + 1);
  await caretTo('end');
  await page.keyboard.press(`${MOD}+z`);
  const undone = await settled(opened);
  check(broken === opened + 1 && undone === opened,
    `a page break adds a page and undo takes it back (${opened} → ${broken} → ${undone})`);

  // The unsaved dot: an edit raises it, an undo back to the saved text clears it
  // again (it is a checksum, not the document's identity), and so does opening a file.
  // It follows on the next idle beat, so wait for the state rather than a fixed pause.
  const dot = async (want) => {
    await page.waitForFunction((w) => !!document.querySelector('.doc-dirty') === w, want, { timeout: 10_000 })
      .catch(() => {});
    return page.evaluate(() => !!document.querySelector('.doc-dirty'));
  };
  await caretTo('end');
  await page.keyboard.type('nachtrag');
  const marked = await dot(true);
  await page.keyboard.press(`${MOD}+z`);
  const backToSaved = await dot(false);
  await page.setInputFiles('input.file-input[accept*=".odt"]', join(ROOT, 'tests/corpus/04-table.odt'));
  await page.waitForFunction(() => document.querySelector('.tiptap table td')?.textContent.trim(),
    null, { timeout: 30_000 });
  const opened2 = await dot(false);
  check(marked && !backToSaved && !opened2,
    `the dot follows the text (edit: ${marked}, undone: ${backToSaved}, after open: ${opened2})`);

  // The page setup is in the file too, so a margin preset marks it as much as text does.
  await page.locator('.ribbon-tab', { hasText: 'Layout' }).first().click();
  await page.locator('.rb-label', { hasText: 'Margins' }).first().click();
  await page.locator('.ribbon-menu button', { hasText: 'Narrow' }).first().click();
  const afterMargins = await dot(true);
  check(afterMargins, `a margin preset marks the document unsaved (${afterMargins})`);

  // And so does the name the file is saved under. The file comes back in first, so the
  // rename is the only thing standing between the document and its clean state.
  await page.setInputFiles('input.file-input[accept*=".odt"]', join(ROOT, 'tests/corpus/04-table.odt'));
  await page.waitForFunction(() => document.querySelector('.tiptap table td')?.textContent.trim(),
    null, { timeout: 30_000 });
  const reopened = await dot(false);
  await page.fill('.doc-name-input', 'Umbenannt');
  const afterRename = await dot(true);
  check(!reopened && afterRename, `a rename marks the document unsaved (${afterRename})`);

  // Without the File System Access API (Brave ships with it off) a save is a download, so
  // the format is settled before the bytes are built: Save As (.docx) hands over a DOCX
  // whatever the browser's dialog does with the name.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await page.click('.ribbon-tab-file');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.locator('.ribbon-menu button', { hasText: '(.docx)' }).first().click(),
  ]);
  const saved = await readFile(await download.path());
  const isDocx = saved[0] === 0x50 && saved[1] === 0x4b && saved.includes('word/document.xml');
  check(isDocx, `Save As (.docx) without a picker downloads a DOCX (${download.suggestedFilename()}, ${saved.length} bytes)`);

  // The whole margin band is the zone's double-click target, and an empty zone's
  // placeholder sits where the first typed character lands — not a line below it.
  await page.keyboard.press('Escape');
  await page.locator('.hf-zone.hf-footer').first().scrollIntoViewIfNeeded();
  const fb = await page.locator('.hf-zone.hf-footer').first().boundingBox();
  await page.mouse.dblclick(fb.x - 40, fb.y + fb.height + 20);
  await page.waitForSelector('.hf-active.hf-footer .tiptap', { timeout: 5000 });
  check(true, 'a double-click below and left of the footer zone still opens it');
  const lineTop = () => page.evaluate(() => document.querySelector('.hf-active .tiptap p').getBoundingClientRect().top);
  const emptyTop = await lineTop();
  await page.keyboard.type('x');
  const typedTop = await lineTop();
  check(Math.abs(emptyTop - typedTop) < 1,
    `the footer placeholder sits on the typed line (${emptyTop.toFixed(1)} → ${typedTop.toFixed(1)})`);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');

  // The header/footer switches live in the ribbon's Insert tab. A ticked "different
  // first page" makes page 1 a second zone, so what is typed there lands beside the
  // running one — and the distance travels to the app's own storage.
  await page.keyboard.press('Escape');
  await page.locator('.ribbon-tab', { hasText: 'Insert' }).first().click();
  const hfOptions = page.locator('button.rb', { hasText: 'Options' }).first();
  await hfOptions.click();
  await page.locator('.ribbon-menu .check-row input').first().check();
  const dist = page.locator('.ribbon-menu .num-row input').first();
  await dist.fill('1.8');
  await dist.dispatchEvent('change');
  await hfOptions.click();
  const zone = page.locator('.hf-zone.hf-header').first();
  await zone.dblclick({ timeout: 5000 }).catch(() => zone.dispatchEvent('dblclick'));
  await page.waitForSelector('.hf-active .tiptap', { timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.closest?.('.hf-active'), null, { timeout: 5000 });
  await page.keyboard.type('Titelseite');
  // A zone opened empty starts on the centre/right stops, so name-tab-tab-number is one
  // line with the number on the right margin. Measured: a pass that read its own advance
  // back off the DOM counted it twice and broke the second tab onto a line of its own.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('7');
  await page.waitForTimeout(1500);
  const head = await page.evaluate(() => {
    const p = document.querySelector('.hf-active .tiptap p');
    const r = p.getBoundingClientRect();
    const last = document.createRange();
    last.setStart(p, p.childNodes.length - 1);
    last.setEnd(p, p.childNodes.length);
    const num = last.getBoundingClientRect();
    return { height: r.height, gap: r.right - num.right, stops: p.getAttribute('data-tab-stops') };
  });
  check(head.height < 25 && Math.abs(head.gap) < 4,
    `two tabs in a running head stay on its line, the number on the right margin (height ${head.height.toFixed(1)}px, gap ${head.gap.toFixed(1)}px, stops ${head.stops})`);
  await page.locator('.hf-bar-done').click();
  const hf = await page.evaluate(() => ({
    first: localStorage.getItem('edentext-hf-different-first'),
    running: localStorage.getItem('edentext-header'),
    firstPage: localStorage.getItem('edentext-header-first') ?? '',
    dist: localStorage.getItem('edentext-hf-distances') ?? '',
  }));
  check(hf.first === 'true' && !hf.running && hf.firstPage.includes('Titelseite') && /"header":1.8/.test(hf.dist),
    `the ribbon's header/footer switches reach the document (first page: ${hf.first}, running zone: ${hf.running}, distances: ${hf.dist})`);

  // Typing latency in a long document. A keystroke at the top moves every page break
  // below it, so this is where a whole-document pass costs the most: blocked main-thread
  // time per keystroke in a burst, then the pass that follows the burst.
  const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
  const long = { type: 'doc', content: [] };
  for (let i = 0; i < 1600; i++) {
    let s = '';
    for (let k = i; s.length < 300; k++) s += LOREM[k % LOREM.length] + ' ';
    long.content.push({ type: 'paragraph', content: [{ type: 'text', text: s.trim() }] });
  }
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), long);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settle(page, true);
  const longPages = await pageCount();
  // How long the page holds the thread: a zero timeout resolves once it is free again.
  const blocked = async () => {
    const t = performance.now();
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    return performance.now() - t;
  };
  await caretTo(1);
  const keys = [];
  for (const ch of 'The quick brown fox jumps') {
    const t = performance.now();
    await page.keyboard.type(ch);
    await blocked();
    keys.push(performance.now() - t);
  }
  // A split always moves the blocks below, so the pause after it holds a whole-document
  // pass: what a layout costs, recorded for the day it goes incremental.
  await page.keyboard.press('Enter');
  let pass = 0;
  for (const until = Date.now() + 4000; Date.now() < until;) pass = Math.max(pass, await blocked());
  keys.sort((a, b) => a - b);
  const keyMedian = Math.round(keys[keys.length >> 1]);
  const keyP90 = Math.round(keys[Math.floor(keys.length * 0.9)]);
  const keyMax = Math.round(keys[keys.length - 1]);
  // Typing feels fluid under ~100 ms a key, but the three engines are that far apart on this
  // document (Gecko ~20, Blink ~40, WebKit ~55 on a laptop) and a CI runner is about twice a
  // laptop, so each gets double what CI measures — a regression here is a multiple, not a few %.
  const BUDGET = { chromium: 160, firefox: 120, webkit: 240 }[process.env.BROWSER ?? 'chromium'] ?? 240;
  // The budget is the 90th percentile, not the worst key: the first stroke of a burst warms
  // caches and a shared runner stalls once in a while, neither of which the typist feels.
  check(longPages > 100 && keyMedian < BUDGET && keyP90 < BUDGET * 1.5,
    `typing at the top of a ${longPages}-page document: ${keyMedian} ms per keystroke (p90 ${keyP90}, max ${keyMax}, budget ${BUDGET}), ${Math.round(pass)} ms pass after a split`);
  // A letter typed and taken back leaves every block as tall as it was, so no pass runs
  // (a pass that moves something ends in a pm-pagecount event), and the pause costs no more
  // than a key (the engine's budget): the spell checker re-reads the edited paragraph only.
  await page.evaluate(() => {
    window.__passes = 0;
    document.querySelector('.tiptap').addEventListener('pm-pagecount', () => { window.__passes++; });
  });
  await page.keyboard.type('x');
  await blocked();
  await page.keyboard.press('Backspace');
  let idle = 0;
  for (const until = Date.now() + 1500; Date.now() < until;) idle = Math.max(idle, await blocked());
  const passes = await page.evaluate(() => window.__passes);
  check(passes === 0 && idle < BUDGET,
    `a letter typed and taken back runs no pass and its pause is free (${passes} passes, ${Math.round(idle)} ms blocked at most)`);

  // A pass that lands the layout the last one did announces nothing: every reader of the
  // event re-reads the whole document from it — the index its page numbers, the header
  // band its geometry — and a redundant round would set them all going again.
  await page.evaluate(() => {
    window.__passes = 0;
    const editor = document.querySelector('.tiptap').editor;
    editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false).setMeta('forcePageBreakRecalc', true));
  });
  for (const until = Date.now() + 1500; Date.now() < until;) await blocked();
  const quiet = await page.evaluate(() => window.__passes);
  check(quiet === 0, `a recalc that finds the same layout announces no page count (${quiet} events)`);

  // The block after a band-wrapped frame clears it; one after a page-anchored frame does
  // not. Keyed on an attribute image.ts writes (a `:has()` restyles the whole document).
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwaDgAAAKEAYEml6crAAAAAElFTkSuQmCC';
  const frame = (attrs) => ({ type: 'image', attrs: { src: PNG, width: 120, height: 60, ...attrs } });
  const block = (...content) => ({ type: 'paragraph', content });
  const words = (t) => ({ type: 'text', text: t });
  // Out of the autosave, as a reload builds it: the anchored frame is placed while the
  // view is still being built.
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    block(words('above')), block(words('with '), frame({ wrap: 'topBottom' })), block(words('below')),
    block(frame({ wrap: 'topBottom', anchorPage: 1 })), block(words('after anchored')),
    block(frame({ wrap: 'topBottom' })), block(frame({ wrap: 'topBottom' })), block(words('after two')),
  ] });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settle(page, true);
  const bands = await page.evaluate(() => Array.from(document.querySelectorAll('.tiptap-host .tiptap > p'),
    (p) => `${p.getAttribute('data-wrap-band') ?? '-'}/${getComputedStyle(p).clear}`).join(' '));
  check(bands === '-/none true/none -/both anchored/none -/none true/none true/none -/both',
    `loaded from the autosave, the block after a band frame clears it, after an anchored one it does not (${bands})`);

  // A borderless table split inside its cell under a footer taller than the bottom margin:
  // the page-break mask draws no edge lines, and its gap stripe sits on the sheets' gap.
  const cellLines = Array.from({ length: 70 }, (_, i) => block(words(`cell line ${i + 1}`)));
  await page.evaluate(([d, f]) => {
    localStorage.setItem('edentext-doc', JSON.stringify(d));
    localStorage.setItem('edentext-footer', JSON.stringify(f));
  }, [{ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell',
    attrs: { borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: 'none' }, content: cellLines }] }] }] },
  { type: 'doc', content: Array.from({ length: 6 }, (_, i) => block(words(`footer ${i + 1}`))) }]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settle(page, true);
  const mask = await page.evaluate(() => {
    const stripe = document.querySelector('.page-gap-stripe');
    const sheets = Array.from(document.querySelectorAll('.page-sheet'), (s) => s.getBoundingClientRect());
    const top = stripe ? stripe.getBoundingClientRect().top + 1 : NaN;
    return { lines: document.querySelectorAll('.table-break-band.lines').length, off: Math.min(...sheets.map((r) => Math.abs(r.bottom - top))) };
  });
  check(mask.lines === 0 && mask.off <= 1,
    `a borderless table's page-break mask draws no lines and its gap on the sheets' (${mask.lines} lines, ${mask.off.toFixed(1)}px off)`);
  await page.evaluate(() => localStorage.removeItem('edentext-footer'));

  // A row that may not break and is taller than a page starts on a fresh one.
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    ...Array.from({ length: 5 }, (_, i) => block(words(`before ${i + 1}`))),
    { type: 'table', content: [{ type: 'tableRow', attrs: { cantSplit: true }, content: [{ type: 'tableCell', content:
      Array.from({ length: 70 }, (_, i) => block(words(`kept line ${i + 1}`))) }] }] }] });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settle(page, true);
  const keptPage = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.tiptap-host .tiptap td p')).find((e) => e.textContent === 'kept line 1');
    const sheets = Array.from(document.querySelectorAll('.page-sheet'), (s) => s.getBoundingClientRect());
    const top = p ? p.getBoundingClientRect().top : NaN;
    return sheets.findIndex((r) => top >= r.top && top < r.bottom) + 1;
  });
  check(keptPage === 2, `a row that may not break, taller than a page, starts on the next one (page ${keptPage})`);

  // An index shows the rows it saved, as both word processors do, until it is updated.
  const heading = (t) => ({ type: 'heading', attrs: { level: 1 }, content: [words(t)] });
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    { type: 'tableOfContents', attrs: { title: '', entries: [{ text: 'Two', level: 1, page: 9 }, { text: 'Gone', level: 1, page: 7 }] } },
    heading('One'), heading('Two'),
  ] });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.toc-entry', { timeout: 15_000 });
  await settle(page, true);
  const tocRows = () => page.evaluate(() => Array.from(document.querySelectorAll('.toc-entry'),
    (r) => `${r.querySelector('.toc-text').textContent} ${r.querySelector('.toc-page').textContent}`).join(', '));
  const cachedRows = await tocRows();
  // Word's other choice: the saved rows stay, their page numbers are renewed.
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.updateIndexes('pages'));
  await settle(page, true);
  const renumbered = await tocRows();
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.updateIndexes());
  await settle(page, true);
  const updated = await tocRows();
  check(cachedRows === 'Two 9, Gone 7' && renumbered === 'Two 1, Gone 7' && updated === 'One 1, Two 1',
    `an index keeps its saved rows until updated (${cachedRows} → ${renumbered} → ${updated})`);

  // A two-column section over several pages pages in one pass: a continuation is judged
  // with a full page wherever it renders, and the split counts the blocks' margins as the
  // overflow test does — else one block moves down per pass, a pass per block.
  const lines = [];
  for (let i = 0; i < 300; i++) {
    lines.push({ type: 'paragraph', attrs: { spaceAfter: 6 }, content: [words(`Line ${i + 1}: ${LOREM.slice(0, 5 + (i % 5)).join(' ')}`)] });
  }
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    block(words('before the section')), { type: 'columns', attrs: { count: 2 }, content: lines }, block(words('after the section')),
  ] });
  await page.addInitScript(() => {
    window.__passes = 0;
    document.addEventListener('pm-pagecount', () => { window.__passes++; });
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await settle(page, true);
  const flow = await page.evaluate(() => ({ passes: window.__passes, fragments: document.querySelectorAll('.tiptap-host .tiptap > .columns-node').length }));
  check(flow.fragments >= 3 && flow.passes <= 8,
    `a two-column section over ${flow.fragments} pages settles in ${flow.passes} passes`);

  // A section narrower than the sheet insets its blocks to their own page's left edge with
  // a node decoration, which the mapping drops when a style change replaces the node: the
  // heading then sat at the sheet's edge until the next pass (docs/architecture/pagination.md).
  await page.setInputFiles('input.file-input[accept*=".odt"]', join(ROOT, 'tests/corpus/17-sections.docx'));
  await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('Landscape middle'),
    null, { timeout: 30_000 });
  await settle(page, true);
  // The block itself, by its text: the style change turns the h1 into an h3.
  await page.evaluate(() => { window.__heading = () => Array.from(document.querySelectorAll('.tiptap-host .tiptap > *'))
    .find((e) => e.textContent.startsWith('Portrait first')); });
  const inset = await page.evaluate(() => {
    const el = window.__heading();
    return { x: Math.round(el.getBoundingClientRect().left), left: parseFloat(getComputedStyle(el).marginLeft) };
  });
  await page.click('.tiptap h1');
  await page.evaluate(() => {
    window.__xs = [];
    const tick = () => {
      const el = window.__heading();
      if (el) window.__xs.push(Math.round(el.getBoundingClientRect().left));
      if (window.__xs.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press(`${MOD}+Alt+3`);
  await page.waitForTimeout(1200);
  const drift = await page.evaluate((x) => Math.max(...window.__xs.map((s) => Math.abs(s - x))), inset.x);
  check(inset.left > 0 && drift <= 1,
    `a style change keeps the block's section inset (${inset.left}px, drifted ${drift}px)`);
  // Behind the text: the frame leaves the flow (so the paragraph loses its height again)
  // and is then moved by its own offsets, since there is no text position to re-anchor to.
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    block(words('before '), frame({}), words(' after the picture')),
  ] });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap img', { timeout: 15_000 });
  await settle(page, true);
  const paraHeight = () => page.evaluate(() => document.querySelector('.tiptap-host .tiptap > p').getBoundingClientRect().height);
  const frameBox = () => page.evaluate(() => {
    const el = document.querySelector('.image-node');
    const r = el.getBoundingClientRect();
    return { wrap: el.dataset.wrap ?? '', z: getComputedStyle(el).zIndex, x: r.left, y: r.top };
  });
  const inlineHeight = await paraHeight();
  await page.click('.tiptap img');
  await page.waitForSelector('.image-toolbar', { timeout: 10_000 });
  await page.locator('.image-toolbar .it-btn').nth(4).click();
  await settle(page, true);
  const behindBox = await frameBox();
  check(behindBox.wrap === 'through' && Number(behindBox.z) < -1 && await paraHeight() < inlineHeight,
    `the behind-text button takes the frame out of the flow (${behindBox.wrap}, z ${behindBox.z}, ${inlineHeight}px → ${await paraHeight()}px)`);
  // setNodeMarkup replaces a leaf, so without putting the node selection back the frame
  // deselects itself on every attribute change and its toolbars close.
  check(await page.locator('.image-toolbar').count() === 1, 'setting the wrap mode leaves the frame selected');

  await page.mouse.move(behindBox.x + 60, behindBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(behindBox.x + 120, behindBox.y + 70, { steps: 4 });
  await page.mouse.up();
  await settle(page, true);
  const movedBox = await frameBox();
  const dx = Math.round(movedBox.x - behindBox.x);
  const dy = Math.round(movedBox.y - behindBox.y);
  check(Math.abs(dx - 60) <= 2 && Math.abs(dy - 40) <= 2,
    `a frame out of the flow is dragged by its own offsets (moved ${dx}/${dy}, wanted 60/40)`);

  // A text box in that mode moves the same way, but by its frame ring — its own drag
  // is ProseMirror's node move, which would re-anchor it instead. Past the autosave's
  // debounce, or its write puts the dragged picture back in the text box's place.
  await page.waitForTimeout(1500);
  await page.evaluate((d) => localStorage.setItem('edentext-doc', JSON.stringify(d)), { type: 'doc', content: [
    block(words('before the box '), { type: 'textBox', attrs: { width: 200, height: 80, wrap: 'through' },
      content: [block(words('in the box'))] }, words(' after it')),
  ] });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap .textbox-node[data-wrap="through"]', { timeout: 15_000 });
  await settle(page, true);
  const boxAt = () => page.evaluate(() => {
    const r = document.querySelector('.tiptap .textbox-node[data-wrap="through"]').getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  const boxBefore = await boxAt();
  await page.mouse.move(boxBefore.x + 2, boxBefore.y + 40);
  await page.mouse.down();
  await page.mouse.move(boxBefore.x + 52, boxBefore.y + 65, { steps: 4 });
  await page.mouse.up();
  await settle(page, true);
  const boxAfter = await boxAt();
  const bdx = Math.round(boxAfter.x - boxBefore.x);
  const bdy = Math.round(boxAfter.y - boxBefore.y);
  check(Math.abs(bdx - 50) <= 2 && Math.abs(bdy - 25) <= 2,
    `a text box out of the flow is dragged by its ring (moved ${bdx}/${bdy}, wanted 50/25)`);

  // The cross-reference window is modeless so the view can stay parked on the target
  // while a reference is picked. Restoring focus to the editor must therefore not scroll
  // the caret back into view: the document would move under the reader on every insert.
  // Past the autosave's debounce first, or its pending write overwrites the document
  // put here before the reload reads it back.
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.setItem('edentext-doc', JSON.stringify({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Public primary education' }] },
    ...Array.from({ length: 80 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Filler ${i + 1} ${'word '.repeat(14)}` }] })),
    { type: 'paragraph', content: [{ type: 'text', text: 'See ' }] },
  ] })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('Public primary education'),
    null, { timeout: 15_000 });
  await settle(page, true);
  await page.evaluate(() => {
    const ed = document.querySelector('.tiptap').editor;
    ed.commands.focus(ed.state.doc.content.size - 1);
    document.querySelector('.tiptap').firstElementChild.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  const parked = await page.evaluate(() => Math.round(document.querySelector('.editor').scrollTop));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('odf-open-cross-ref-dialog')));
  await page.waitForSelector('.xr:popover-open', { timeout: 5_000 });
  await page.selectOption('.xr select >> nth=0', 'heading');
  await page.waitForTimeout(150);
  await page.click('.xr .xr-apply');
  await page.waitForTimeout(600);
  const inserted = await page.evaluate(() => ({
    field: document.querySelector('.tiptap .cross-ref')?.textContent ?? '',
    scroll: Math.round(document.querySelector('.editor').scrollTop),
    open: document.querySelector('.xr')?.matches(':popover-open'),
  }));
  check(inserted.field === 'Public primary education' && inserted.scroll === parked && inserted.open,
    `inserting a cross-reference leaves the view where it was (${parked} \u2192 ${inserted.scroll}, field "${inserted.field}")`);
  // Its title bar captures the pointer for the drag, which retargets the click: unless a
  // press on a button is let through, the close cross does nothing.
  await page.click('.xr .xr-bar button');
  check(await page.evaluate(() => !document.querySelector('.xr')?.matches(':popover-open')),
    'the cross-reference window closes on its close cross');

  // Both windows are top-layer popovers: a `position: fixed` one resolves against the
  // island chrome's transformed toolbar stack and lands beside the viewport instead.
  // A bookmark covers a range, so the button opens only once the selection has reached
  // the chrome — one tick after the command.
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.setTextSelection({ from: 1, to: 8 }));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('odf-open-bookmark-dialog')));
  await page.waitForSelector('.bm:popover-open', { timeout: 5_000 });
  const winAt = () => page.evaluate(() => {
    const r = document.querySelector('.bm').getBoundingClientRect();
    return { x: r.left, y: r.top, right: r.right, vw: window.innerWidth };
  });
  const winBefore = await winAt();
  check(winBefore.right <= winBefore.vw && winBefore.y > 0,
    `the bookmark window opens inside the viewport (right ${Math.round(winBefore.right)} of ${winBefore.vw})`);
  const bar = await (await page.$('.bm .bm-bar')).boundingBox();
  await page.mouse.move(bar.x + 40, bar.y + 10);
  await page.mouse.down();
  await page.mouse.move(bar.x - 260, bar.y + 210, { steps: 8 });
  await page.mouse.up();
  const winAfter = await winAt();
  const wdx = Math.round(winAfter.x - winBefore.x);
  const wdy = Math.round(winAfter.y - winBefore.y);
  check(Math.abs(wdx + 300) <= 2 && Math.abs(wdy - 200) <= 2,
    `the bookmark window is dragged by its bar (moved ${wdx}/${wdy}, wanted -300/200)`);
  await page.click('.bm .bm-bar button');
  check(await page.evaluate(() => !document.querySelector('.bm')?.matches(':popover-open')),
    'the bookmark window closes on its close cross');

  // Ctrl+F keeps the focus in its own input, and ProseMirror scrolls a selection into
  // view only while the editor owns the DOM selection — so a find that does not scroll
  // the match itself never moves the page.
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.setContent(
    `<h1>Overview</h1>${Array.from({ length: 90 }, (_, i) => `<p>Filler ${i} ${'word '.repeat(12)}</p>`).join('')}<p>Zebra crossing</p>`));
  await settle(page, true);
  await page.evaluate(() => { document.querySelector('.editor').scrollTop = 0; });
  await page.keyboard.press('Control+f');
  await page.waitForTimeout(300);
  await page.keyboard.type('Zebra');
  await page.waitForTimeout(600);
  const found = await page.evaluate(() => {
    const port = document.querySelector('.editor').getBoundingClientRect();
    const box = document.querySelector('.search-match-current')?.getBoundingClientRect();
    return { top: Math.round(document.querySelector('.editor').scrollTop), active: document.activeElement?.tagName,
      inView: !!box && box.top >= port.top && box.bottom <= port.bottom };
  });
  check(found.top > 0 && found.inView && found.active === 'INPUT',
    `a find scrolls its match into view and leaves the focus in the bar (scrollTop ${found.top}, in view ${found.inView}, focus ${found.active})`);
  await page.keyboard.press('Escape');

  // The ribbon mounts only the open tab, so a dialog that lives in one hears no event:
  // the formula's double-click, Ctrl+K and the context menu fire while Home is up.
  await page.evaluate(() => document.querySelector('.tiptap').editor.chain().focus().insertFormula({ latex: 'a^2', display: false }).run());
  await page.waitForSelector('.tiptap .formula', { timeout: 15_000 });
  await settle(page, true);
  await page.dblclick('.tiptap .formula');
  const dialog = await page.waitForSelector('.formula-dialog', { timeout: 5_000 }).then(() => true).catch(() => false);
  check(dialog, `a double-click on a formula opens its dialog from the ${await page.locator('.ribbon-tab.active').textContent()} tab`);

  // The grammar check: the 16 MB wasm has to survive Vite's build and reach the browser,
  // which only a real page can show. English document, switch on, one wrong sentence.
  await page.keyboard.press('Escape'); // the formula dialog above still covers the chrome
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.setContent('<p>He go to the store.</p>'));
  await settle(page, true);
  await page.selectOption('.statusbar .lang-picker select', 'doc:en');
  await page.check('.statusbar .gr-toggle input');
  // The waves are CSS highlight ranges (grammarCheck.ts), not elements.
  const squiggle = await page.waitForFunction(() => CSS.highlights.get('grammar-error')?.size > 0, null, { timeout: 60_000 })
    .then(() => true).catch(() => false);
  check(squiggle, 'the grammar check flags a wrong sentence in the browser');

  // A paragraph in its own language: the picker writes a real lang attribute, which is
  // what the hyphenation and the browser's own spell check read.
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.setContent(
    '<p>He go to the store.</p><p>Er geht zum Laden zum Laden.</p>'));
  await page.waitForFunction(() => CSS.highlights.get('grammar-error')?.size > 0,
    null, { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => {
    const ed = document.querySelector('.tiptap').editor;
    ed.commands.setTextSelection(ed.state.doc.content.size - 2);
  });
  await page.selectOption('.statusbar .lang-picker select', 'sel:de');
  const langs = await page.evaluate(() => [...document.querySelectorAll('.tiptap-host .tiptap > p')].map((p) => p.getAttribute('lang')));
  check(JSON.stringify(langs) === '[null,"de-DE"]', `only the second paragraph takes a language (${JSON.stringify(langs)})`);
  const paragraphToggleOff = await page.waitForFunction(() => {
    const input = document.querySelector('.statusbar .gr-toggle input');
    return input?.disabled && !input.checked;
  }, null, { timeout: 5_000 }).then(() => true).catch(() => false);
  check(paragraphToggleOff, 'a non-English paragraph disables and clears the grammar toggle');
  // Harper reads German as broken English; the block language is what keeps it out.
  await page.waitForFunction(() => CSS.highlights.get('grammar-error')?.size > 0,
    null, { timeout: 30_000 }).catch(() => {});
  const perPara = await page.evaluate(() => [...document.querySelectorAll('.tiptap-host .tiptap > p')].map((p) =>
    [...CSS.highlights.get('grammar-error') ?? []].filter((r) => p.contains(r.startContainer)).length));
  check(perPara[0] > 0 && perPara[1] === 0, `only the English paragraph is grammar-checked (${JSON.stringify(perPara)})`);

  // The default can be Portuguese while an English paragraph still gets grammar checks.
  await page.selectOption('.statusbar .lang-picker select', 'doc:pt');
  const documentToggleOff = await page.waitForFunction(() => {
    const input = document.querySelector('.statusbar .gr-toggle input');
    return input?.disabled && !input.checked;
  }, null, { timeout: 5_000 }).then(() => true).catch(() => false);
  check(documentToggleOff, 'a non-English document disables and clears the grammar toggle');
  await page.evaluate(() => {
    const ed = document.querySelector('.tiptap').editor;
    ed.commands.setTextSelection(2);
  });
  await page.selectOption('.statusbar .lang-picker select', 'sel:en');
  const englishToggleOn = await page.waitForFunction(() => {
    const input = document.querySelector('.statusbar .gr-toggle input');
    return !input?.disabled && input?.checked;
  }, null, { timeout: 5_000 }).then(() => true).catch(() => false);
  check(englishToggleOn, 'an English paragraph restores the grammar toggle');
  await page.waitForFunction(() => [...CSS.highlights.get('grammar-error') ?? []].some((r) =>
    r.startContainer.isConnected && r.startContainer.parentElement?.closest('.tiptap-host .tiptap > p')), null, { timeout: 30_000 })
    .then(() => check(true, 'an English paragraph in a Portuguese document is grammar-checked'))
    .catch(() => check(false, 'an English paragraph in a Portuguese document is grammar-checked'));

  // The page grid: every cell is a fixed window of exactly its own page, and the caret —
  // drawn only by the focused view, clipped to its cell — follows whatever moves it.
  // Last, since it replaces the document and the zoom with its own.
  await page.evaluate(() => localStorage.setItem('edentext-page-columns', '3'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.page-cell', { timeout: 15_000 });
  await page.evaluate(() => {
    const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. ';
    document.querySelector('.tiptap').editor.commands.setContent({ type: 'doc', content: Array.from({ length: 300 },
      (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `${i + 1}. ${text.repeat(1 + (i % 4))}` }] })) });
  });
  const gridPages = await settled();
  const gridState = (scrolledAway) => page.evaluate((scrolledAway) => {
    const bad = [];
    const near = (a, b) => Math.abs(a - b) < 1.5;
    const sheetAt = (c) => {
      const r = c.getBoundingClientRect();
      return [...c.querySelectorAll('.page-sheet')].findIndex((s) => {
        const q = s.getBoundingClientRect();
        return near(q.top, r.top) && near(q.left, r.left) && near(q.width, r.width) && near(q.height, r.height);
      }) + 1;
    };
    const live = [...document.querySelectorAll('.page-cell:not(.empty)')];
    const pages = live.map(sheetAt);
    if (pages.includes(0)) bad.push(`a cell shows no whole page (${pages})`);
    if (new Set(pages).size !== pages.length) bad.push(`a page shows twice (${pages})`);
    const cell = document.activeElement?.closest('.page-cell');
    const sel = getSelection();
    if (!cell || !sel.rangeCount) return [...bad, 'no cell has the focus'];
    // Measured in the text: a range between elements measures the spacer before it.
    let node = sel.focusNode, offset = sel.focusOffset;
    const widget = (n) => n?.nodeType === 1 && n.contentEditable === 'false';
    while (node.nodeType === 1 && node.childNodes.length) {
      const kids = node.childNodes;
      const after = offset < kids.length && !(offset > 0 && widget(kids[offset]) && !widget(kids[offset - 1]));
      node = after ? kids[offset] : kids[Math.min(offset, kids.length) - 1];
      offset = after ? 0 : node.nodeType === 3 ? node.length : node.childNodes.length;
    }
    const range = document.createRange();
    range.setStart(node, offset);
    let rect = range.getClientRects()[0];
    if (!rect || !(rect.top || rect.bottom)) rect = (node.nodeType === 1 ? node : node.parentElement).getBoundingClientRect();
    const y = (rect.top + rect.bottom) / 2;
    const r = cell.getBoundingClientRect();
    const drawn = y >= r.top - 1 && y <= r.bottom + 1 && rect.left >= r.left - 1 && rect.left <= r.right + 1;
    const page = [...cell.querySelectorAll('.page-sheet')].findIndex((s) => {
      const q = s.getBoundingClientRect();
      return y >= q.top - 12 && y <= q.bottom + 12;
    }) + 1;
    if (!drawn && pages.includes(page)) bad.push(`the caret on page ${page} is clipped away in the cell of page ${sheetAt(cell)}`);
    const view = document.querySelector('.editor-panes.grid > .editor').getBoundingClientRect();
    if (!scrolledAway && (!drawn || y < view.top || y > view.bottom)) bad.push(`the caret is off screen (${Math.round(y)})`);
    return bad;
  }, scrolledAway);
  const gridFaults = [];
  // Layout settles over a few frames, so the invariant gets until the settle is over.
  const gridStep = async (label, scrolledAway = false) => {
    let faults = [];
    for (let i = 0; i < 6 && (i === 0 || faults.length); i++) {
      await page.waitForTimeout(350);
      faults = await gridState(scrolledAway);
    }
    for (const fault of faults) gridFaults.push(`${label}: ${fault}`);
  };
  const docEnd = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End';
  const docStart = process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home';
  await page.locator('.page-cell:not(.empty) .tiptap p').first().click();
  await gridStep('click');
  await page.keyboard.press(docEnd);
  await gridStep('document end');
  await page.keyboard.type('x');
  await gridStep('typing');
  await page.keyboard.press(docStart);
  await gridStep('document start');
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('PageDown');
    await gridStep(`page down ${i}`);
  }
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowDown');
  await gridStep('arrow down');
  await page.keyboard.press(`${MOD}+Enter`);
  await gridStep('page break');
  await page.keyboard.press('Backspace');
  await gridStep('page break removed');
  await page.mouse.move(700, 500);
  for (let i = 1; i <= 3; i++) {
    await page.mouse.wheel(0, 600);
    await gridStep(`wheel ${i}`, true);
  }
  await page.keyboard.type('y');
  await gridStep('typing after scrolling away');
  await page.keyboard.press('PageUp');
  await gridStep('page up');
  check(gridPages > 6 && gridFaults.length === 0,
    `the page grid shows each page in its own cell and the caret where it is (${gridPages} pages${gridFaults.length ? `: ${gridFaults.join('; ')}` : ''})`);

  // Dark theme: every menu each ribbon tab opens, a text box selected so its contextual
  // tab shows too. A glyph or label barely apart from what it sits on is a colour some
  // control fixed instead of taking the theme's (a popover's black, the shape gallery's).
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('edentext-theme', 'dark'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.tiptap', { timeout: 15_000 });
  await page.click('.tiptap');
  await page.keyboard.type('Contrast');
  await page.evaluate(() => document.querySelector('.tiptap').editor.commands.insertTextBox());
  const selectBox = () => page.evaluate(() => {
    const ed = document.querySelector('.tiptap').editor;
    ed.state.doc.descendants((n, p) => { if (n.type.name === 'textBox') ed.commands.setNodeSelection(p); });
  });
  const lowContrast = (where) => page.evaluate((where) => {
    const rgb = (c) => {
      const v = (c.match(/[\d.]+/g) ?? []).map(Number);
      return c.startsWith('color(') ? [...v.slice(0, 3).map((x) => x * 255), v[3] ?? 1] : [...v.slice(0, 3), v[3] ?? 1];
    };
    const lum = (c) => c.slice(0, 3).reduce((sum, v, i) => {
      v /= 255;
      return sum + [0.2126, 0.7152, 0.0722][i] * (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    }, 0);
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const backdrop = (el) => {
      for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 4 && c[3] > 0.5) return c; }
      return [255, 255, 255, 1];
    };
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === 'hidden') return false;
      for (let e = el; e; e = e.parentElement) if (parseFloat(getComputedStyle(e).opacity) < 0.6) return false;
      return true;
    };
    const out = [];
    // The column previews' page frame is a hairline on purpose, in every theme.
    for (const el of document.querySelectorAll('body *:not(.paper *, .col-preview > rect:first-child)')) {
      if (!shown(el)) continue;
      let fg;
      if (el instanceof SVGGeometryElement) {
        const cs = getComputedStyle(el);
        if (cs.stroke === 'none' && cs.fill === 'none') continue;
        fg = rgb(cs.stroke !== 'none' ? cs.stroke : cs.fill);
      } else if ([...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) {
        fg = rgb(getComputedStyle(el).color);
      } else continue;
      if (fg.length < 4 || fg[3] < 0.5) continue;
      const r = ratio(fg, backdrop(el instanceof SVGElement ? el.closest('svg').parentElement : el));
      const named = el.closest('[aria-label],[title]');
      if (r < 2) out.push(`${where}: ${named?.getAttribute('aria-label') || named?.title || el.textContent.trim().slice(0, 30)} (${r.toFixed(2)})`);
    }
    return out;
  }, where);
  const contrastFaults = new Set();
  for (const tab of await page.$$eval('.ribbon-tab', (els) => els.map((e) => e.textContent.trim()))) {
    await selectBox();
    const button = page.locator('.ribbon-tab', { hasText: tab }).first();
    if (!(await button.isVisible())) continue;
    await button.click();
    (await lowContrast(tab)).forEach((f) => contrastFaults.add(f));
    const menus = await page.$$eval('.ribbon-body [aria-haspopup]', (els) =>
      els.map((e, i) => { e.dataset.contrastMenu = String(i); return e.offsetParent ? i : -1; }).filter((i) => i >= 0));
    for (const i of menus) {
      const trigger = page.locator(`[data-contrast-menu="${i}"]`);
      const label = await trigger.evaluate((e) => e.getAttribute('aria-label') || e.title || e.textContent.trim());
      try { await trigger.click({ timeout: 1500 }); } catch { continue; }
      (await lowContrast(`${tab} › ${label}`)).forEach((f) => contrastFaults.add(f));
      await page.keyboard.press('Escape');
      await page.mouse.click(5, 300);
    }
  }
  check(contrastFaults.size === 0, `the dark theme draws no menu glyph or label in a colour of its own${contrastFaults.size ? `: ${[...contrastFaults].slice(0, 8).join('; ')}` : ''}`);

} catch (err) {
  check(false, `dom run threw: ${err.message ?? err}`);
} finally {
  check(pageErrors.length === 0, pageErrors.length ? `no uncaught page errors — got: ${pageErrors.join(' | ')}` : 'no uncaught page errors');
  await browser.close();
  if (server) process.kill(-server.pid);
}
process.exit(failures.length ? 1 : 0);
