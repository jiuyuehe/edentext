// A full storage warns once, the same for the body and the header or footer, and points
// at the other documents where there are any to delete.
import { describe, it, expect, vi } from 'vitest';

describe('a full storage', () => {
  it('warns once, naming the other documents when the browser keeps some', async () => {
    localStorage.clear();
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { t } = await import('../../src/lib/i18n/i18n.svelte');
    const { saveHfDoc } = await import('../../src/lib/storage/headerFooter');
    const { warnStorageFull } = await import('../../src/lib/storage/autosave');
    localStorage.setItem('edentext-live@other', String(Date.now()));
    localStorage.setItem('edentext-doc@other', '{"type":"doc","content":[]}');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    saveHfDoc('header', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] });
    warnStorageFull('edentext-doc', new Error('full'));
    setItem.mockRestore();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(t().dialogs.autosaveQuotaOthers);
  });
});
