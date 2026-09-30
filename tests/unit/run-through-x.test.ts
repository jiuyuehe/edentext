import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A frame in front of the text, anchored in an indented paragraph: its x counts from the
// text column, so ODT must name the paragraph area (LibreOffice's "paragraph"), not the
// area inside the indent, or LibreOffice adds the indent to it. Its y may start above
// the paragraph: nothing wraps around it, so it simply overlaps what is there.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const docx = zipSync({
  'word/_rels/document.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/i.png"/></Relationships>'),
  'word/media/i.png': Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0)),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:ind w:left="1948"/></w:pPr><w:r><w:drawing><wp:anchor behindDoc="0" allowOverlap="1">
      <wp:positionH relativeFrom="column"><wp:posOffset>360000</wp:posOffset></wp:positionH>
      <wp:positionV relativeFrom="paragraph"><wp:posOffset>-360000</wp:posOffset></wp:positionV>
      <wp:extent cx="540000" cy="540000"/><wp:wrapNone/><wp:docPr id="1" name="i"/>
      <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>
    </wp:anchor></w:drawing></w:r><w:r><w:t>text</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const frame = (doc: any) => doc.content[0].content.find((n: any) => n.type === 'image')?.attrs;
const frameX = (doc: any) => frame(doc)?.wrapOffset;

describe('a run-through frame in an indented paragraph', () => {
  const doc = importDocx(docx).content;
  it('keeps its column x through ODT', async () => {
    expect(frameX(doc)).toBe(1);
    const odt = await buildOdt(doc as any, DEFAULT_MARGINS);
    expect(strFromU8(unzipSync(odt)['content.xml'])).toMatch(/run-through[^>]*horizontal-rel="paragraph" /);
    expect(frameX(importOdt(odt).content)).toBe(1);
  });
  it('keeps a y above its paragraph through ODT and DOCX', async () => {
    expect(frame(doc).wrapOffsetY).toBe(-1);
    expect(frame(importOdt(await buildOdt(doc as any, DEFAULT_MARGINS)).content).wrapOffsetY).toBe(-1);
    expect(frame(importDocx(await buildDocx(doc as any, DEFAULT_MARGINS)).content).wrapOffsetY).toBe(-1);
  });
});

// ODF names the alignment (style:horizontal-pos) rather than an x: a run-through picture
// right-aligned in the column sits at the column's right edge.
describe('a run-through picture aligned in the column', () => {
  it('takes the x its ODF alignment gives', async () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: `data:image/png;base64,${PNG}`, width: 96, height: 96, wrap: 'through' } }] }] };
    const files = unzipSync(await buildOdt(doc as any, DEFAULT_MARGINS));
    const xml = strFromU8(files['content.xml']).replace('style:horizontal-rel="paragraph-content" style:horizontal-pos="left"', 'style:horizontal-rel="page-content" style:horizontal-pos="right"');
    expect(frameX(importOdt(zipSync({ ...files, 'content.xml': strToU8(xml) })).content)).toBeCloseTo(17 - 2.54, 2);
  });
});

// A run-through picture with no x of its own sits at its anchor character, in DOCX too.
describe('a run-through picture without an x', () => {
  it('keeps no x through DOCX', async () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ab' }, { type: 'image', attrs: { src: `data:image/png;base64,${PNG}`, width: 96, height: 96, wrap: 'through' } }] }] };
    const xml = strFromU8(unzipSync(await buildDocx(doc as any, DEFAULT_MARGINS))['word/document.xml']);
    expect(xml).toMatch(/<wp:positionH relativeFrom="character"><wp:posOffset>0</);
    expect(frameX(importDocx(await buildDocx(doc as any, DEFAULT_MARGINS)).content)).toBeUndefined();
  });
});
