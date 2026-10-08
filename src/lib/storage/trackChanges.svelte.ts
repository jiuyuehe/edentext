import { docKey, docStore } from './docScope';

// Whether the editor records revisions, as a reactive singleton (same shape as
// autoCorrect.svelte.ts): the extension reads recordChanges() on every transaction, the
// Review tab flips it. Off by default, as in both word processors — and a document that
// records nothing writes no revision registry.

const KEY = docKey('edentext-record-changes');

let current = $state(docStore.getItem(KEY) === 'true');

export function recordChanges(): boolean {
  return current;
}

export function setRecordChanges(on: boolean): void {
  current = on;
  if (on) docStore.setItem(KEY, 'true');
  else docStore.removeItem(KEY);
}
