import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// A side-wrapped frame centred on the page or the column keeps the x that centres it:
// a float has no middle, and at x 0 it would sit on the left margin.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const box = (from: string) => `<w:p><w:r><w:drawing><wp:anchor allowOverlap="1"><wp:positionH relativeFrom="${from}"><wp:align>center</wp:align></wp:positionH>`
  + `<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="3600000" cy="360000"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="1" name="Box"/>`
  + `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>`
  + `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3600000" cy="360000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>`
  + `<wps:txbx><w:txbxContent><w:p><w:r><w:t>text</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>`
  + `</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
// A4, 2cm left and 3cm right margin: the page's centre sits 0.5cm right of the column's.
const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1701" w:bottom="1134" w:left="1134"/></w:sectPr>';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${box('margin')}${box('page')}${sect}</w:body></w:document>`),
});

describe('a side-wrapped frame centred on its band', () => {
  it('keeps the x that centres it on the column or the page', () => {
    const out: any[] = [];
    (function walk(n: any) { if (n.type === 'textBox') out.push(n.attrs); for (const c of n.content ?? []) walk(c); })(importDocx(docx).content);
    expect(out.map((a) => a.wrapOffset)).toEqual([3, 3.5]);
  });
});
