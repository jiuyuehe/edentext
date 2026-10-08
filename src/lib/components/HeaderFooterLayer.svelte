<script lang="ts">
  import { untrack } from 'svelte';
  import { Editor, type Content } from '@tiptap/core';
  import { layOutZoneTabs, zoneDefaultStops } from '../editor/extensions/tabStops';
  import { FORCE_PAGE_RECALC } from '../editor/extensions/pageBreaks';
  import { zoneExtensions } from '../editor/extensions';
  import { plainPastedSpaces, unwrapPastedBoxes } from '../editor/paste';
  import { hfIsEmpty, DEFAULT_HF_DISTANCES, HF_ZONE_KEYS, type HfDoc, type HfZone, type HfVariant, type HfDistances, type HfSet, type HfZoneKey } from '../storage/headerFooter';
  import { cmToPx, PX_PER_CM, type PageMargins } from '../storage/pageMargins';
  import { type Orientation } from '../storage/pageOrientation';
  import { pageDimsCm, type PageFormat } from '../storage/pageFormat';
  import { DEFAULT_PAGE_NUMBERING, isLeftPage, printedPageNumber, type PageNumbering } from '../storage/pageNumbering';
  import { formatOrdinal } from '../utils/orderedListTypes';
  import { chapterOn, type ChapterStart } from '../utils/chapterField';
  import { t } from '../i18n/i18n.svelte';
  import { allPagesDrawn } from './pageWindow.svelte';

  let {
    headerDoc = $bindable(),
    footerDoc = $bindable(),
    headerFirstDoc = $bindable(),
    footerFirstDoc = $bindable(),
    differentFirstPage = false,
    headerEvenDoc = $bindable(),
    footerEvenDoc = $bindable(),
    differentOddEven = false,
    numPages,
    pageBoxes,
    currentPage,
    pageMargins,
    orientation,
    pageFormat = 'A4',
    hfDistances = DEFAULT_HF_DISTANCES,
    hfEditor = $bindable(),
    hfActive = $bindable(),
    hfTick = $bindable(),
    extraHfSections = $bindable([]),
    sectionStartPages = [],
    chapterStarts = [],
    pageNumbering = DEFAULT_PAGE_NUMBERING,
    zoneHeights = $bindable([]),
    zoneIntrusions = $bindable([]),
    interactive = true,
    onlyPage = 0,
  }: {
    headerDoc: HfDoc;
    footerDoc: HfDoc;
    headerFirstDoc: HfDoc;
    footerFirstDoc: HfDoc;
    differentFirstPage?: boolean;
    headerEvenDoc: HfDoc;
    footerEvenDoc: HfDoc;
    differentOddEven?: boolean;
    numPages: number;
    /** One box per page (Editor.svelte): a section on its own paper differs in size. */
    pageBoxes: { top: number; left: number; height: number; width: number }[];
    currentPage: number;
    /** How the page-number field counts (format + start value). */
    pageNumbering?: PageNumbering;
    pageMargins: PageMargins;
    orientation: Orientation;
    pageFormat?: PageFormat;
    hfDistances?: HfDistances;
    hfEditor: Editor | null;
    hfActive: HfZone | null;
    hfTick: number;
    extraHfSections?: HfSet[];
    sectionStartPages?: number[];
    chapterStarts?: ChapterStart[];
    /** Rendered height (px) of each set's six zones, in HF_ZONE_KEYS order — read back
     *  by Editor.svelte, whose margins have to clear the band the zone really needs. */
    zoneHeights?: number[][];
    /** How far past the body's top each zone's frames set against the body keep its text
     *  (px, same layout) — a letterhead block the body wraps below. */
    zoneIntrusions?: number[][];
    /** False in a split view's second pane: it draws the zones, it does not edit them. */
    interactive?: boolean;
    /** A page-grid cell's page: the cell clips every other, so only its zones are drawn. */
    onlyPage?: number;
  } = $props();

  const PAGE_GAP = 20;
  // Minimum zone height (~one 12pt line), so a thin margin band (footer distance ≥
  // bottom margin, as some Word docs have) still renders instead of collapsing to 0.
  const MIN_ZONE_PX = 20;
  // Schema for the read-only editors the inactive zones are cloned from.
  const renderExts = zoneExtensions();

  // All geometry is in unscaled document px — the layer lives inside the scaled
  // .paper, so the zoom transform applies to it identically to the page background.
  let pageWidthPx = $derived(pageDimsCm(pageFormat, orientation).w * PX_PER_CM);
  let pageHeightPx = $derived(pageDimsCm(pageFormat, orientation).h * PX_PER_CM);
  // A section on its own paper makes the pages differ, so every box comes from the
  // grid Editor.svelte publishes; the document's own is the fallback.
  const boxOf = (page: number) => pageBoxes[page - 1]
    ?? { top: (page - 1) * (pageHeightPx + PAGE_GAP), left: 0, height: pageHeightPx, width: pageWidthPx };
  // A section with page margins of its own puts its zones on them, not the document's
  // — the running head of a mirrored body would otherwise sit at the wrong margin.
  function marginsOf(page: number): PageMargins {
    const i = sectionOf(page);
    const s = sets[i];
    const own = page === sectionFirstPage(i) ? s?.marginsFirst ?? s?.margins : s?.margins;
    return own ?? pageMargins;
  }
  const contentWidthOf = (page: number) => {
    const m = marginsOf(page);
    return Math.max(0, boxOf(page).width - cmToPx(m.left) - cmToPx(m.right));
  };
  // Edge→zone distance in px. The footer may sit farther from the edge than the body
  // bottom margin (Word's w:footer > w:bottom); the zone then grows up into the margin.
  let headerDistPx = $derived(Math.min(cmToPx(hfDistances.header), pageHeightPx));
  let footerDistPx = $derived(Math.min(cmToPx(hfDistances.footer), pageHeightPx));
  // A section whose page setup gives it its own distances puts its zones on those.
  function distancesOf(page: number): { header: number; footer: number } {
    const i = sectionOf(page);
    const s = sets[i];
    const d = (page === sectionFirstPage(i) ? s?.distancesFirst ?? s?.distances : s?.distances) ?? null;
    return d
      ? { header: Math.min(cmToPx(d.header), pageHeightPx), footer: Math.min(cmToPx(d.footer), pageHeightPx) }
      : { header: headerDistPx, footer: footerDistPx };
  }

  // Only the pages around the one being read carry their zones: a long document's layer
  // is a thousand absolutely-placed boxes otherwise, laid out again on every pass. The
  // window shifts a step at a time, so a scroll does not rebuild it on every tick.
  const WINDOW_STEP = 25;
  const WINDOW_PAGES = 75;
  let pages = $derived.by(() => {
    const total = Math.max(1, numPages);
    if (onlyPage && !allPagesDrawn.on) return onlyPage <= total ? [onlyPage] : [];
    if (allPagesDrawn.on || total <= WINDOW_PAGES) return Array.from({ length: total }, (_, i) => i + 1);
    const step = Math.floor((currentPage - 1) / WINDOW_STEP) * WINDOW_STEP - WINDOW_STEP + 1;
    const start = Math.max(1, Math.min(total - WINDOW_PAGES + 1, step));
    return Array.from({ length: WINDOW_PAGES }, (_, i) => start + i);
  });

  function zoneBox(zone: HfZone, page: number) {
    // Mirrored margins: an even page is the left-hand one, so the pair is swapped.
    const box = boxOf(page);
    const m = marginsOf(page);
    const dist = distancesOf(page);
    const swap = m.mirrored && isLeftPage(pageNumberAt(page));
    // From the page's own left edge — a section on narrower paper is centred.
    const left = box.left + cmToPx(swap ? m.right : m.left);
    const width = contentWidthOf(page);
    if (zone === 'header') {
      const top = box.top + dist.header;
      return { top, left, width, height: Math.max(MIN_ZONE_PX, cmToPx(m.top) - dist.header) };
    }
    // Footer anchors its bottom edge at its distance from the page bottom and grows up.
    const height = Math.max(MIN_ZONE_PX, cmToPx(m.bottom) - dist.footer);
    const top = box.top + box.height - dist.footer - height;
    return { top, left, width, height };
  }
  // The active (edited) zone grows to fit its content, keeping the anchored edge fixed
  // (footer bottom at footerDistPx, header top at headerDistPx) so the boundary line
  // sits exactly at the content's edge toward the body.
  function activeZoneBox(zone: HfZone, page: number) {
    const b = zoneBox(zone, page);
    // A visible ProseMirror trailing break (a caret line past the real content) is
    // discounted: the frame tracks the real content and the break overflows past the
    // anchored edge, so entering edit never shifts the text.
    const contentPx = Math.max(0, activeContentPx - activeTrailingPx);
    const height = Math.max(b.height, contentPx);
    if (zone === 'footer') return { ...b, top: b.top + b.height - height, height };
    return { ...b, height };
  }
  // Double-click target: the zone's ::after grows the box out to the page edges, so the
  // whole margin band opens the zone (as in LibreOffice) without a box of its own — a
  // second element per zone is a hundred more to lay out on every pass.
  function hitVars(zone: HfZone, page: number, z: { top: number; left: number; width: number; height: number }) {
    const box = boxOf(page);
    const edge = zone === 'header' ? z.top - box.top : box.top + box.height - z.top - z.height;
    return ` --hit-${zone === 'header' ? 'top' : 'bottom'}: ${-edge}px;` +
      ` --hit-left: ${box.left - z.left}px; --hit-right: ${box.left + box.width - z.left - z.width}px;`;
  }
  const boxStyle = (b: { top: number; left: number; width: number; height: number }) =>
    `top: ${b.top}px; left: ${b.left}px; width: ${b.width}px; height: ${b.height}px;`;

  // Section 1 is the app's own editable state; the rest live in extraHfSections.
  let sets = $derived<HfSet[]>([
    {
      header: headerDoc, footer: footerDoc,
      headerFirst: headerFirstDoc, footerFirst: footerFirstDoc, differentFirstPage,
      headerEven: headerEvenDoc, footerEven: footerEvenDoc, differentOddEven,
    },
    ...extraHfSections,
  ]);
  // Each zone as a string: '' for an empty one, and what the pages test for fields in.
  const signature = (doc: HfDoc) => (hfIsEmpty(doc) ? '' : JSON.stringify(doc));
  let setSig = $derived(sets.map((s) => ({
    header: signature(s.header), footer: signature(s.footer),
    headerFirst: signature(s.headerFirst), footerFirst: signature(s.footerFirst),
    headerEven: signature(s.headerEven), footerEven: signature(s.footerEven),
  })));

  // Rendered once per set, not per page: a read-only editor per zone, in the off-screen
  // measuring box at its section's text width. A page shows a clone of its DOM, so list
  // markers, table columns and frames render as they do in the live zone.
  let sources = $state<Record<string, HTMLElement>>({});
  let sourceVersion = $state(0);
  function staticZone(node: HTMLElement, [id, doc]: [string, HfDoc]) {
    const ed = new Editor({ element: node, editable: false, extensions: renderExts, content: doc as Content });
    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => sourceVersion++);
    };
    // NodeViews settle after the first render (an image's size, a box's layout).
    const mo = new MutationObserver(bump);
    mo.observe(ed.view.dom, { subtree: true, childList: true, attributes: true, characterData: true });
    sources[id] = ed.view.dom as HTMLElement;
    bump();
    return {
      update([, next]: [string, HfDoc]) {
        if (next !== doc) ed.commands.setContent((doc = next) as Content, { emitUpdate: false });
      },
      destroy() {
        cancelAnimationFrame(raf);
        mo.disconnect();
        delete sources[id];
        ed.destroy();
      },
    };
  }
  // Whether a zone holds a frame behind the text: the background layer paints those, from
  // a second clone of the zone, so they sit under the body as they do in both products.
  type ZoneNode = { type?: string; attrs?: Record<string, unknown>; content?: ZoneNode[] };
  const behind = (n: ZoneNode): boolean =>
    (n.attrs?.wrap === 'through' && !n.attrs.inFront) || !!n.content?.some(behind);
  let setBehind = $derived(sets.map((s) => Object.fromEntries(HF_ZONE_KEYS.map((k) => [k, !!s[k] && behind(s[k] as ZoneNode)]))));

  // Off-screen copy of every zone at its section's text width. What the body has to
  // clear is the height the zone renders at: counting paragraphs sees neither a line
  // that wraps, nor a taller run, nor the paragraph's own padding.
  let measureRoot = $state<HTMLDivElement | null>(null);
  $effect(() => {
    const root = measureRoot;
    if (!root) return;
    void sourceVersion; // a frame past the zone changes no box size
    const boxes = Array.from(root.querySelectorAll<HTMLElement>('.hf-measure-box'));
    const n = HF_ZONE_KEYS.length;
    const read = () => {
      const next = setSig.map((_, i) => HF_ZONE_KEYS.map((_, k) => boxes[i * n + k]?.offsetHeight ?? 0));
      if (String(next) !== String(untrack(() => zoneHeights))) zoneHeights = next;
      const past = setSig.map((_, i) => HF_ZONE_KEYS.map((key, k) => (key.startsWith('header') ? intrusion(boxes[i * n + k]) : 0)));
      if (String(past) !== String(untrack(() => zoneIntrusions))) zoneIntrusions = past;
    };
    // A web font arriving late (an embedded one lands after the import) reflows the zone,
    // so the height is observed rather than read once.
    const ro = new ResizeObserver(read);
    for (const el of boxes) ro.observe(el);
    read();
    return () => ro.disconnect();
  });

  // The body text a header's frames set against it keep clear: down to the frame's
  // bottom, unless LibreOffice would wrap the text beside it — it leaves a gap under
  // 2cm empty ("optimal" wrap). ponytail: the lines a deeper frame leaves above it are
  // pushed down too; place them above once a document needs it.
  const WRAP_ROOM_PX = cmToPx(2);
  function intrusion(box: HTMLElement | undefined): number {
    let px = 0;
    for (const el of Array.from(box?.querySelectorAll<HTMLElement>('[data-from-body]') ?? [])) {
      const wrap = el.dataset.wrap;
      const x = Number(el.dataset.pageX) || 0;
      const room = wrap === 'left' ? box!.clientWidth - x - el.offsetWidth : wrap === 'right' ? x : 0;
      if (wrap === 'through' || room >= WRAP_ROOM_PX) continue;
      px = Math.max(px, (Number(el.dataset.pageY) || 0) + el.offsetHeight);
    }
    return px;
  }

  // Where a page's body text begins before any frame pushes it: its margin, or below
  // its header where that reaches further (as Editor.svelte works it out).
  function bodyTopOf(page: number): number {
    const index = Math.min(sectionOf(page), setSig.length - 1);
    const key = zoneKey('header', variantFor(page, index));
    const band = setSig[index]?.[key] ? zoneHeights[index]?.[HF_ZONE_KEYS.indexOf(key)] ?? 0 : 0;
    return Math.max(cmToPx(marginsOf(page).top), band ? distancesOf(page).header + band : 0);
  }

  // Which section a page belongs to: the count of section starts at or before it,
  // clamped to what the document actually carries.
  function sectionOf(page: number): number {
    let i = 0;
    for (const start of sectionStartPages) {
      if (page >= start) i++;
      else break;
    }
    return Math.min(i, sets.length - 1);
  }
  function sectionFirstPage(index: number): number {
    return index === 0 ? 1 : sectionStartPages[index - 1] ?? 1;
  }

  // Which variant a page shows, in precedence order: a section's own first page →
  // first (if on), other even pages → even (if on), everything else → default/odd.
  // Each variant, when on, always shows its own (possibly empty) zone.
  function variantFor(page: number, index = sectionOf(page)): HfVariant {
    const s = sets[index] ?? sets[0];
    if (s.differentFirstPage && page === sectionFirstPage(index)) return 'first';
    if (s.differentOddEven && isLeftPage(pageNumberAt(page))) return 'even';
    return 'default';
  }
  // The zone a page shows: its set and key, that zone's signature, and whether it holds
  // a frame behind the text.
  function zoneOf(zone: HfZone, page: number): { id: string; sig: string; bg: boolean } {
    const index = Math.min(sectionOf(page), setSig.length - 1);
    const key = zoneKey(zone, variantFor(page, index));
    return { id: `${index}:${key}`, sig: setSig[index][key], bg: setBehind[index][key] };
  }
  // A frame placed against the page takes its top from there (--page-y); the zone's own
  // distance below the page top is what its layer subtracts.
  const pageVar = (b: { top: number }, page: number) =>
    ` --hf-page-y: ${b.top - boxOf(page).top}px; --hf-body-y: ${bodyTopOf(page)}px;`;


  // Page, the page count and chapter map (only where the zone shows them), its source
  // editor's DOM and version, the zone and the number the page shows: everything the
  // action below re-runs on. The label is a parameter of its own because numbering can
  // change without the page doing so.
  type ZoneParams = [number, number, HTMLElement | undefined, unknown, HfZone, string, number];

  // The zone's tabs: static HTML no ProseMirror plugin reaches. The advances are layout
  // px, so only a content change invalidates them — not the zoom transform. The zones of
  // one flush lay out together, after their fields are patched: one layout, not one each.
  const tabQueue = new Set<HTMLElement>();
  function layOutTabs(node: HTMLElement) {
    if (!tabQueue.size) {
      queueMicrotask(() => {
        const zones = [...tabQueue].filter((z) => z.isConnected);
        tabQueue.clear();
        layOutZoneTabs(zones);
      });
    }
    tabQueue.add(node);
  }

  // The number a page shows, and the label of it in its section's format (a roman
  // front matter) or the document's.
  function pageNumberAt(page: number): number {
    const starts = [pageNumbering.start, ...sets.slice(1).map((s) => s.pageNumberStart ?? null)];
    return printedPageNumber(page, sectionOf(page), starts, sectionFirstPage);
  }
  function pageLabel(page: number): string {
    return formatOrdinal(pageNumberAt(page), sets[sectionOf(page)]?.pageNumberFormat ?? pageNumbering.format);
  }

  // Clone the zone's source, replace the placeholder text in every page-field span with
  // the real value (current page number, or the total page count), then lay out its tabs.
  // A zone that only moves to another page keeps its clone and has its fields' text
  // rewritten: inserting elements makes the browser recount every list in the document,
  // in each view of a page grid, on every row a scroll brings in.
  function fillZone(node: HTMLElement, params: ZoneParams) {
    let made: [HTMLElement | undefined, unknown] | null = null;
    const apply = ([page, total, src, , zone, , version]: ZoneParams) => {
      if (!made || made[0] !== src || made[1] !== version) {
        node.replaceChildren(...(src ? [src.cloneNode(true)] : []));
        made = [src, version];
      }
      for (const el of Array.from(node.querySelectorAll('[data-page-field]'))) {
        const kind = el.getAttribute('data-page-field');
        const text = kind === 'chapter' ? chapterOn(chapterStarts, page, Number(el.getAttribute('data-level')) || 1, zone)
          // The count stays decimal, as the field LibreOffice and Word write does.
          : kind === 'count' ? String(total) : pageLabel(page);
        const only = el.firstChild;
        if (only instanceof Text && !only.nextSibling) only.data = text;
        else el.textContent = text;
      }
      layOutTabs(node);
    };
    apply(params);
    return { update: apply };
  }

  // --- live editing of one zone ---
  let liveMount = $state<HTMLDivElement | null>(null);
  let activeContentPx = $state(0);
  let activeTrailingPx = $state(0);
  let editingPage = $state(1);
  // Set by a double-click (that page); null when editing is triggered externally
  // (Layout-panel buttons), where the current page is used instead.
  let pendingPage: number | null = null;
  let liveZone: HfZone | null = null;
  let liveKey = ''; // section:variant the live editor writes to

  // Which HfSet field a zone + variant is.
  const zoneKey = (zone: HfZone, variant: HfVariant): HfZoneKey =>
    (zone + (variant === 'first' ? 'First' : variant === 'even' ? 'Even' : '')) as HfZoneKey;

  function zoneDoc(index: number, zone: HfZone, variant: HfVariant): HfDoc {
    return (sets[index] ?? sets[0])[zoneKey(zone, variant)];
  }
  // Section 1's zones are separate bindable props; a later section's live in the array,
  // replaced whole so the reassignment reaches App (which persists it).
  function writeZone(index: number, zone: HfZone, variant: HfVariant, doc: HfDoc): void {
    const key = zoneKey(zone, variant);
    if (index > 0) {
      extraHfSections = extraHfSections.map((s, i) => (i === index - 1 ? { ...s, [key]: doc } : s));
    } else if (key === 'header') headerDoc = doc;
    else if (key === 'footer') footerDoc = doc;
    else if (key === 'headerFirst') headerFirstDoc = doc;
    else if (key === 'footerFirst') footerFirstDoc = doc;
    else if (key === 'headerEven') headerEvenDoc = doc;
    else footerEvenDoc = doc;
  }
  function emptyDoc(): HfDoc {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  // A zone opened while it is still empty starts on LibreOffice's header/footer stops, so
  // chapter\tcentre\tpage number needs no dialog. Only where nothing is set yet: a zone
  // that carries text or stops of its own keeps them.
  function startingDoc(index: number, zone: HfZone, variant: HfVariant, page: number): HfDoc {
    const doc = zoneDoc(index, zone, variant) ?? emptyDoc();
    const para = doc?.content?.[0] as { attrs?: Record<string, unknown> } | undefined;
    if (!doc || !para || !hfIsEmpty(doc) || para.attrs?.tabStops) return doc;
    const stops = zoneDefaultStops(contentWidthOf(page) / PX_PER_CM);
    return stops ? { ...doc, content: [{ ...para, attrs: { ...para.attrs, tabStops: stops } }] } : doc;
  }

  function startEdit(zone: HfZone, page: number) {
    pendingPage = page;
    hfActive = zone; // the $effect below mounts the live editor
  }

  function destroyLive() {
    hfEditor?.destroy();
    hfEditor = null;
    liveZone = null;
  }

  // Mount / swap / unmount the single live editor as hfActive changes. Driven from
  // double-click (sets editingPage) or the Layout-panel buttons (use currentPage).
  $effect(() => {
    // A split view's second layer only draws: the one live zone editor belongs to the
    // pane that owns the bindings, or both would write the same document.
    if (!interactive) return;
    const zone = hfActive;
    const mount = liveMount; // read unconditionally so it's always a tracked dep
    if (!zone) {
      if (hfEditor) destroyLive();
      return;
    }
    if (!mount) return;
    if (hfEditor && liveZone === zone) {
      // A first-page or odd/even flag flipped under the edited page: stay in the zone
      // and swap to the variant that page now shows.
      const page = untrack(() => editingPage);
      const index = sectionOf(page);
      if (liveKey === `${index}:${variantFor(page, index)}`) return;
      pendingPage = page;
    }
    if (hfEditor) destroyLive();

    editingPage = pendingPage ?? currentPage;
    pendingPage = null;
    liveZone = zone;
    // Which section and variant this edit session targets — fixed for its lifetime.
    const editingIndex = sectionOf(editingPage);
    const editingVariant = variantFor(editingPage, editingIndex);
    liveKey = `${editingIndex}:${editingVariant}`;
    const ed = new Editor({
      element: mount,
      extensions: zoneExtensions(zone === 'header' ? t().hf.headerPlaceholder : t().hf.footerPlaceholder),
      content: startingDoc(editingIndex, zone, editingVariant, editingPage) as Content,
      // No autofocus: its scrollIntoView nudges the page so the just-clicked zone
      // appears to jump. Focus the zone explicitly without scrolling instead.
      // Deferred: leaving a zone removes this DOM mid-render, and the blur ProseMirror
      // dispatches then would tick state while Svelte is still flushing.
      onTransaction: () => {
        queueMicrotask(() => hfTick++);
      },
      onUpdate: ({ editor }) => {
        writeZone(editingIndex, zone, editingVariant, editor.getJSON() as HfDoc);
      },
      editorProps: {
        // As in the body: a size-less box a foreign paste wraps blocks in is spilled back.
        transformPasted: (slice) => unwrapPastedBoxes(plainPastedSpaces(slice)),
        handleKeyDown: (_view, event) => {
          if (event.key === 'Escape') {
            hfActive = null;
            return true;
          }
          return false;
        },
      },
    });
    ed.commands.focus('end', { scrollIntoView: false });
    hfEditor = ed;
  });

  // The field texts the live zone last showed; a change in them is not a document change,
  // so nothing else tells its tab plugin that the advances it measured are stale.
  let liveFieldText = '';

  // Keep the live editor's own page-field spans showing the edited page / total.
  $effect(() => {
    void hfTick;
    void numPages;
    void editingPage;
    if (!liveMount) return;
    for (const el of Array.from(liveMount.querySelectorAll('[data-page-field]'))) {
      const kind = el.getAttribute('data-page-field');
      if (kind === 'chapter') el.textContent = chapterOn(chapterStarts, editingPage, Number(el.getAttribute('data-level')) || 1, hfActive ?? 'header');
      else el.textContent = kind === 'count' ? String(numPages) : pageLabel(editingPage);
    }
    const fieldText = Array.from(liveMount.querySelectorAll('[data-page-field]'), (el) => el.textContent).join('\u0001');
    if (fieldText !== liveFieldText) {
      liveFieldText = fieldText;
      // A wider number moves what a right tab stop aligns; without this the segment
      // keeps the advance of the old one and wraps the zone onto a second line.
      hfEditor?.view.dispatch(hfEditor.state.tr.setMeta(FORCE_PAGE_RECALC, true).setMeta('addToHistory', false));
    }
    // Content height (unscaled by the zoom transform) drives the active zone's frame.
    const tt = liveMount.querySelector('.tiptap') as HTMLElement | null;
    activeContentPx = tt ? tt.offsetHeight : 0;
    // A rendered trailing break adds one caret line past the real content; measure that
    // line height (the CSS var below shifts the editor down so it overflows the anchor).
    const last = tt?.lastElementChild;
    const p = last instanceof HTMLParagraphElement ? last : null;
    // Only past real content: in an empty zone that break is the caret line itself, and
    // discounting it would drop the placeholder a line below the anchored edge.
    const tb = p && p.childNodes.length > 1 ? (p.querySelector(':scope > br.ProseMirror-trailingBreak') as HTMLElement | null) : null;
    const lineH = p ? parseFloat(getComputedStyle(p).lineHeight) : 0;
    activeTrailingPx = tb && getComputedStyle(tb).display !== 'none' && Number.isFinite(lineH) ? lineH : 0;
  });

  function insertField(kind: 'pageNumber' | 'pageCount' | 'chapterField') {
    hfEditor?.chain().focus().insertContent({ type: kind }).run();
  }
</script>

<!-- Only the measuring pane runs it: every pane renders the same zones, and a second
     writer would just re-report the same heights. -->
<div class="hf-measure" aria-hidden="true" bind:this={measureRoot}>
  {#each sets as set, i}
    {#each HF_ZONE_KEYS as key}
      <div class="hf-zone hf-measure-box" style="width: {contentWidthOf(sectionFirstPage(i))}px">
        {#if setSig[i]?.[key]}
          <div use:staticZone={[`${i}:${key}`, set[key]]}></div>
        {/if}
      </div>
    {/each}
  {/each}
</div>

<!-- Own layer below the body (z-index -1 against .paper's zoom stacking context), so a
     frame behind the text sits under it the way LibreOffice paints it: a second clone of
     the zone with only those frames showing, laid out exactly as the zone above it. -->
<div class="hf-bg-layer">
  {#each pages as p}
    {#each ['header', 'footer'] as const as zone}
      {@const { id, sig, bg } = zoneOf(zone, p)}
      {#if bg && !(interactive && hfActive === zone && editingPage === p)}
        {@const zb = zoneBox(zone, p)}
        <div
          class="hf-zone hf-zone-bg hf-{zone}"
          style={boxStyle(zb) + pageVar(zb, p)}
          use:fillZone={[p, sig.includes('"pageCount"') ? numPages : 0, sources[id], sig.includes('"chapterField"') ? chapterStarts : null, zone, pageLabel(p), sourceVersion]}
        ></div>
      {/if}
    {/each}
  {/each}
</div>

<div class="hf-layer">
  {#each pages as p}
    {#each ['header', 'footer'] as const as zone}
      {#if !(interactive && hfActive === zone && editingPage === p)}
        {@const { id, sig, bg } = zoneOf(zone, p)}
        {@const total = sig.includes('"pageCount"') ? numPages : 0}
        {@const chapters = sig.includes('"chapterField"') ? chapterStarts : null}
        {@const src = sig ? sources[id] : undefined}
        {@const zb = zoneBox(zone, p)}
        <div
          class="hf-zone hf-{zone}"
          class:hf-empty={!sig}
          class:hf-has-bg={bg}
          data-hf-label={zone === 'header' ? t().hf.addHeaderHint : t().hf.addFooterHint}
          style={boxStyle(zb) + pageVar(zb, p) + (interactive ? hitVars(zone, p, zb) : '')}
          ondblclick={() => interactive && startEdit(zone, p)}
          role="button"
          tabindex="-1"
          use:fillZone={[p, total, src, chapters, zone, pageLabel(p), sourceVersion]}
        ></div>
      {/if}
    {/each}
  {/each}

  {#if interactive && hfActive}
    {@const box = activeZoneBox(hfActive, editingPage)}
    {@const index = sectionOf(editingPage)}
    {@const variant = variantFor(editingPage, index)}
    <div class="hf-zone hf-{hfActive} hf-active" style={boxStyle(box) + pageVar(box, editingPage) + ` --hf-tb-offset: ${-activeTrailingPx}px;`} bind:this={liveMount}></div>
    <div class="hf-tag" style="top: {box.top}px; left: {box.left}px;">
      {hfActive === 'header'
        ? (variant === 'first' ? t().hf.firstPageHeader : variant === 'even' ? t().hf.evenPageHeader : t().hf.headerLabel)
        : (variant === 'first' ? t().hf.firstPageFooter : variant === 'even' ? t().hf.evenPageFooter : t().hf.footerLabel)}{sets.length >
      1
        ? ` · ${t().hf.section} ${index + 1}`
        : ''}
    </div>
    <div class="hf-bar" style="top: {box.top}px; left: {box.left + box.width}px;">
      <span class="hf-bar-label">{t().hf.insert}</span>
      <button class="hf-bar-btn" title={t().hf.pageNumberTitle} onmousedown={(e) => e.preventDefault()} onclick={() => insertField('pageNumber')}>{t().hf.pageNumber}</button>
      <button class="hf-bar-btn" title={t().hf.pageCountTitle} onmousedown={(e) => e.preventDefault()} onclick={() => insertField('pageCount')}>{t().hf.pageCount}</button>
      <button class="hf-bar-btn" title={t().hf.chapterTitle} onmousedown={(e) => e.preventDefault()} onclick={() => insertField('chapterField')}>{t().hf.chapter}</button>
      <span class="hf-bar-sep"></span>
      <button class="hf-bar-btn hf-bar-done" title={t().hf.doneTitle} onmousedown={(e) => e.preventDefault()} onclick={() => (hfActive = null)}>{t().hf.done}</button>
    </div>
  {/if}
</div>

<style>
  /* Sits inside the scaled .paper, like .band-layer. Zones opt back into pointer
     events so the margin areas are double-clickable to edit (Word behaviour). */
  .hf-layer {
    position: absolute;
    inset: 0;
    z-index: 22;
    pointer-events: none;
  }

  .hf-bg-layer {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  /* The background clone shows the frames behind the text and nothing else; the zone
     above shows everything but them. The one being edited shows them all, on top. */
  .hf-zone-bg {
    pointer-events: none;
  }
  .hf-zone-bg::after {
    content: none;
  }
  .hf-zone-bg :global(*) {
    visibility: hidden;
  }
  .hf-zone-bg :global([data-wrap='through']:not([data-in-front])),
  .hf-zone-bg :global([data-wrap='through']:not([data-in-front]) *) {
    visibility: visible;
  }
  .hf-has-bg:not(.hf-active) :global([data-wrap='through']:not([data-in-front])) {
    visibility: hidden;
  }

  /* A frame placed against the page is placed from the zone box (its containing block,
     so neither the editor nor its paragraph may take a position of their own): its x in
     the text column, which is the zone's, and its y from the page top, which the zone
     sits --hf-page-y below. Out of the flow, it leaves the zone's height alone. */
  .hf-zone :global(.tiptap),
  .hf-zone :global(:is(p, h1, h2, h3, h4, h5, h6):has(> [data-page-y])) {
    position: static !important;
  }
  .hf-zone :global([data-page-y]) {
    margin: 0 !important;
    left: var(--page-x);
    top: calc(var(--page-y) - var(--hf-page-y, 0px));
  }
  .hf-zone :global([data-from-body]) {
    top: calc(var(--hf-body-y, 0px) + var(--page-y) - var(--hf-page-y, 0px));
  }

  .hf-measure {
    position: absolute;
    top: 0;
    left: -10000px;
    visibility: hidden;
    pointer-events: none;
  }
  .hf-measure .hf-zone {
    position: static;
    height: auto;
  }
  /* The space above a footer's first block carries the zone's own gap to the body
     (import/odt.ts), so it is measured (.hf-measure) but not drawn: drawn, it would
     push the text off the page. */
  .hf-footer :global(.tiptap > :first-child) {
    --space-before: 0 !important;
  }

  .hf-zone {
    position: absolute;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    /* Content taller than the margin band spills into the margin (footer up, header
       down) — the zone auto-grows; the anchored edge stays put. */
    overflow: visible;
    --font-west: 'Liberation Serif', 'Times New Roman';
    --font-tail: var(--font-serif);
    font-family: var(--font-west), var(--font-asian, var(--font-tail)), var(--font-tail);
    font-size: 12pt;
    color: var(--color-page-text);
    cursor: text;
  }

  .hf-header {
    justify-content: flex-start;
  }
  .hf-footer {
    justify-content: flex-end;
  }

  /* The margin band around the zone, double-clickable like the zone itself. Not on the
     edited zone, where it would swallow the clicks into the live editor. */
  .hf-zone:not(.hf-active)::after {
    content: '';
    position: absolute;
    top: var(--hit-top, 0);
    bottom: var(--hit-bottom, 0);
    left: var(--hit-left, 0);
    right: var(--hit-right, 0);
  }

  /* Empty zone: invisible until hovered, then show a faint double-click hint. */
  .hf-empty::before {
    content: attr(data-hf-label);
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-family: var(--font-sans);
    opacity: 0;
    transition: opacity 0.12s;
  }
  .hf-footer.hf-empty::before {
    margin-top: auto;
  }
  .hf-empty:hover::before {
    opacity: 0.6;
  }

  /* Boundary affordance: a single dashed line at the edge facing the page body
     (footer top, header bottom) instead of a rectangle around the content. */
  .hf-active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--color-primary);
    pointer-events: none;
  }
  .hf-active.hf-footer::after {
    top: 0;
  }
  .hf-active.hf-header::after {
    bottom: 0;
  }

  /* Zone label tab, pinned to the zone's top-left corner. */
  .hf-tag {
    position: absolute;
    transform: translateY(calc(-100% - 2px));
    z-index: 150;
    padding: 1px 6px;
    background: var(--color-primary);
    color: #fff;
    font-family: var(--font-sans);
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    border-radius: calc(var(--radius) - 3px) calc(var(--radius) - 3px) 0 0;
    pointer-events: none;
    white-space: nowrap;
    user-select: none;
  }

  /* A zone's editor (live, source or clone) is a `.tiptap`, so it takes the body's block
     rules; the root's own page rules (96px padding, 1123px min-height, page gradient)
     are reset here — higher specificity, plus !important for the gradient. */
  .hf-zone :global(.tiptap) {
    padding: 0;
    min-height: 0;
    width: 100%;
    background: none !important;
    box-shadow: none;
    /* The zone's own size, which follows the document's default style — not the 12pt
       `.paper .tiptap` puts on the body. */
    font-size: inherit;
    line-height: 1.15;
    outline: none;
    /* Keep the editable root at its content height (min-height:0 would otherwise let
       the flex column shrink it to the band, hiding lines and misreporting height). */
    flex-shrink: 0;
    /* Drop the editor by the trailing-break line so the caret line overflows past the
       anchored edge while the real content stays put (set per active zone). */
    margin-bottom: var(--hf-tb-offset, 0px);
  }
  /* A paragraph ending in an inline atom (a page field) gets a phantom trailing <br> the
     static <p> lacks; ProseMirror marks that case with a separator <img>, so hide the
     break only then. A real Enter-made line has no separator and keeps its caret. */
  .hf-zone :global(.tiptap p:has(img.ProseMirror-separator) > br.ProseMirror-trailingBreak) {
    display: none;
  }
  .hf-zone :global([data-page-field]) {
    white-space: pre;
  }

  .hf-bar {
    position: absolute;
    transform: translate(calc(-100% - 4px), -100%);
    z-index: 151;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
    pointer-events: auto;
    white-space: nowrap;
  }

  .hf-bar-label {
    padding: 0 4px 0 2px;
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    user-select: none;
  }

  .hf-bar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.8rem;
    padding: 0 0.55rem;
    border: none;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.12s;
  }
  .hf-bar-btn:hover {
    background: var(--color-btn-hover);
  }
  .hf-bar-done {
    color: var(--color-primary);
    font-weight: 600;
  }

  .hf-bar-sep {
    width: 1px;
    align-self: stretch;
    margin: 3px 2px;
    background: var(--color-border);
  }
</style>
