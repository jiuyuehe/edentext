import { PX_PER_CM } from './pageMargins';
import type { Orientation } from './pageOrientation';
import { docKey, docStore } from './docScope';

export type NamedPageFormat =
  | 'A3' | 'A4' | 'A5' | 'A6'
  | 'isoB4' | 'isoB5' | 'isoB6'
  | 'jisB4' | 'jisB5'
  | 'k16' | 'k32'
  | 'letter' | 'legal' | 'tabloid' | 'executive' | 'folio' | 'statement';
// Paper no named format fits, as its portrait box in cm ("12.3x20"): a file's own size
// survives import and export instead of snapping to A4.
export type CustomPageFormat = `${number}x${number}`;
export type PageFormat = NamedPageFormat | CustomPageFormat;

const KEY = docKey('edentext-page-format');

// Portrait page dimensions in cm per format (width < height). Landscape swaps them.
// Grouped A / ISO-B / JIS-B / Chinese / US, matching the Word/LibreOffice paper menus.
export const PAGE_FORMAT_CM: Record<NamedPageFormat, { w: number; h: number }> = {
  A3:        { w: 29.7,   h: 42 },
  A4:        { w: 21,     h: 29.7 },
  A5:        { w: 14.8,   h: 21 },
  A6:        { w: 10.5,   h: 14.8 },
  isoB4:     { w: 25,     h: 35.3 },
  isoB5:     { w: 17.6,   h: 25 },
  isoB6:     { w: 12.5,   h: 17.6 },
  jisB4:     { w: 25.7,   h: 36.4 },
  jisB5:     { w: 18.2,   h: 25.7 },
  k16:       { w: 18.4,   h: 26 },
  k32:       { w: 13,     h: 18.4 },
  letter:    { w: 21.59,  h: 27.94 },
  legal:     { w: 21.59,  h: 35.56 },
  tabloid:   { w: 27.94,  h: 43.18 },
  executive: { w: 18.415, h: 26.67 },
  folio:     { w: 21.59,  h: 33.02 },
  statement: { w: 13.97,  h: 21.59 },
};

const FORMATS = Object.keys(PAGE_FORMAT_CM) as NamedPageFormat[];
const CUSTOM_RE = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/;

export function isNamedFormat(f: string): f is NamedPageFormat {
  return (FORMATS as string[]).includes(f);
}

export function loadPageFormat(): PageFormat {
  const raw = docStore.getItem(KEY);
  return raw && (isNamedFormat(raw) || CUSTOM_RE.test(raw)) ? (raw as PageFormat) : 'A4';
}

export function savePageFormat(f: PageFormat): void {
  docStore.setItem(KEY, f);
}

// Portrait page box (cm) of a named or custom format; an unreadable one is A4.
export function formatDimsCm(format: PageFormat): { w: number; h: number } {
  if (isNamedFormat(format)) return PAGE_FORMAT_CM[format];
  const m = CUSTOM_RE.exec(format);
  return m ? { w: +m[1], h: +m[2] } : PAGE_FORMAT_CM.A4;
}

// Page box (cm) for a format + orientation; landscape swaps width/height.
export function pageDimsCm(format: PageFormat, orientation: Orientation): { w: number; h: number } {
  const { w, h } = formatDimsCm(format);
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

// Sets --user-page-{width,height} (px) on the document root, where they inherit
// down to .paper / .tiptap (see editor.css) and are read per layout pass by
// pageBreaks.ts. Supersedes applyOrientationVars, which only knew A4.
export function applyPageSizeVars(format: PageFormat, orientation: Orientation, target: HTMLElement = document.documentElement): void {
  const { w, h } = pageDimsCm(format, orientation);
  const root = target.style;
  root.setProperty('--user-page-width', `${w * PX_PER_CM}px`);
  root.setProperty('--user-page-height', `${h * PX_PER_CM}px`);
}

// Match a page's dimensions (cm, any orientation) to a known format, within a
// tolerance for producer rounding; null when nothing fits. Used by the importers.
export function formatFromCm(wCm: number, hCm: number, tolCm = 0.2): NamedPageFormat | null {
  const w = Math.min(wCm, hCm);
  const h = Math.max(wCm, hCm);
  for (const f of FORMATS) {
    const dims = PAGE_FORMAT_CM[f];
    if (Math.abs(dims.w - w) <= tolCm && Math.abs(dims.h - h) <= tolCm) return f;
  }
  return null;
}

// The format of a page read from a file: the named one it matches, else its own size,
// to the 0.1 mm within half a twip of it (DOCX's unit), else to 0.01 mm, which still
// writes back the same twip.
export function pageFormatOf(wCm: number, hCm: number): PageFormat {
  const named = formatFromCm(wCm, hCm);
  if (named || !(wCm > 0 && hCm > 0)) return named ?? 'A4';
  const r = (v: number) => {
    const tenth = Math.round(v * 100) / 100;
    return Math.abs(tenth - v) <= 2.54 / 1440 / 2 ? tenth : Math.round(v * 1000) / 1000;
  };
  return `${r(Math.min(wCm, hCm))}x${r(Math.max(wCm, hCm))}`;
}

export const PAGE_SIZE_MIN_CM = 1;
export const PAGE_SIZE_MAX_CM = 600;

// A typed page box (cm, width × height): the named format it equals, else a custom one,
// and the orientation its sides give; null outside 1–600 cm.
export function sizeSetup(wCm: number, hCm: number): { format: PageFormat; orientation: Orientation } | null {
  const ok = (v: number) => v >= PAGE_SIZE_MIN_CM && v <= PAGE_SIZE_MAX_CM;
  if (!ok(wCm) || !ok(hCm)) return null;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    format: formatFromCm(wCm, hCm, 0.005) ?? `${r(Math.min(wCm, hCm))}x${r(Math.max(wCm, hCm))}`,
    orientation: wCm > hCm ? 'landscape' : 'portrait',
  };
}
