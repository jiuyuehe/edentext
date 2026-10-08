<script module lang="ts">
  export type BusyTask = 'loading' | 'pdf' | 'print';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { isLayingOut } from '../editor/extensions/pageBreaks';
  import { t } from '../i18n/i18n.svelte';


  // `progress`: the share of the task done (0…1), where the task can tell.
  let { editor = null, task = null, progress = null }: {
    editor?: Editor | null; task?: BusyTask | null; progress?: number | null;
  } = $props();

  // A layout running this long without a break shows; a shorter one would only flicker.
  const SHOW_AFTER_MS = 300;
  const POLL_MS = 100;
  // Layout behind typing is not announced: the typed text is its own feedback.
  const TYPING_MS = 1000;
  let typedAt = 0;
  const typed = () => { typedAt = performance.now(); };
  window.addEventListener('keydown', typed, true);

  // The first layout after start-up is the document loading; so is the one an opened file
  // leaves running once its own task is done. Either shows at once, as the task did.
  let after: 'loading' | null = $state('loading');
  let seen = false;
  let since = 0;
  let layout = $state(false);
  let longLayout = $state(false);

  $effect(() => {
    if (task === 'loading') { after = task; seen = false; }
  });

  const timer = setInterval(() => {
    layout = !!editor && !editor.isDestroyed && isLayingOut(editor.view);
    if (layout) {
      seen = true;
      since ||= performance.now();
      const now = performance.now();
      if (now - typedAt < TYPING_MS) since = now;
      longLayout = now - since >= SHOW_AFTER_MS;
      return;
    }
    since = 0;
    longLayout = false;
    if (seen && !task) { after = null; seen = false; }
  }, POLL_MS);
  onDestroy(() => { clearInterval(timer); window.removeEventListener('keydown', typed, true); });

  let label = $derived.by(() => {
    const busy = t().status.busy;
    if (task) return busy[task];
    if (layout && after) return busy[after];
    return longLayout ? busy.updating : null;
  });
</script>

<span class="busy" role="status" aria-live="polite">
  {#if label}
    <span class="spinner" aria-hidden="true"></span>{label}
    {#if task && progress != null}
      <span class="bar" aria-hidden="true"><span style:width="{Math.round(progress * 100)}%"></span></span>
      {Math.round(progress * 100)} %
    {/if}
  {/if}
</span>

<style>
  .busy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--color-text);
    white-space: nowrap;
  }

  /* A transform animation: Chromium runs it off the main thread, so it keeps turning
     while a long synchronous step blocks everything else. */
  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    opacity: 0.7;
    animation: busy-spin 0.8s linear infinite;
  }

  .bar {
    width: 60px;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, currentColor 20%, transparent);
    overflow: hidden;
  }

  .bar > span {
    display: block;
    height: 100%;
    background: currentColor;
    opacity: 0.7;
  }

  @keyframes busy-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }
</style>
