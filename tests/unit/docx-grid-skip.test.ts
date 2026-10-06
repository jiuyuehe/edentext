import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// Grid columns a row leaves without a cell (w:gridBefore/w:gridAfter) draw nothing; the
// row's cells start after the skipped ones.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const tc = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body><w:tbl>
    <w:tblPr><w:tblBorders><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>
    <w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>
    <w:tr>${tc('a')}${tc('b')}${tc('c')}</w:tr>
    <w:tr><w:trPr><w:gridAfter w:val="1"/></w:trPr>${tc('d')}${tc('e')}</w:tr>
    <w:tr><w:trPr><w:gridBefore w:val="2"/></w:trPr>${tc('f')}</w:tr></w:tbl></w:body></w:document>`),
});

describe('a row with grid columns left empty', () => {
  const rows = (importDocx(docx).content as any).content.find((n: any) => n.type === 'table').content;
  const text = (c: any) => c.content[0].content?.[0]?.text ?? '';
  it('keeps the grid rectangular with borderless empty cells', () => {
    expect(rows[1].content.map(text)).toEqual(['d', 'e', '']);
    expect(rows[2].content.map(text)).toEqual(['', 'f']);
    expect(rows[2].content[0].attrs.colspan).toBe(2);
    for (const c of [rows[1].content[2], rows[2].content[0]])
      for (const side of ['borderTop', 'borderBottom', 'borderLeft', 'borderRight']) expect(c.attrs[side]).toBe('none');
  });
});
