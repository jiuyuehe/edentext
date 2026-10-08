import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// A cell's paragraphs carry no style name, so their style chain is baked in — its
// alignment along with its spacing and tabs.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="Centred"><w:name w:val="Centred"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style></w:styles>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body><w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>
    <w:tr><w:tc><w:p><w:pPr><w:pStyle w:val="Centred"/></w:pPr><w:r><w:t>caption</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`),
});

describe('a cell paragraph whose style centres it', () => {
  it('is centred', () => {
    let attrs: any = null;
    (function walk(n: any) { if (n.type === 'paragraph' && n.content?.[0]?.text === 'caption') attrs = n.attrs; for (const c of n.content ?? []) walk(c); })(importDocx(docx).content);
    expect(attrs?.textAlign).toBe('center');
  });
});
