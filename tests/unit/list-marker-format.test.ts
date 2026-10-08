import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A level's own label formatting (w:lvl/w:rPr) colours and sizes the bullet whatever the
// item's text says, and comes back from both formats.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'),
  'word/numbering.xml': strToU8(`<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/><w:b/><w:color w:val="006465"/><w:sz w:val="24"/></w:rPr></w:lvl>
    </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>one</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>two</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const marker = (doc: any) => doc.content.find((n: any) => n.type === 'bulletList').attrs?.markerFormat;
const WANT = { fontWeight: 'bold', fontSize: '12pt', color: '#006465' };

describe("a numbering level's own label formatting", () => {
  const imported = importDocx(docx);
  it('imports onto the list, a symbol font left out', () => {
    expect(marker(imported.content)).toEqual(WANT);
  });
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait');
    expect(marker(importDocx(bytes).content)).toEqual(WANT);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait');
    expect(marker(importOdt(bytes).content)).toEqual(WANT);
  });
});
