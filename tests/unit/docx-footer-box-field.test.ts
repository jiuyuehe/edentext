import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// Word's page-number gallery anchors the number in a text box at the right margin, next
// to the footer's own line. The zone keeps the box, and the box its live page number.
const FOOTER_XML = `<?xml version="1.0"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="${REL}"
       xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
  <w:p>
    <w:pPr><w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="left" w:pos="5687"/></w:tabs></w:pPr>
    <w:r>
      <mc:AlternateContent>
        <mc:Choice Requires="wps">
          <w:drawing>
            <wp:anchor>
              <wp:positionH relativeFrom="margin"><wp:posOffset>4968240</wp:posOffset></wp:positionH>
              <wp:extent cx="788670" cy="395605"/>
              <a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>
                <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
                  <w:r><w:fldChar w:fldCharType="begin"/></w:r>
                  <w:r><w:instrText xml:space="preserve"> PAGE  \\* Arabic  \\* MERGEFORMAT </w:instrText></w:r>
                  <w:r><w:fldChar w:fldCharType="separate"/></w:r>
                  <w:r><w:t>15</w:t></w:r>
                  <w:r><w:fldChar w:fldCharType="end"/></w:r>
                </w:p>
              </w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic>
            </wp:anchor>
          </w:drawing>
        </mc:Choice>
      </mc:AlternateContent>
    </w:r>
    <w:r><w:t>Annual report</w:t></w:r>
  </w:p>
</w:ftr>`;

const DOCUMENT_XML = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${REL}">
  <w:body>
    <w:p><w:r><w:t>Body</w:t></w:r></w:p>
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId1"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="567" w:footer="567"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const bytes = zipSync({
  'word/document.xml': strToU8(DOCUMENT_XML),
  'word/_rels/document.xml.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/footer" Target="footer1.xml"/></Relationships>`),
  'word/footer1.xml': strToU8(FOOTER_XML),
});

describe('DOCX footer text box', () => {
  it('keeps the text box, with a live page number in it', () => {
    const res = importDocx(bytes);
    const inline = (res.footer as any)?.content?.[0]?.content ?? [];
    const box = inline.find((n: any) => n.type === 'textBox');
    expect(inline.map((n: any) => n.type === 'text' ? n.text : `<${n.type}>`).join('')).toBe('<textBox>Annual report');
    expect(box.content[0].content).toEqual([{ type: 'pageNumber' }]);
    expect(box.content[0].attrs.textAlign).toBe('right');
    expect([...res.warnings]).not.toContain('Text boxes in headers or footers were flattened to text');
  });
});
