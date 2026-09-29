<script lang="ts">
  import { loadRetention, saveRetention, volatile, type Retention } from '../storage/docScope';
  import { wordCompletion, setWordCompletion } from '../storage/wordCompletion.svelte';
  import { grammarEnabled, setGrammarEnabled } from '../spell/grammar.svelte';
  import { numberRecognition, setNumberRecognition } from '../storage/tableOptions.svelte';
  import { ACCENTS, loadAccent, saveAccent, applyAccent, type Accent, type ChromeMode, type ThemeMode } from '../storage/theme';
  import { LOCALES, LOCALE_LABELS, isLocale } from '../i18n/config';
  import { t, locale, setLocale } from '../i18n/i18n.svelte';
  import Icon from './ribbon/Icon.svelte';
  import Toggle from './Toggle.svelte';

  // App-wide settings, one section per side-bar entry. Each control writes through the
  // store that already owns the setting, so the ribbon and the dialogs stay in step.
  let {
    open = $bindable(false),
    themeMode,
    onSelectTheme,
    showRuler = $bindable(),
    showFormattingMarks = $bindable(),
    showFieldShading = $bindable(),
    chromeMode = $bindable(),
    recentCount,
    onClearRecent,
    onAutoCorrect,
    accentTarget,
  }: {
    open?: boolean;
    themeMode: ThemeMode;
    onSelectTheme: (mode: ThemeMode) => void;
    showRuler: boolean;
    showFormattingMarks: boolean;
    showFieldShading: boolean;
    chromeMode: ChromeMode;
    recentCount: number;
    onClearRecent: () => void;
    onAutoCorrect: () => void;
    accentTarget?: HTMLElement;
  } = $props();

  type Section = 'general' | 'editing' | 'view' | 'privacy';
  const SECTIONS: { id: Section; icon: 'settings' | 'autoCorrect' | 'ruler' | 'lock' }[] = [
    { id: 'general', icon: 'settings' },
    { id: 'editing', icon: 'autoCorrect' },
    { id: 'view', icon: 'ruler' },
    { id: 'privacy', icon: 'lock' },
  ];
  const THEMES: ThemeMode[] = ['light', 'dark', 'allBlack', 'auto'];
  const LEVELS: Retention[] = ['keep', 'closed', 'none'];

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let section = $state<Section>('general');
  let retention = $state<Retention>(loadRetention());
  let accent = $state<Accent>(loadAccent());

  function pickAccent(a: Accent) {
    accent = a;
    saveAccent(a);
    applyAccent(a, accentTarget ?? document.documentElement);
  }
  let wc = $derived(wordCompletion());

  $effect(() => {
    const el = dialogEl;
    if (!el) return;
    if (open && !el.open) { retention = loadRetention(); el.showModal(); }
    else if (!open && el.open) el.close();
  });
</script>

<dialog
  bind:this={dialogEl}
  onclose={() => (open = false)}
  onclick={(e) => e.target === dialogEl && (open = false)}
  aria-label={t().settings.title}
>
  <div class="shell">
    <nav aria-label={t().settings.title}>
      <h2>{t().settings.title}</h2>
      {#each SECTIONS as s (s.id)}
        <button class="nav-item" class:active={section === s.id} aria-current={section === s.id} onclick={() => (section = s.id)}>
          <Icon name={s.icon} size={16} />
          <span>{t().settings.sections[s.id]}</span>
        </button>
      {/each}
    </nav>

    <div class="pane">
      <button class="close" onclick={() => (open = false)} aria-label={t().common.close} title={t().common.close}>
        <Icon name="close" size={16} />
      </button>
      <h3>{t().settings.sections[section]}</h3>

      {#if section === 'general'}
        <div class="row">
          <div class="info"><div class="name">{t().appearance.language}</div><div class="desc">{t().settings.languageHint}</div></div>
          <select value={locale()} onchange={(e) => isLocale(e.currentTarget.value) && setLocale(e.currentTarget.value)}>
            {#each LOCALES as l (l)}<option value={l}>{LOCALE_LABELS[l]}</option>{/each}
          </select>
        </div>
        <div class="row stack">
          <div class="info"><div class="name">{t().appearance.title}</div><div class="desc">{t().settings.themeHint}</div></div>
          <div class="segmented" role="radiogroup" aria-label={t().appearance.title}>
            {#each THEMES as m (m)}
              <button role="radio" aria-checked={themeMode === m} class:on={themeMode === m} onclick={() => onSelectTheme(m)}>
                {#if m === 'dark'}<Icon name="themeDark" size={14} />{:else if m === 'light'}<Icon name="themeLight" size={14} />{:else}<span class="swatch {m}" aria-hidden="true"></span>{/if}{t().appearance[m]}
              </button>
            {/each}
          </div>
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().settings.accent}</div><div class="desc">{t().settings.accentHint}</div></div>
          <div class="accents" role="radiogroup" aria-label={t().settings.accent}>
            {#each ACCENTS as a (a)}
              <button role="radio" aria-checked={accent === a} class:on={accent === a} data-accent={a} title={t().settings.accents[a]} aria-label={t().settings.accents[a]} onclick={() => pickAccent(a)}></button>
            {/each}
          </div>
        </div>
        <!-- The modern chrome is still a beta, so only a development build offers the choice. -->
        {#if import.meta.env.DEV}
          <div class="row stack">
            <div class="info"><div class="name">{t().ribbon.chrome.title}</div></div>
            <div class="segmented two" role="radiogroup" aria-label={t().ribbon.chrome.title}>
              {#each (['ribbon', 'modern'] as const) as c (c)}
                <button role="radio" aria-checked={chromeMode === c} class:on={chromeMode === c} onclick={() => (chromeMode = c)}>
                  <span class="chrome-opt">{t().ribbon.chrome[c]}<small>{t().ribbon.chrome[`${c}Hint`]}</small></span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

      {:else if section === 'editing'}
        <div class="row">
          <div class="info">
            <div class="name">{t().wordCompletion.enabled}</div>
            <div class="desc">{volatile ? t().wordCompletion.offUnstored : t().wordCompletion.hint}</div>
          </div>
          <Toggle label={t().wordCompletion.enabled} checked={wc.enabled && !volatile} disabled={volatile}
            onchange={(on) => setWordCompletion({ ...wc, enabled: on })} />
        </div>
        <div class="row sub" class:dim={!wc.enabled || volatile}>
          <div class="info"><div class="name">{t().wordCompletion.appendSpace}</div><div class="desc">{t().wordCompletion.appendSpaceHint}</div></div>
          <Toggle label={t().wordCompletion.appendSpace} checked={wc.appendSpace} disabled={!wc.enabled || volatile}
            onchange={(on) => setWordCompletion({ ...wc, appendSpace: on })} />
        </div>
        <div class="row sub" class:dim={!wc.enabled || volatile}>
          <div class="info"><div class="name">{t().wordCompletion.minLength}</div><div class="desc">{t().wordCompletion.minLengthHint}</div></div>
          <input class="num" type="number" min="5" max="20" value={wc.minLength} disabled={!wc.enabled || volatile}
            onchange={(e) => setWordCompletion({ ...wc, minLength: Math.min(20, Math.max(5, Number(e.currentTarget.value) || wc.minLength)) })} />
        </div>
        <div class="row sub">
          <div class="info"><div class="name">{t().wordCompletion.clear}</div><div class="desc">{t().wordCompletion.collected(wc.words.length)}</div></div>
          <button class="btn" disabled={!wc.words.length} onclick={() => setWordCompletion({ ...wc, words: [] })}>{t().browserDocs.delete}</button>
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().settings.grammar}</div><div class="desc">{t().grammar.hint} {t().grammar.unavailable}</div></div>
          <Toggle label={t().settings.grammar} checked={grammarEnabled()} onchange={setGrammarEnabled} />
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().table.numberRecognition}</div><div class="desc">{t().table.numberRecognitionHint}</div></div>
          <Toggle label={t().table.numberRecognition} checked={numberRecognition()} onchange={setNumberRecognition} />
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().ribbon.autoCorrect}</div><div class="desc">{t().settings.autoCorrectHint}</div></div>
          <button class="btn" onclick={() => { open = false; onAutoCorrect(); }}>{t().settings.open}</button>
        </div>

      {:else if section === 'view'}
        <div class="row">
          <div class="info"><div class="name">{t().ruler.show}</div><div class="desc">{t().settings.rulerHint}</div></div>
          <Toggle label={t().ruler.show} checked={showRuler} onchange={(on) => (showRuler = on)} />
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().toolbarExpanded.formattingMarks}</div><div class="desc">{t().settings.formattingMarksHint}</div></div>
          <Toggle label={t().toolbarExpanded.formattingMarks} checked={showFormattingMarks} onchange={(on) => (showFormattingMarks = on)} />
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().view.fieldShadings}</div><div class="desc">{t().view.fieldShadingsTitle}</div></div>
          <Toggle label={t().view.fieldShadings} checked={showFieldShading} onchange={(on) => (showFieldShading = on)} />
        </div>

      {:else}
        <div class="row stack">
          <div class="info"><div class="name">{t().settings.documents}</div><div class="desc">{t().settings.autosaveHint}</div></div>
          <div class="choices" role="radiogroup" aria-label={t().settings.documents}>
            {#each LEVELS as level (level)}
              <label class="choice" class:on={retention === level}>
                <input type="radio" name="retention" checked={retention === level} onchange={() => saveRetention((retention = level))} />
                <span><span class="name">{t().settings.retention[level]}</span><em>{t().settings.retentionHint[level]}</em></span>
              </label>
            {/each}
          </div>
          <div class="desc">{t().settings.protectedHint}</div>
          {#if (retention === 'none') !== volatile}<div class="notice">{t().settings.restartNeeded}</div>{/if}
        </div>
        <div class="row">
          <div class="info"><div class="name">{t().app.recentFiles}</div><div class="desc">{t().settings.recentFilesHint}</div></div>
          <button class="btn" disabled={!recentCount} onclick={onClearRecent}>{t().app.clearRecentFiles}</button>
        </div>
      {/if}
    </div>
  </div>
</dialog>

<style>
  dialog {
    /* The global reset zeroes every margin, which also takes the auto centring a
       modal <dialog> gets by default. */
    margin: auto;
    border: 1px solid var(--w-border-strong);
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
    font-family: var(--font-sans);
    font-size: 0.85rem;
  }
  dialog::backdrop { background: rgba(0, 0, 0, 0.35); }

  .shell {
    display: flex;
    width: min(760px, calc(100vw - 32px));
    height: min(560px, calc(100vh - 64px));
  }

  nav {
    flex: none;
    width: 190px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 18px 10px;
    background: var(--w-hover);
    border-right: 1px solid var(--w-border);
  }
  h2 { font-size: 1rem; padding: 0 10px 12px; }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--w-text-dim);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .nav-item:hover { background: var(--w-pressed); color: var(--color-text); }
  .nav-item.active { background: var(--w-accent-soft); color: var(--w-accent); font-weight: 600; }

  .pane {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 18px 28px 24px;
  }
  h3 {
    font-size: 1.15rem;
    padding: 0 40px 10px 0;
    border-bottom: 1px solid var(--w-border);
  }
  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--w-text-dim);
    cursor: pointer;
  }
  .close:hover { background: var(--w-hover); color: var(--color-text); }

  .row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 14px 0;
    border-bottom: 1px solid var(--w-border);
  }
  .row:last-child { border-bottom: 0; }
  .row.stack { flex-direction: column; align-items: stretch; gap: 10px; }
  .row.sub { padding-left: 16px; }
  .row.dim .name { color: var(--w-text-tertiary); }
  .info { flex: 1; min-width: 0; }
  .name { font-weight: 500; }
  .desc, em { color: var(--color-text-muted); font-size: 0.78rem; line-height: 1.4; margin-top: 2px; }
  em { display: block; font-style: normal; }
  .notice {
    padding: 6px 10px;
    border-radius: 6px;
    background: var(--w-accent-soft);
    color: var(--w-accent);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .btn, select, .num {
    flex: none;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    padding: 5px 12px;
    font: inherit;
  }
  .btn { cursor: pointer; }
  .btn:hover:not(:disabled) { background: var(--color-btn-hover); }
  .btn:disabled, .num:disabled { opacity: 0.45; cursor: default; }
  select { max-width: 200px; cursor: pointer; }
  .num { width: 64px; padding: 5px 8px; }

  .segmented {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 3px;
    border-radius: 8px;
    background: var(--w-hover);
  }
  .segmented button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--w-text-dim);
    font: inherit;
    cursor: pointer;
  }
  .segmented button:hover { color: var(--color-text); }
  .segmented button.on { background: var(--color-surface); color: var(--color-text); box-shadow: 0 1px 3px rgb(0 0 0 / 15%); }
  .segmented.two { grid-template-columns: repeat(2, 1fr); }
  .chrome-opt { display: flex; flex-direction: column; align-items: center; }
  .chrome-opt small { font-size: 0.72rem; color: var(--color-text-muted); }
  .swatch { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--w-border-strong); }
  .swatch.allBlack { background: #000; }
  .swatch.auto { background: linear-gradient(135deg, #fff 50%, #2b2f36 50%); }
  .accents { display: flex; flex-wrap: wrap; gap: 6px; }
  .accents button { width: 22px; height: 22px; padding: 0; border: 2px solid var(--color-surface); border-radius: 50%; outline: 1px solid var(--w-border-strong); background: var(--brand-slate); cursor: pointer; }
  .accents button.on { outline: 2px solid var(--color-text); }

  .choices { display: flex; flex-direction: column; gap: 6px; }
  .choice {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 9px 12px;
    border: 1px solid var(--w-border);
    border-radius: 8px;
    cursor: pointer;
  }
  .choice:hover { background: var(--w-hover); }
  .choice.on { border-color: var(--w-accent-fill); background: var(--w-accent-soft); }
  .choice input { accent-color: var(--w-accent-fill); }

  /* A phone: the side bar becomes a row of tabs above the pane. */
  @media (max-width: 600px) {
    .shell { flex-direction: column; }
    nav { width: auto; flex-direction: row; overflow-x: auto; padding: 10px; border-right: 0; border-bottom: 1px solid var(--w-border); }
    h2 { display: none; }
    .nav-item { flex: none; }
    .pane { padding: 14px 16px 20px; }
    .segmented { grid-template-columns: repeat(2, 1fr); }
  }
</style>
