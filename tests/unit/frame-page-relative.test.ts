// A frame whose vertical offset counts from the page the anchor lands on (Word's
// positionV relativeFrom="page", ODF's style:vertical-rel="page") keeps that relation
// through both formats — read as paragraph-relative it would move on every re-open.
import { describe, it, expect } from 'vitest';
import { buildOdt } from '../../src/lib/export/odt';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { importDocx } from '../../src/lib/import/docx';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

type N = any;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGNgYPgPRmAKABf2A/1+6zfzAAAAAElFTkSuQmCC';

const doc: N = { type: 'doc', content: [
  { type: 'paragraph', content: [
    { type: 'image', attrs: { src: PNG, width: 200, height: 100, wrap: 'through', wrapOffset: 1, wrapOffsetY: 17.6, wrapFromPage: true } },
    { type: 'textBox', attrs: { width: 300, height: 120, wrap: 'through', wrapOffset: 0, wrapOffsetY: 5.5, wrapFromPage: true, fillColor: '#34ABA2' },
      content: [{ type: 'paragraph' }] },
  ] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
] };

const find = (n: N, type: string): N => {
  if (n.type === type) return n;
  for (const c of n.content ?? []) { const hit = find(c, type); if (hit) return hit; }
  return null;
};

describe('a frame placed against the page', () => {
  it('round-trips through ODF', async () => {
    const back = importOdt(await buildOdt(doc)).content as N;
    expect(find(back, 'image').attrs).toMatchObject({ wrapFromPage: true, wrapOffsetY: 17.6 });
    expect(find(back, 'textBox').attrs).toMatchObject({ wrapFromPage: true, wrapOffsetY: 5.5 });
  });

  it('round-trips through DOCX', async () => {
    const back = importDocx(await buildDocx(doc)).content as N;
    expect(find(back, 'image').attrs).toMatchObject({ wrapFromPage: true, wrapOffsetY: 17.6 });
    expect(find(back, 'textBox').attrs).toMatchObject({ wrapFromPage: true, wrapOffsetY: 5.5 });
  });
});

// LibreOffice lays a floating frame that only states fo:min-width at the width its anchor
// leaves it; as a character it stays at its minimum.
describe('a text box that grows with its text', () => {
  const autoWidth = async (anchor: string) => {
    const files = unzipSync(await buildOdt(doc));
    const xml = strFromU8(files['content.xml'])
      .replace(/(<draw:frame\b[^>]*?)\ssvg:width="[^"]*"([^>]*>\s*<draw:text-box)/, '$1$2 fo:min-width="0.5cm"')
      .replace(/(<draw:frame\b[^>]*text:anchor-type=")[^"]*("[^>]*>\s*<draw:text-box)/, `$1${anchor}$2`);
    expect(xml).toMatch(/fo:min-width="0.5cm"/);
    files['content.xml'] = strToU8(xml);
    return find(importOdt(zipSync(files)).content as N, 'textBox').attrs.width;
  };

  it('spans the column when floating', async () => {
    expect(await autoWidth('paragraph')).toBeGreaterThan(600);
  });

  it('keeps its minimum as a character', async () => {
    expect(await autoWidth('as-char')).toBeLessThan(30);
  });
});

// A cover picture aligned to the page's top left rather than placed by coordinate
// (style:horizontal-pos="left", vertical-pos="top", both against the page) sits at its corner.
describe('a frame aligned to the page corner', () => {
  it('is placed from the page corner', async () => {
    const files = unzipSync(await buildOdt({ type: 'doc', content: [doc.content[0].content[0]].map((i: N) => ({ type: 'paragraph', content: [i] })) }));
    const xml = strFromU8(files['content.xml'])
      .replace(/style:horizontal-pos="[^"]*"/g, 'style:horizontal-pos="left"')
      .replace(/style:horizontal-rel="[^"]*"/g, 'style:horizontal-rel="page"')
      .replace(/style:vertical-pos="[^"]*"/g, 'style:vertical-pos="top"')
      .replace(/style:vertical-rel="[^"]*"/g, 'style:vertical-rel="page"');
    expect(xml).toMatch(/horizontal-pos="left"/);
    files['content.xml'] = strToU8(xml);
    expect(find(importOdt(zipSync(files)).content as N, 'image').attrs)
      .toMatchObject({ wrapFromPage: true, wrapOffsetY: 0, wrapOffset: -2 });
  });
});
