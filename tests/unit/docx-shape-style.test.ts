import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// A shape's spPr leaves fill and line to its wps:style theme references; a custom
// outline takes the xfrm's flips.
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const shape = (xfrm: string, geom: string, txbx: boolean) => `<w:r><w:drawing><wp:anchor behindDoc="0" relativeHeight="1"><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="720000" cy="720000"/><wp:wrapNone/><wp:docPr id="1" name="s"/><a:graphic><a:graphicData uri="x"><wps:wsp><wps:spPr><a:xfrm ${xfrm}><a:off x="0" y="0"/><a:ext cx="720000" cy="720000"/></a:xfrm>${geom}</wps:spPr><wps:style><a:lnRef idx="3"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef></wps:style>${txbx ? '<wps:txbx><w:txbxContent><w:p/></w:txbxContent></wps:txbx>' : ''}<wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
const tri = '<a:custGeom><a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="100" y="0"/></a:lnTo><a:lnTo><a:pt x="0" y="60"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>';
const theme = `<?xml version="1.0"?><a:theme ${NS}><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="006465"/></a:accent1></a:clrScheme><a:fmtScheme><a:lnStyleLst><a:ln w="6350"/><a:ln w="12700"/><a:ln w="19050"/></a:lnStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/theme/theme1.xml': strToU8(theme),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${NS}><w:body><w:p>${shape('', '<a:prstGeom prst="rect"/>', false)}${shape('rot="10800000" flipH="1"', tri, true)}</w:p></w:body></w:document>`),
});

describe('a DrawingML shape', () => {
  const boxes: any[] = [];
  (function walk(n: any) { if (n.type === 'textBox') boxes.push(n.attrs); for (const c of n.content ?? []) walk(c); })(importDocx(docx).content);
  it('takes fill and line from its theme references', () => {
    expect(boxes[0].fillColor).toBe('#006465');
    expect(boxes[0].strokeColor).toBe('#003233');
    expect(boxes[0].strokeWidthPt).toBe(1.5);
  });
  it('mirrors a custom outline by its flips', () => {
    expect(boxes[1].rotation).toBe(180);
    expect(boxes[1].shapePath.replace(/\s+/g, ' ')).toMatch(/^M 100 0 L 0 0 L 100 60 Z/);
  });
});
