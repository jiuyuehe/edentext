// A header's pictures leave its stored JSON for the image store and come back on load.
import { describe, it, expect, vi } from 'vitest';
import { fakeIndexedDb } from '../fakeIdb';

const big = (fill: string) => `data:image/png;base64,${fill.repeat(5000)}`;
const zone = (src: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src } }] }] });
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('header and footer pictures', () => {
  it('are stored by key once the image store has them, and read back', async () => {
    const idb = fakeIndexedDb();
    vi.stubGlobal('indexedDB', { open: idb.open });
    localStorage.clear();
    const { saveHfDoc, saveExtraHfSections, loadHfPictures, EMPTY_HF_SET } = await import('../../src/lib/storage/headerFooter');
    const { putImages } = await import('../../src/lib/storage/imageStore');
    saveHfDoc('header', zone(big('A')) as any);
    saveExtraHfSections([{ ...EMPTY_HF_SET, footer: zone(big('B')) as any }]);
    // Inline at once, so nothing is lost before the store answers.
    expect(localStorage.getItem('edentext-header')).toContain('data:image');
    await settle();
    expect(localStorage.getItem('edentext-header')).not.toContain('data:image');
    expect(localStorage.getItem('edentext-hf-sections')).not.toContain('data:image');
    // The body's sweep leaves them alone.
    await putImages(new Map());
    expect(idb.data.size).toBe(2);
    const stored = await loadHfPictures();
    expect(stored?.missing).toBe(0);
    expect(JSON.stringify(stored?.zones.header)).toContain(big('A'));
    expect(JSON.stringify(stored?.sections[0].footer)).toContain(big('B'));
  });
});
