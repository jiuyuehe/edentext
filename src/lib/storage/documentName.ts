import { docKey, docStore } from './docScope';

// The user-visible document name (without the .odt extension). Drives the
// suggested filename on save; empty falls back to the heading-derived name.

const KEY = docKey('edentext-doc-name');

export function loadDocName(): string {
  return docStore.getItem(KEY) ?? '';
}

export function saveDocName(name: string): void {
  docStore.setItem(KEY, name);
}

// Drop a trailing .odt or .ott (case-insensitive) so the field shows just the name.
export function stripOdtExtension(name: string): string {
  return name.replace(/\.o[dt]t$/i, '');
}

// The save filename from the first heading that has text (sanitized, 50 chars at
// most); `document.odt` without one.
export function deriveFilename(json: { content?: { type?: string; content?: { text?: string }[] }[] }): string {
  const heading = json.content?.find((n) => n.type === 'heading' && n.content?.length);
  return filenameFor(heading?.content?.[0]?.text);
}

export function filenameFor(firstText: string | undefined): string {
  const name = firstText?.slice(0, 50).replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  return name ? `${name}.odt` : 'document.odt';
}

// Strip filesystem-illegal characters; keep spaces so user-typed titles read
// naturally (unlike the heading slug, which hyphenates).
export function sanitizeNameForFile(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
}

export type DocumentFormat = 'odt' | 'docx';

// The format the open document round-trips in. Absent at the .odt default, so only a
// document that came in as .docx writes anything.
const FORMAT_KEY = docKey('edentext-doc-format');

export function loadDocFormat(): DocumentFormat {
  return docStore.getItem(FORMAT_KEY) === 'docx' ? 'docx' : 'odt';
}

export function saveDocFormat(format: DocumentFormat): void {
  if (format === 'docx') docStore.setItem(FORMAT_KEY, format);
  else docStore.removeItem(FORMAT_KEY);
}

// Whether the open document is password-protected. The password itself is never
// stored, so after a reload this is what makes the first save ask for it again.
const PROTECTED_KEY = docKey('edentext-doc-protected');

export function loadDocProtected(): boolean {
  return docStore.getItem(PROTECTED_KEY) === '1';
}

export function saveDocProtected(on: boolean): void {
  if (on) docStore.setItem(PROTECTED_KEY, '1');
  else docStore.removeItem(PROTECTED_KEY);
}

// The file the document was last opened from or saved to: its recent-files id (the
// handle lives in that store's IndexedDB) and its modification time then, so a reload
// keeps Save writing there and a save notices the file changed elsewhere.
const FILE_KEY = docKey('edentext-doc-file');

export type DocFile = { id: string; modified: number };

export function loadDocFile(): DocFile | null {
  try {
    const f = JSON.parse(docStore.getItem(FILE_KEY) ?? 'null');
    return f && typeof f.id === 'string' && typeof f.modified === 'number' ? f : null;
  } catch {
    return null;
  }
}

export function saveDocFile(file: DocFile | null): void {
  if (file) docStore.setItem(FILE_KEY, JSON.stringify(file));
  else docStore.removeItem(FILE_KEY);
}
