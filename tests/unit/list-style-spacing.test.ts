import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A list item carries no style name, so the spacing its own paragraph style gives it
// rides the block; what the default style already gives it stays off.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:spacing w:before="40" w:after="120"/></w:pPr></w:style></w:styles>`),
  'word/numbering.xml': strToU8(`<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="-"/><w:pPr><w:ind w:left="357" w:hanging="357"/></w:pPr></w:lvl>
    </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr><w:r><w:t>one</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr><w:r><w:t>two</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const items = (doc: any) => {
  const list = doc.content.find((n: any) => n.type === 'bulletList');
  return list.content.map((li: any) => [li.content[0].attrs.spaceBefore ?? null, li.content[0].attrs.spaceAfter ?? null]);
};

describe('a list item whose paragraph style spaces it', () => {
  const imported = importDocx(docx);
  it('carries the style spacing the default style does not give', () => {
    expect(items(imported.content)).toEqual([[2, null], [2, null]]);
  });
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(items(importDocx(bytes).content)).toEqual([[2, null], [2, null]]);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(items(importOdt(bytes).content)).toEqual([[2, null], [2, null]]);
  });
});
