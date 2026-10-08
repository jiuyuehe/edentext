import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// Numbering a paragraph style brings is outranked by that style's own indent, but not by
// a base style's below it; numbering set on the paragraph itself takes the level's (all
// probed in LibreOffice).
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const lvl = '<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="*"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
    <w:style w:type="paragraph" w:styleId="SNum"><w:name w:val="SNum"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:ind w:left="357" w:hanging="357"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="SInd"><w:name w:val="SInd"/><w:pPr><w:ind w:left="357" w:hanging="357"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="SNumOnInd"><w:name w:val="SNumOnInd"/><w:basedOn w:val="SInd"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style></w:styles>`),
  'word/numbering.xml': strToU8(`<?xml version="1.0"?><w:numbering ${W}>
    <w:abstractNum w:abstractNumId="0">${lvl}</w:abstractNum><w:abstractNum w:abstractNumId="1">${lvl}</w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="SNum"/></w:pPr><w:r><w:t>style</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:pPr><w:pStyle w:val="SInd"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>direct</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:pPr><w:pStyle w:val="SNumOnInd"/></w:pPr><w:r><w:t>base</w:t></w:r></w:p>
  </w:body></w:document>`),
});

describe('a list item whose paragraph style indents it', () => {
  const lists = (importDocx(docx).content as any).content.filter((n: any) => n.type === 'bulletList');
  it('takes the style indent where the style brings the numbering', () => {
    // 0.63cm absolute: one LIST_LEFT_STEP_CM (1.27) less 0.64.
    expect(lists[0].attrs?.indent).toBe(-0.64);
  });
  it("takes the level's where the paragraph sets the numbering", () => {
    expect(lists[1].attrs?.indent).toBe(1.27);
  });
  it("takes the level's over a base style's indent", () => {
    expect(lists[2].attrs?.indent).toBe(1.27);
  });
});
