import { describe, it, expect } from 'vitest';
import { readSpacing, W } from '../../src/lib/import/docxStyles';

const spacing = (attrs: string) =>
  new DOMParser().parseFromString(`<w:spacing xmlns:w="${W}" ${attrs}/>`, 'application/xml').documentElement;

describe('w:spacing in lines', () => {
  it('lets a nonzero line count win over the twips, a line being 12pt', () => {
    expect(readSpacing(spacing('w:before="0" w:beforeLines="50" w:after="0" w:afterLines="100"'))).toEqual({ before: 120, after: 240 });
  });

  it('keeps the twips beside a zero line count', () => {
    expect(readSpacing(spacing('w:after="160" w:afterLines="0"'))).toEqual({ after: 160 });
  });
});
