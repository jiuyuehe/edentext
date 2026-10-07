import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { getSchema } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { importOdt } from '../../src/lib/import/odt';
import { importDocx } from '../../src/lib/import/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { builtinStyleSheet } from '../../src/lib/styles/styleSheet';
import { decimalOutline } from '../../src/lib/styles/outlineNumbering';

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';

// `headingList`: the list style Heading 1 itself carries, as a file converted from DOCX has it.
function odt(listName: string, headingList = ''): Uint8Array {
  const styles = `<?xml version="1.0"?><office:document-styles ${NS}><office:styles>
   <style:style style:name="Standard" style:family="paragraph"/>
   <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph"
    style:parent-style-name="Standard" style:default-outline-level="1"${headingList ? ` style:list-style-name="${headingList}"` : ''}/>
   <text:list-style style:name="WWNum2"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>
   <text:outline-style style:name="Outline"><text:outline-level-style text:level="1" style:num-format=""/></text:outline-style>
  </office:styles></office:document-styles>`;
  // LibreOffice's bullet on a heading: the list style rides the heading's automatic style.
  const content = `<?xml version="1.0"?><office:document-content ${NS}><office:automatic-styles>
   <style:style style:name="P1" style:family="paragraph" style:parent-style-name="Heading_20_1" style:list-style-name="L1"/>
   <text:list-style style:name="L1"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style>
  </office:automatic-styles><office:body><office:text>
   <text:list text:style-name="${listName}"><text:list-item><text:h text:style-name="P1" text:outline-level="1">Title</text:h></text:list-item></text:list>
  </office:text></office:body></office:document-content>`;
  return zipSync({ 'content.xml': strToU8(content), 'styles.xml': strToU8(styles) });
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function docx(): Uint8Array {
  const styles = `<?xml version="1.0"?><w:styles ${W}>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>`;
  const numbering = `<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">
<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const document = `<?xml version="1.0"?><w:document ${W}><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>
<w:sectPr/></w:body></w:document>`;
  return zipSync({
    'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(styles),
    'word/numbering.xml': strToU8(numbering),
  });
}

const schema = getSchema(extensions);
const shape = (content: { content?: { type: string; content?: { type: string; content?: { type: string }[] }[] }[] }) =>
  content.content!.map((b) => [b.type, b.content?.[0]?.content?.[0]?.type ?? null]);

describe('a list on a heading', () => {
  it('imports LibreOffice\'s bullet on a heading as a list item holding the heading', () => {
    const { content } = importOdt(odt('L1'));
    expect(() => schema.nodeFromJSON(content).check()).not.toThrow();
    expect(shape(content as never)).toEqual([['bulletList', 'heading']]);
  });

  it('keeps chapter numbering a plain heading', () => {
    expect(shape(importOdt(odt('Outline')).content as never)).toEqual([['heading', null]]);
    expect(shape(importOdt(odt('WWNum2', 'WWNum2')).content as never)).toEqual([['heading', null]]);
  });

  it('imports a heading with a bullet of its own from DOCX as a list item', () => {
    const { content } = importDocx(docx());
    expect(() => schema.nodeFromJSON(content).check()).not.toThrow();
    expect(shape(content as never)).toEqual([['bulletList', 'heading']]);
  });

  for (const outline of [null, decimalOutline()]) {
    it(`round-trips through both formats${outline ? ' beside chapter numbering' : ''}`, async () => {
      const doc = { type: 'doc', content: [
        { type: 'bulletList', content: [
          { type: 'listItem', content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Sub' }] }] }] },
          ] },
          { type: 'listItem', content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Next' }] }] },
        ] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
      ] };
      const sheet = { ...builtinStyleSheet(), outline };
      const margins = { top: 2, bottom: 2, left: 2, right: 2 };
      const odtBytes = await buildOdt(doc as never, margins, 'portrait', undefined, null, 'A4', sheet);
      expect(strFromU8(unzipSync(odtBytes)['content.xml'])).toMatch(/<text:list-item>\s*<text:h [^>]*text:outline-level="2">Title<\/text:h><text:p[^>]*>Body/);
      const docxBytes = await buildDocx(doc as never, margins, 'portrait', undefined, null, 'A4', sheet);
      // The ODT leg also holds the items after it to their own alignment, which they keep
      // only while the item blocks are matched in order.
      const odtBack = importOdt(odtBytes).content;
      const list = odtBack.content![0];
      expect(list.content![0].content!.map((b) => b.type)).toEqual(['heading', 'paragraph', 'bulletList']);
      expect(list.content![0].content![0].attrs?.level).toBe(2);
      expect(list.content![0].content![2].content![0].content![0].attrs?.textAlign).toBe('center');
      expect(list.content![1].content![0].attrs?.textAlign).toBe('right');
      expect(odtBack.content!.at(-1)!.type).toBe('heading');
      // DOCX has no further paragraph of an item: it is one indented to the item's text.
      const docxBack = importDocx(docxBytes).content;
      expect(docxBack.content![0].content![0].content!.map((b) => b.type)).toEqual(['heading', 'paragraph', 'bulletList']);
      expect(docxBack.content![0].content![0].content![0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
      expect(docxBack.content!.at(-1)!.type).toBe('heading');
    });
  }

  // A numbered list the heading shares with body text is no chapter numbering.
  it('round-trips a numbered list on a heading through DOCX', async () => {
    const item = (block: object) => ({ type: 'listItem', content: [block] });
    const doc = { type: 'doc', content: [{ type: 'orderedList', content: [
      item({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] }),
      item({ type: 'paragraph', content: [{ type: 'text', text: 'Next' }] }),
    ] }] };
    const margins = { top: 2, bottom: 2, left: 2, right: 2 };
    const back = importDocx(await buildDocx(doc as never, margins, 'portrait', undefined, null, 'A4', builtinStyleSheet()));
    expect(shape(back.content as never)).toEqual([['orderedList', 'heading']]);
    expect(back.styles?.outline ?? null).toBeNull();
  });
});
