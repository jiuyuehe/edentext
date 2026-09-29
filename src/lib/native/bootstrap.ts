import { locale, setLanguageTarget } from '../i18n/i18n.svelte';
import { applyAccent, applyTheme, loadAccent, loadTheme } from '../storage/theme';

let users = 0;
let stopThemeListener: (() => void) | null = null;
const themeTargets = new Set<HTMLElement>();

/**
 * Starts the small browser bootstrap that the original Svelte entry performs
 * before mounting App.svelte. Keeping it here lets the Vue host mount the
 * original application without duplicating its CSS/theme initialization.
 */
export function startNativeApp(themeTarget?: HTMLElement): () => void {
  if (themeTarget) {
    themeTargets.add(themeTarget);
    setLanguageTarget(themeTarget);
  }
  if (users++ === 0) {
    applyCurrentTheme();
    applyCurrentAccent();
    if (!themeTarget) document.documentElement.lang = locale();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onThemeChange = () => {
      if (loadTheme() === 'auto') applyCurrentTheme();
    };
    media.addEventListener('change', onThemeChange);
    stopThemeListener = () => media.removeEventListener('change', onThemeChange);
  }
  if (themeTarget && users > 1) {
    applyTheme(loadTheme(), themeTarget);
    applyAccent(loadAccent(), themeTarget);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (themeTarget) {
      themeTargets.delete(themeTarget);
      themeTarget.removeAttribute('data-theme');
      themeTarget.removeAttribute('data-accent');
      if (themeTargets.size === 0) setLanguageTarget(null);
      else setLanguageTarget([...themeTargets].at(-1) ?? null);
    }
    users = Math.max(0, users - 1);
    if (users === 0) {
      stopThemeListener?.();
      stopThemeListener = null;
    }
  };
}

function applyCurrentTheme(): void {
  const mode = loadTheme();
  if (themeTargets.size) {
    for (const target of themeTargets) applyTheme(mode, target);
  } else {
    applyTheme(mode);
  }
}

function applyCurrentAccent(): void {
  const accent = loadAccent();
  if (themeTargets.size) {
    for (const target of themeTargets) applyAccent(accent, target);
  } else {
    applyAccent(accent);
  }
}
