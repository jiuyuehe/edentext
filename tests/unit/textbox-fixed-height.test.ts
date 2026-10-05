import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A Word text box without a:spAutoFit keeps its extent and clips what overflows, in Word
// and LibreOffice alike; with it the box grows. ODF says the same with fo:min-height.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const box = (fit: string) => `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1800000" cy="360000"/><wp:docPr id="1" name="Box"/>`
  + `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>`
  + `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1800000" cy="360000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>`
  + `<wps:txbx><w:txbxContent><w:p><w:r><w:t>text</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr>${fit}</wps:bodyPr></wps:wsp>`
  + `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${box('<a:noAutofit/>')}${box('<a:spAutoFit/>')}</w:body></w:document>`),
});

const boxes = (doc: any): any[] => {
  const out: any[] = [];
  (function walk(n: any) { if (n.type === 'textBox') out.push(n); for (const c of n.content ?? []) walk(c); })(doc);
  return out;
};

describe('a text box that keeps its height', () => {
  const imported = importDocx(docx);
  it('is fixed without a:spAutoFit and grows with it', () => {
    expect(boxes(imported.content).map((b) => b.attrs.fixedHeight ?? false)).toEqual([true, false]);
  });
  it('survives an ODT round trip either way', async () => {
    const back = importOdt(await buildOdt(imported.content as any, DEFAULT_MARGINS, 'portrait'));
    expect(boxes(back.content).map((b) => b.attrs.fixedHeight ?? false)).toEqual([true, false]);
  });
});
