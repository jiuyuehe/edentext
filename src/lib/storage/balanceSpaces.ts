import { docKey, docStore } from './docScope';

// Word's compatibility option "balance SBCS characters and DBCS characters", which
// LibreOffice keeps as BalanceSpacesAndIdeographicSpaces in settings.xml: every space is
// then set at half the font size (probed in LibreOffice). Off in both, so off here.

const KEY = docKey('edentext-balance-spaces');

export function loadBalanceSpaces(): boolean {
  return docStore.getItem(KEY) === 'true';
}

export function saveBalanceSpaces(on: boolean): void {
  if (on) docStore.setItem(KEY, 'true');
  else docStore.removeItem(KEY);
}
