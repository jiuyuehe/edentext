export type ThemeMode = 'light' | 'dark' | 'allBlack' | 'auto';

// Which chrome mounts above the document: the floating command island, or the
// Word-style ribbon. Both drive the same editor; only one is mounted at a time.
export type ChromeMode = 'modern' | 'ribbon';

const THEME_KEY = 'edentext-theme';
const ACCENT_KEY = 'edentext-accent';
const TOOLBAR_KEY = 'edentext-toolbar-expanded';
const CHROME_KEY = 'edentext-chrome';
const RIBBON_COLLAPSED_KEY = 'edentext-ribbon-collapsed';
const FORMATTING_MARKS_KEY = 'edentext-formatting-marks';
const FIELD_SHADING_KEY = 'edentext-field-shading';
const RULER_KEY = 'edentext-ruler';
const SPLIT_KEY = 'edentext-split';
const PAGE_COLUMNS_KEY = 'edentext-page-columns';
const RECENT_COMMANDS_KEY = 'edentext-recent-commands';

// Pages side by side. Each column is a live view of the whole document, so the
// count is capped — LibreOffice's own spinner goes further.
export const MAX_PAGE_COLUMNS = 4;

export function loadTheme(): ThemeMode {
    const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'allBlack' || saved === 'auto') return saved;
  return 'auto';
}

export function saveTheme(mode: ThemeMode): void {
    localStorage.setItem(THEME_KEY, mode);
}

export function loadToolbarExpanded(): boolean {
    return localStorage.getItem(TOOLBAR_KEY) === 'true';
}

export function saveToolbarExpanded(expanded: boolean): void {
    localStorage.setItem(TOOLBAR_KEY, String(expanded));
}

export function loadChromeMode(): ChromeMode {
    const stored = localStorage.getItem(CHROME_KEY);
    // 'classic' is the floating island's legacy stored name, kept readable.
    return stored === 'modern' || stored === 'classic' ? 'modern' : 'ribbon';
}

export function saveChromeMode(mode: ChromeMode): void {
    localStorage.setItem(CHROME_KEY, mode);
}

export function loadRibbonCollapsed(): boolean {
    return localStorage.getItem(RIBBON_COLLAPSED_KEY) === 'true';
}

export function saveRibbonCollapsed(collapsed: boolean): void {
    localStorage.setItem(RIBBON_COLLAPSED_KEY, String(collapsed));
}

// The command search's ids, most recent first.
export function loadRecentCommands(): string[] {
    try {
        const ids = JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) ?? '[]');
        return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

export function saveRecentCommands(ids: string[]): void {
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(ids));
}

export function loadFormattingMarks(): boolean {
    return localStorage.getItem(FORMATTING_MARKS_KEY) === 'true';
}

export function saveFormattingMarks(enabled: boolean): void {
    localStorage.setItem(FORMATTING_MARKS_KEY, String(enabled));
}

// LibreOffice draws its field shadings by default, and so does this.
export function loadFieldShading(): boolean {
    return localStorage.getItem(FIELD_SHADING_KEY) !== 'false';
}

export function saveFieldShading(enabled: boolean): void {
    localStorage.setItem(FIELD_SHADING_KEY, String(enabled));
}

// Unset, the ruler is on except on a phone-wide window, where it only costs a row.
export function loadRuler(): boolean {
    const v = localStorage.getItem(RULER_KEY);
    return v === null ? !window.matchMedia('(max-width: 600px)').matches : v === 'true';
}

export function saveRuler(enabled: boolean): void {
    localStorage.setItem(RULER_KEY, String(enabled));
}

// The split is off unless it was switched on; the divider's position is not kept,
// as neither word processor restores one either.
export function loadSplitView(): boolean {
    return localStorage.getItem(SPLIT_KEY) === 'true';
}

export function saveSplitView(enabled: boolean): void {
    localStorage.setItem(SPLIT_KEY, String(enabled));
}

export function loadPageColumns(): number {
    const n = parseInt(localStorage.getItem(PAGE_COLUMNS_KEY) ?? '1', 10);
  return Number.isFinite(n) ? Math.min(MAX_PAGE_COLUMNS, Math.max(1, n)) : 1;
}

export function savePageColumns(columns: number): void {
    localStorage.setItem(PAGE_COLUMNS_KEY, String(columns));
}

function resolveMode(mode: ThemeMode): 'light' | 'dark' | 'allBlack' {
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', resolveMode(mode));
}

// The chrome's accent colour; 'slate' is the logo's and stays the stored-nothing default.
export const ACCENTS = ['slate', 'blue', 'teal', 'green', 'violet', 'berry', 'graphite'] as const;
export type Accent = (typeof ACCENTS)[number];

export function loadAccent(): Accent {
  const saved = localStorage.getItem(ACCENT_KEY);
  return (ACCENTS as readonly string[]).includes(saved ?? '') ? (saved as Accent) : 'slate';
}

export function saveAccent(accent: Accent): void {
  if (accent === 'slate') localStorage.removeItem(ACCENT_KEY);
  else localStorage.setItem(ACCENT_KEY, accent);
}

export function applyAccent(accent: Accent): void {
  if (accent === 'slate') document.documentElement.removeAttribute('data-accent');
  else document.documentElement.setAttribute('data-accent', accent);
}
