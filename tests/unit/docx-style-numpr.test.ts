import { describe, it, expect } from 'vitest';
import { DocxStyles } from '../../src/lib/import/docxStyles';

// A style's w:numId and w:ilvl inherit along w:basedOn one by one, as Word reads them;
// a level left open is the one whose w:pStyle names the style.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const STYLES = `<w:styles ${W}>
  <w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:numPr><w:ilvl w:val="3"/></w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="H4"><w:basedOn w:val="Base"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Linked"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Plain"><w:basedOn w:val="Base"/></w:style>
</w:styles>`;
const lvl = (i: number, ps = '') => `<w:lvl w:ilvl="${i}"><w:numFmt w:val="decimal"/>${ps ? `<w:pStyle w:val="${ps}"/>` : ''}</w:lvl>`;
const NUMBERING = `<w:numbering ${W}><w:abstractNum w:abstractNumId="0">${lvl(0)}${lvl(1)}${lvl(2, 'Linked')}</w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
const parse = (x: string) => new DOMParser().parseFromString(x, 'application/xml');

describe("a paragraph style's numbering", () => {
  const s = new DocxStyles(parse(STYLES), parse(NUMBERING));
  it('takes the numId and the level from different styles of the chain', () => {
    expect(s.styleNumPr('H4')).toEqual({ numId: 1, ilvl: 3 });
  });
  it("takes an open level from the level that names the style", () => {
    expect(s.styleNumPr('Linked')).toEqual({ numId: 1, ilvl: 2 });
  });
  it('is none without a numId anywhere in the chain', () => {
    expect(s.styleNumPr('Plain')).toBeNull();
  });
});
