import { locale } from '../i18n/i18n.svelte';
import { applyTheme, loadTheme } from '../storage/theme';

let users = 0;
let stopThemeListener: (() => void) | null = null;

/**
 * Starts the small browser bootstrap that the original Svelte entry performs
 * before mounting App.svelte. Keeping it here lets the Vue host mount the
 * original application without duplicating its CSS/theme initialization.
 */
export function startNativeApp(): () => void {
  if (users++ === 0) {
    applyTheme(loadTheme());
    document.documentElement.lang = locale();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onThemeChange = () => {
      if (loadTheme() === 'auto') applyTheme('auto');
    };
    media.addEventListener('change', onThemeChange);
    stopThemeListener = () => media.removeEventListener('change', onThemeChange);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    users = Math.max(0, users - 1);
    if (users === 0) {
      stopThemeListener?.();
      stopThemeListener = null;
    }
  };
}
