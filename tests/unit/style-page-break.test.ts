import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A w:pageBreakBefore a paragraph style inherits through w:basedOn opens a new page;
// a direct w:val="0" turns it off.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="Base"><w:name w:val="Base"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:pageBreakBefore/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Chapter"><w:name w:val="Chapter"/><w:basedOn w:val="Base"/></w:style></w:styles>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:r><w:t>lead</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Chapter"/></w:pPr><w:r><w:t>breaks</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Chapter"/><w:pageBreakBefore w:val="0"/></w:pPr><w:r><w:t>stays</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const breaks = (doc: any) => doc.content.map((b: any) => b.attrs?.breakBefore ?? null);

describe('a page break before from the paragraph style chain', () => {
  const imported = importDocx(docx);
  it('imports on the paragraph', () => {
    expect(breaks(imported.content)).toEqual([null, 'page', null]);
  });
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(breaks(importDocx(bytes).content)).toEqual([null, 'page', null]);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(breaks(importOdt(bytes).content)).toEqual([null, 'page', null]);
  });
});
