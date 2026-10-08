import { docKey, docStore } from './docScope';

export type Orientation = 'portrait' | 'landscape';

const KEY = docKey('edentext-page-orientation');

export function loadOrientation(): Orientation {
  return docStore.getItem(KEY) === 'landscape' ? 'landscape' : 'portrait';
}

export function saveOrientation(o: Orientation): void {
  docStore.setItem(KEY, o);
}
