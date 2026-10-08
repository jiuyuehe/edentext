import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A row that may not break across pages (w:cantSplit, ODF's row fo:keep-together)
// keeps the flag through both formats.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const row = (cant: boolean) => `<w:tr>${cant ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}<w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body><w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>${row(true)}${row(false)}</w:tbl><w:p/></w:body></w:document>`),
});
const flags = (doc: any) => doc.content.find((n: any) => n.type === 'table').content.map((r: any) => r.attrs?.cantSplit ?? false);

describe('a row that may not break across pages', () => {
  const imported = importDocx(docx);
  it('imports from w:cantSplit', () => expect(flags(imported.content)).toEqual([true, false]));
  it('survives a DOCX round trip', async () => {
    expect(flags(importDocx(await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait')).content)).toEqual([true, false]);
  });
  it('survives an ODT round trip', async () => {
    expect(flags(importOdt(await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait')).content)).toEqual([true, false]);
  });
});
