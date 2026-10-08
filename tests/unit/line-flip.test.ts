import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { getSchema } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A connector flipped across runs from its frame's right edge, so the head at its end
// points left; a head at the start alone is the same line run the other way.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const line = (flip: string, head: string, tail: string) => `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1800000" cy="360000"/><wp:docPr id="1" name="L"/>`
  + `<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvCnPr/>`
  + `<wps:spPr><a:xfrm${flip}><a:off x="0" y="0"/><a:ext cx="1800000" cy="360000"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>`
  + `<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:headEnd type="${head}"/><a:tailEnd type="${tail}"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp>`
  + `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
const docx = zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${line(' flipH="1"', 'none', 'triangle')}${line('', 'triangle', 'none')}</w:body></w:document>`),
});
const flips = (doc: any): string[] => {
  const out: string[] = [];
  (function walk(n: any) {
    if (n.type === 'textBox') out.push(`${n.attrs.shapeKind} ${n.attrs.flipH ? 'H' : '-'}${n.attrs.flipV ? 'V' : '-'}`);
    for (const c of n.content ?? []) walk(c);
  })(doc);
  return out;
};

describe('a line flipped across, or headed at its start', () => {
  // As the editor holds it: every attr the schema defaults filled in.
  const imported = getSchema(extensions).nodeFromJSON(importDocx(docx).content).toJSON();
  it('starts at the right with its head at the left end', () => {
    expect(flips(imported)).toEqual(['lineArrow H-', 'lineArrow HV']);
  });
  it('keeps the direction through ODF', async () => {
    expect(flips(importOdt(await buildOdt(imported as any, DEFAULT_MARGINS, 'portrait')).content)).toEqual(['lineArrow H-', 'lineArrow HV']);
  });
  it('keeps the direction through DOCX', async () => {
    expect(flips(importDocx(await buildDocx(imported as any, DEFAULT_MARGINS, 'portrait')).content)).toEqual(['lineArrow H-', 'lineArrow HV']);
  });
});
