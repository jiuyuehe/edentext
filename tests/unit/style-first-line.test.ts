import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A paragraph style's first-line offset — a hanging indent (contents levels hang their
// numbers) or a first-line one — belongs to the style and travels with it.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="Hang"><w:name w:val="Hang"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:ind w:left="850" w:hanging="680"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Hang2"><w:name w:val="Hang2"/><w:basedOn w:val="Hang"/>
      <w:pPr><w:ind w:left="1191"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="First"><w:name w:val="First"/><w:basedOn w:val="Normal"/>
      <w:pPr><w:ind w:firstLine="567"/></w:pPr></w:style></w:styles>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="Hang"/></w:pPr><w:r><w:t>a</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Hang2"/></w:pPr><w:r><w:t>b</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="First"/></w:pPr><w:r><w:t>c</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const firsts = (styles: any) => ['Hang', 'Hang2', 'First'].map((n) => styles.paragraph[n]?.para?.indentFirst);

describe('a paragraph style with a first-line offset', () => {
  const imported = importDocx(docx);
  it('imports it, a derived style inheriting it', () => {
    expect(firsts(imported.styles)).toEqual([-1.2, undefined, 1]);
  });
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(firsts(importDocx(bytes).styles)).toEqual([-1.2, undefined, 1]);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait', undefined, null, 'A4', imported.styles);
    expect(firsts(importOdt(bytes).styles)).toEqual([-1.2, undefined, 1]);
  });
});
