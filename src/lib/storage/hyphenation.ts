import { docKey, docStore } from './docScope';

// Automatic hyphenation for the whole document: LibreOffice's Format ▸ Paragraph ▸
// Text Flow on the default paragraph style, Word's Layout ▸ Hyphenation. Off in both,
// so off here. ODF carries it as `fo:hyphenate` on that style, Word as
// `w:autoHyphenation` in settings.xml.

const KEY = docKey('edentext-hyphenation');

export const DEFAULT_HYPHENATION = false;

export function loadHyphenation(): boolean {
  return docStore.getItem(KEY) === 'true';
}

export function saveHyphenation(on: boolean): void {
  if (on) docStore.setItem(KEY, 'true');
  else docStore.removeItem(KEY);
}
