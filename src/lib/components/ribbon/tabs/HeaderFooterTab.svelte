<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import RibbonGroup from '../RibbonGroup.svelte';
  import RibbonButton from '../RibbonButton.svelte';
  import DateTimePicker from '../../DateTimePicker.svelte';
  import { captionClicks } from '../menu.svelte';
  import { clampHfDistance, DEFAULT_HF_DISTANCES, type HfDistances, type HfZone } from '../../../storage/headerFooter';
  import { t } from '../../../i18n/i18n.svelte';

  // Word's Header & Footer tab: what a zone can do, gathered while one is open. The
  // `editor` prop is the zone's own editor here (App hands the ribbon activeEditor).
  let {
    editor, hfActive = null,
    hfDistances = $bindable(DEFAULT_HF_DISTANCES),
    differentFirstPage = $bindable(false),
    differentOddEven = $bindable(false),
    onEditZone, onTabsDialog,
  }: {
    editor: Editor | null;
    hfActive?: HfZone | null;
    hfDistances?: HfDistances;
    differentFirstPage?: boolean;
    differentOddEven?: boolean;
    onEditZone?: (zone: HfZone | null) => void;
    onTabsDialog?: () => void;
  } = $props();

  let dateOpen = $state(false);

  // The same three atoms the bar at the zone's edge inserts.
  function insertField(type: 'pageNumber' | 'pageCount' | 'chapterField') {
    editor?.chain().focus().insertContent({ type }).run();
  }
</script>

<RibbonGroup label={t().ribbon.groups.headerFooter}>
  <RibbonButton variant="big" icon="header" label={t().ribbon.header} title={t().toolbarExpanded.editHeader} active={hfActive === 'header'} disabled={!editor} onclick={() => onEditZone?.('header')} />
  <RibbonButton variant="big" icon="footer" label={t().ribbon.footer} title={t().toolbarExpanded.editFooter} active={hfActive === 'footer'} disabled={!editor} onclick={() => onEditZone?.('footer')} />
</RibbonGroup>

<div class="ribbon-sep"></div>

<RibbonGroup label={t().hf.insert}>
  <RibbonButton variant="big" icon="pageNumber" label={t().hf.pageNumber} title={t().hf.pageNumberTitle} disabled={!editor} onclick={() => insertField('pageNumber')} />
  <RibbonButton variant="big" icon="pageCount" cmd="hfPageCount" label={t().hf.pageCount} title={t().hf.pageCountTitle} disabled={!editor} onclick={() => insertField('pageCount')} />
  <RibbonButton variant="big" icon="toc" cmd="hfChapter" label={t().hf.chapter} title={t().hf.chapterTitle} disabled={!editor} onclick={() => insertField('chapterField')} />
  <div class="rb-captioned" use:captionClicks>
    <DateTimePicker
      bind:open={dateOpen}
      {editor}
      onInsert={(opts, range) => editor?.chain().focus().setTextSelection(range).insertDateTimeField(opts).run()}
    />
    <span class="rb-caption">{t().ribbon.dateTime}</span>
  </div>
</RibbonGroup>

<div class="ribbon-sep"></div>

<!-- Word keeps these two out in the open rather than in a menu: which zone one is
     editing depends on them, so they are read as often as they are set. -->
<RibbonGroup label={t().ribbon.hfOptions}>
  <div class="hf-checks">
    <label class="check-row" data-cmd="differentFirstPage" title={t().toolbarExpanded.differentFirstPageHint}>
      <input type="checkbox" bind:checked={differentFirstPage} />
      {t().toolbarExpanded.differentFirstPage}
    </label>
    <label class="check-row" data-cmd="differentOddEven" title={t().toolbarExpanded.differentOddEvenHint}>
      <input type="checkbox" bind:checked={differentOddEven} />
      {t().toolbarExpanded.differentOddEven}
    </label>
  </div>
</RibbonGroup>

<div class="ribbon-sep"></div>

<RibbonGroup label={t().toolbarExpanded.position}>
  <div class="hf-fields">
    {#each ['header', 'footer'] as const as axis}
      <label class="field">
        <span>{t().toolbarExpanded.hfDist[axis]}</span>
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={hfDistances[axis]}
          onchange={(e) => (hfDistances = { ...hfDistances, [axis]: clampHfDistance(Number(e.currentTarget.value)) })}
        />
      </label>
    {/each}
  </div>
  <!-- The left/centre/right running head rides on the zone's tab stops; the ruler is
       the other way to them. -->
  <RibbonButton variant="big" icon="ruler" cmd="hfTabs" label={t().paragraphDialog.tabsButton} title={t().tabsDialog.title} disabled={!editor} onclick={() => onTabsDialog?.()} />
</RibbonGroup>

<div class="ribbon-sep"></div>

<RibbonGroup label={t().ribbon.groups.close}>
  <RibbonButton variant="big" icon="close" cmd="closeHf" label={t().ribbon.closeHf} title={t().hf.doneTitle} onclick={() => onEditZone?.(null)} />
</RibbonGroup>

<style>
  /* Two rows in the band's height, as the small buttons stack elsewhere. */
  .hf-checks, .hf-fields { display: flex; flex-direction: column; justify-content: center; gap: 6px; height: 100%; }

  .check-row, .field {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-family: var(--w-font);
    font-size: 12px;
    color: var(--w-text);
  }

  .field { justify-content: space-between; gap: 10px; }

  .field input {
    width: 58px;
    height: 22px;
    border: 1px solid var(--w-border-strong);
    border-radius: 3px;
    background: var(--w-surface);
    padding: 0 5px;
    color: var(--w-text);
    font: inherit;
    text-align: right;
  }
</style>
