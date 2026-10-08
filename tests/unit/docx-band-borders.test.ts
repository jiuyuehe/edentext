import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';

// A row band's own top/bottom close every band row; where it declares neither, its insideH
// rules the edges inside the banded region (three styles probed in LibreOffice).
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const B = (side: string) => `<w:${side} w:val="single" w:sz="12" w:space="0" w:color="000000"/>`;
const STYLES: Record<string, string> = {
  own: `<w:tblPr><w:tblBorders>${B('top')}${B('bottom')}</w:tblBorders></w:tblPr><w:tblStylePr w:type="band1Horz"><w:tcPr><w:tcBorders>${B('top')}${B('bottom')}<w:insideH w:val="nil"/></w:tcBorders></w:tcPr></w:tblStylePr>`,
  inside: `<w:tblPr><w:tblBorders>${B('top')}${B('bottom')}${B('insideH')}</w:tblBorders></w:tblPr><w:tblStylePr w:type="band1Horz"><w:tcPr><w:tcBorders><w:insideH w:val="nil"/></w:tcBorders></w:tcPr></w:tblStylePr><w:tblStylePr w:type="band2Horz"><w:tcPr><w:tcBorders><w:insideH w:val="nil"/></w:tcBorders></w:tcPr></w:tblStylePr>`,
};
const tbl = (id: string) => `<w:tbl><w:tblPr><w:tblStyle w:val="${id}"/><w:tblLook w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid>`
  + Array.from({ length: 4 }, (_, i) => `<w:tr><w:tc><w:p><w:r><w:t>r${i}</w:t></w:r></w:p></w:tc></w:tr>`).join('') + '</w:tbl><w:p/>';
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${W}>` + Object.entries(STYLES).map(([k, v]) => `<w:style w:type="table" w:styleId="${k}"><w:name w:val="${k}"/>${v}</w:style>`).join('') + '</w:styles>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${tbl('own')}${tbl('inside')}</w:body></w:document>`),
});

// Per row: whether its top and bottom edge draw a line, from either cell's side.
const edges = (table: any) => {
  const sides = table.content.map((r: any) => r.content[0].attrs);
  const line = (v: unknown) => typeof v === 'string' && v !== 'none';
  return sides.slice(0, -1).map((a: any, i: number) => line(a.borderBottom) || line(sides[i + 1].borderTop));
};

describe('a row band in a Word table style', () => {
  const [own, inside] = (importDocx(docx).content as any).content.filter((n: any) => n.type === 'table');
  it('closes every band row with its own top and bottom', () => {
    expect(edges(own)).toEqual([true, true, true]);
  });
  it('rules nothing inside where it declares insideH nil and no edges', () => {
    expect(edges(inside)).toEqual([false, false, false]);
  });
});
