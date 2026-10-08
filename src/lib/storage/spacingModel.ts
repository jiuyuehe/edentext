import { docKey, docStore } from './docScope';

// How the space between two blocks is measured. LibreOffice adds the upper block's
// space-below to the lower one's space-above ('add', its native ODF behaviour) but takes
// only the larger of the two for a Word document ('max') — probed, and per document.
export type SpacingModel = 'add' | 'max';

const KEY = docKey('edentext-spacing-model');

export function loadSpacingModel(): SpacingModel {
  return docStore.getItem(KEY) === 'max' ? 'max' : 'add';
}

export function saveSpacingModel(m: SpacingModel): void {
  docStore.setItem(KEY, m);
}

// LibreOffice's "add spacing between paragraphs and tables at the beginning of pages"
// (ODF settings.xml AddParaTableSpacingAtStart, Word's w:suppressSpBfAfterPgBrk read the
// other way round). Off, the block that opens a page loses its space above however the
// page broke — probed: the same document renders its heading at 25.4mm with the option
// on and at 20.0mm with it off. On is the default both products write.
const AT_START_KEY = docKey('edentext-spacing-at-page-start');

export function loadSpacingAtPageStart(): boolean {
  return docStore.getItem(AT_START_KEY) !== 'false';
}

export function saveSpacingAtPageStart(on: boolean): void {
  if (on) docStore.removeItem(AT_START_KEY);
  else docStore.setItem(AT_START_KEY, 'false');
}
