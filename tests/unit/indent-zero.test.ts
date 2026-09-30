import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A paragraph's own w:ind w:left="0" beats its style's indent; dropping it as "no
// indent" drew the paragraph at the style's 3.44cm.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="Deep"><w:name w:val="Deep"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:ind w:left="1948"/></w:pPr></w:style></w:styles>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="Deep"/><w:ind w:left="0"/></w:pPr><w:r><w:t>flush</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Deep"/></w:pPr><w:r><w:t>styled</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const indents = (doc: any) => doc.content.map((b: any) => b.attrs?.indent ?? null);

describe('a direct zero left indent over a style that indents', () => {
  const imported = importDocx(docx);
  it('imports as an explicit 0', () => {
    expect(indents(imported.content)).toEqual([0, null]);
  });
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(indents(importDocx(bytes).content)).toEqual([0, null]);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(indents(importOdt(bytes).content)).toEqual([0, null]);
  });
});
