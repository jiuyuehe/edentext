import { docKey, docStore } from './docScope';

// The page's line grid (Word's Layout ▸ Document Grid, LibreOffice's Text Grid "lines
// only"): every line a paragraph sets is rounded up to whole grid lines. Off by default
// in both, as it is here. Word keeps it as <w:docGrid w:type="lines" w:linePitch> in the
// section, ODF as style:layout-grid-mode="line" with its base height on the page layout.

const KEY = docKey('edentext-line-grid');

export type LineGrid = {
  on: boolean;
  /** One grid line, in pt (w:linePitch is twips, layout-grid-base-height a length). */
  pitchPt: number;
};

// 312 twips: the pitch a Chinese Word template sets.
export const DEFAULT_LINE_GRID: LineGrid = { on: false, pitchPt: 15.6 };

export function normalizeLineGrid(raw: unknown): LineGrid {
  const v = raw as Partial<LineGrid> | null | undefined;
  if (!v || typeof v !== 'object') return DEFAULT_LINE_GRID;
  const pitch = Number(v.pitchPt);
  return {
    on: v.on === true,
    pitchPt: Number.isFinite(pitch) && pitch >= 1 && pitch <= 200
      ? Math.round(pitch * 100) / 100 : DEFAULT_LINE_GRID.pitchPt,
  };
}

export function loadLineGrid(): LineGrid {
  try {
    const raw = docStore.getItem(KEY);
    return raw ? normalizeLineGrid(JSON.parse(raw)) : DEFAULT_LINE_GRID;
  } catch {
    return DEFAULT_LINE_GRID;
  }
}

export function saveLineGrid(grid: LineGrid): void {
  if (!grid.on) docStore.removeItem(KEY);
  else docStore.setItem(KEY, JSON.stringify(grid));
}
