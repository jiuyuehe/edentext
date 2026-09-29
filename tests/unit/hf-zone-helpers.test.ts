import { describe, it, expect } from 'vitest';
import { hfIsEmpty, hfUsesChapterField, EMPTY_HF_SET, type HfDoc } from '../../src/lib/storage/headerFooter';

const p = (text?: string) => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });

describe('zone helpers over every block', () => {
  it('a zone is empty only when its one block carries nothing', () => {
    expect(hfIsEmpty({ type: 'doc', content: [p()] })).toBe(true);
    // Each blank line takes its height in the band.
    expect(hfIsEmpty({ type: 'doc', content: [p(), p()] })).toBe(false);
    expect(hfIsEmpty({ type: 'doc', content: [p(), p('second')] })).toBe(false);
    expect(hfIsEmpty({ type: 'doc', content: [p(), { type: 'table', content: [] }] })).toBe(false);
  });

  it('finds a chapter field inside a table cell', () => {
    const header: HfDoc = { type: 'doc', content: [p(), { type: 'table', content: [{ type: 'tableRow', content: [
      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'chapterField' }] }] },
    ] }] }] };
    expect(hfUsesChapterField([{ ...EMPTY_HF_SET, header }])).toBe(true);
    expect(hfUsesChapterField([{ ...EMPTY_HF_SET, header: { type: 'doc', content: [p('x')] } }])).toBe(false);
  });
});
