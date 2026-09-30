import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// LibreOffice sets a line with text by its runs alone: a paragraph mark larger or smaller
// than the runs it ends sets neither their size nor the block's line height.
const docxOf = (body: string) => zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`),
});
const para = (mark: number, run: number | null) =>
  `<w:p><w:pPr><w:rPr><w:sz w:val="${mark}"/></w:rPr></w:pPr>`
  + `<w:r>${run ? `<w:rPr><w:sz w:val="${run}"/></w:rPr>` : ''}<w:t>text</w:t></w:r></w:p>`;
const first = (body: string) => (importDocx(docxOf(body)).content as any).content[0];

describe('a paragraph mark whose runs agree on another size', () => {
  it('takes the runs size', () => {
    expect(first(para(28, 26)).attrs?.fontSize).toBe('13pt');
  });
  it('keeps the style size where the runs state none', () => {
    const p = first(para(56, null));
    expect(p.attrs?.fontSize ?? null).toBeNull();
    expect(p.content[0].marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontSize ?? null).toBeNull();
  });
  it('still sets an empty paragraph', () => {
    expect(first('<w:p><w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:pPr></w:p>').attrs?.fontSize).toBe('14pt');
  });
});
