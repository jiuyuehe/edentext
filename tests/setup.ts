// Node 26 ships its own `localStorage` global, undefined unless the process gets
// --localstorage-file, and it shadows the one jsdom installs. Modules that read
// storage at import time then throw before a single test runs.
if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true });
}

// jsdom has no alert(); a load failure reporting through one would print
// "Not implemented" from every suite that builds a spell-checking editor.
globalThis.alert = () => {};

// jsdom omits Range geometry; pagination runs in animation-frame callbacks after
// individual assertions finish, so an absent method surfaces as an unhandled error.
if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as DOMRectList;
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
      toJSON() { return this; },
    }) as DOMRect;
  }
}
