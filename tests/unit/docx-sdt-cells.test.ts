import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// A content control around a cell or a whole row keeps the cell's text in the table.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const tc = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
const sdt = (inner: string) => `<w:sdt><w:sdtPr><w:text/></w:sdtPr><w:sdtContent>${inner}</w:sdtContent></w:sdt>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:tbl><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>
      <w:tr>${tc('Type:')}${sdt(tc('value'))}</w:tr>
      ${sdt(`<w:tr>${tc('row')}${tc('control')}</w:tr>`)}
    </w:tbl><w:p/></w:body></w:document>`),
});

describe('content controls inside a table', () => {
  it('keep the cells they wrap', () => {
    const table = (importDocx(docx).content as any).content[0];
    const rows = table.content.map((r: any) => r.content.map((c: any) => c.content[0].content?.[0]?.text ?? ''));
    expect(rows).toEqual([['Type:', 'value'], ['row', 'control']]);
  });
});
