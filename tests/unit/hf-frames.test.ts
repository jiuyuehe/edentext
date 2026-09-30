// A header logo placed against the page keeps its place through both formats: the
// importers keep x against the text column (the page edge minus the left margin) and y
// against the page top, and both exporters write that pair back.
import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { buildDocx } from '../../src/lib/export/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNwaDgAAAKEAYEml6crAAAAAElFTkSuQmCC'),
  (c) => c.charCodeAt(0),
);
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rel = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`;

// 2cm from the page's left edge, 1cm below its top, behind the text; left margin 2.54cm.
const HEADER = `<?xml version="1.0"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${REL}"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:p><w:r><w:drawing><wp:anchor behindDoc="1" allowOverlap="1">
    <wp:positionH relativeFrom="page"><wp:posOffset>720000</wp:posOffset></wp:positionH>
    <wp:positionV relativeFrom="page"><wp:posOffset>360000</wp:posOffset></wp:positionV>
    <wp:extent cx="1080000" cy="360000"/><wp:wrapNone/>
    <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rIdLogo"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>
  </wp:anchor></w:drawing></w:r><w:r><w:t>Letterhead</w:t></w:r></w:p>
</w:hdr>`;
const DOCUMENT = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${REL}">
  <w:body><w:p><w:r><w:t>Body</w:t></w:r></w:p>
    <w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="567" w:footer="567"/></w:sectPr>
  </w:body>
</w:document>`;
const source = zipSync({
  'word/document.xml': strToU8(DOCUMENT),
  'word/_rels/document.xml.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'header', 'header1.xml')}</Relationships>`),
  'word/header1.xml': strToU8(HEADER),
  'word/_rels/header1.xml.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rIdLogo', 'image', 'media/logo.png')}</Relationships>`),
  'word/media/logo.png': PNG,
});

const logo = (zone: any) => zone?.content?.[0]?.content?.find((n: any) => n.type === 'image')?.attrs;
const place = (a: any) => ({ wrap: a?.wrap, x: a?.wrapOffset, y: a?.wrapOffsetY, fromPage: a?.wrapFromPage, inFront: !!a?.inFront });
const margins = { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 };

describe('page-placed header frame', () => {
  const first = importDocx(source);
  const want = { wrap: 'through', x: -0.54, y: 1, fromPage: true, inFront: false };

  it('is read against the text column and the page top', () => {
    expect(place(logo(first.header))).toEqual(want);
  });

  it('keeps its place through ODT and back through DOCX', async () => {
    const odt = await buildOdt(first.content as any, margins, 'portrait', { header: first.header, footer: null, pageCount: 1 });
    const viaOdt = importOdt(odt);
    expect(place(logo(viaOdt.header))).toEqual(want);
    const viaDocx = importDocx(await buildDocx(viaOdt.content as any, margins, 'portrait', { header: viaOdt.header, footer: null, pageCount: 1 }));
    expect(place(logo(viaDocx.header))).toEqual(want);
  });

  it('reads an ODT x measured from the page edge against the column', async () => {
    const files = unzipSync(await buildOdt(first.content as any, margins, 'portrait', { header: first.header, footer: null, pageCount: 1 }));
    // The same frame as LibreOffice may write it: x from the page edge.
    const styles = strFromU8(files['styles.xml'])
      .replace(/style:horizontal-rel="paragraph(?:-content)?"/, 'style:horizontal-rel="page"')
      .replace(/svg:x="-0\.54cm"/, 'svg:x="2cm"');
    expect(styles).toMatch(/horizontal-rel="page"[\s\S]*svg:x="2cm"|svg:x="2cm"[\s\S]*horizontal-rel="page"/);
    files['styles.xml'] = strToU8(styles);
    expect(place(logo(importOdt(zipSync(files)).header))).toEqual(want);
  });
});

// Measured from the text area's top (DOCX "margin", ODF "page-content"): a header frame
// that reaches into the body and pushes it down there.
describe('body-placed header frame', () => {
  const body = importDocx(zipSync({
    ...unzipSync(source),
    'word/header1.xml': strToU8(HEADER.replace('<wp:positionV relativeFrom="page">', '<wp:positionV relativeFrom="margin">')
      .replace('<wp:wrapNone/>', '<wp:wrapTopAndBottom/>')),
  }));
  const fromBody = (a: any) => ({ y: a?.wrapOffsetY, fromBody: !!a?.wrapFromBody, fromPage: !!a?.wrapFromPage });
  const want = { y: 1, fromBody: true, fromPage: false };

  it('is read against the body top', () => {
    expect(fromBody(logo(body.header))).toEqual(want);
  });

  it('keeps it through ODT and back through DOCX', async () => {
    const odt = await buildOdt(body.content as any, margins, 'portrait', { header: body.header, footer: null, pageCount: 1 });
    expect(strFromU8(unzipSync(odt)['styles.xml'])).toMatch(/vertical-rel="page-content"/);
    const viaOdt = importOdt(odt);
    expect(fromBody(logo(viaOdt.header))).toEqual(want);
    const viaDocx = importDocx(await buildDocx(viaOdt.content as any, margins, 'portrait', { header: viaOdt.header, footer: null, pageCount: 1 }));
    expect(fromBody(logo(viaDocx.header))).toEqual(want);
  });
});
