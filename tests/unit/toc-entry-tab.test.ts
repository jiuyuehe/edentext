import { describe, it, expect } from 'vitest';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A contents row's tab between its number and its title is what sets the title at the
// level's hanging indent; read as a space, every title ran on behind its number.
const doc = {
  type: 'doc',
  content: [
    { type: 'tableOfContents', attrs: { title: '', maxLevel: 2, leader: '.', entries: [
      { text: '1\tPurpose', level: 1, page: 2 },
      { text: '1.2\tText conventions', level: 2, page: 3 },
    ] } },
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Purpose' }] },
  ],
};
const texts = (d: any) => d.content.find((n: any) => n.type === 'tableOfContents').attrs.entries.map((e: any) => e.text);

describe('a tab inside a contents row', () => {
  it('survives a DOCX round trip', async () => {
    const bytes = await buildDocx(doc as any, DEFAULT_MARGINS, 'portrait');
    expect(texts(importDocx(bytes).content)).toEqual(['1\tPurpose', '1.2\tText conventions']);
  });
  it('survives an ODT round trip', async () => {
    const bytes = await buildOdt(doc as any, DEFAULT_MARGINS, 'portrait');
    expect(texts(importOdt(bytes).content)).toEqual(['1\tPurpose', '1.2\tText conventions']);
  });
});

// A TOC field's \t switch maps styles to levels of their own, which can lie past \o's range.
describe('a TOC field mapping styles with \\t', () => {
  it('lists down to the deepest level either switch names', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const r = (x: string) => `<w:r>${x}</w:r>`;
    const docx = zipSync({
      '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body><w:p>`
        + r('<w:fldChar w:fldCharType="begin"/>') + r('<w:instrText xml:space="preserve"> TOC \\o "3-3" \\h \\t "Heading 1;1;Heading 4;4" </w:instrText>')
        + r('<w:fldChar w:fldCharType="separate"/>') + r('<w:t>1</w:t>') + r('<w:tab/>') + r('<w:t>Intro</w:t>') + r('<w:tab/>') + r('<w:t>2</w:t>')
        + `</w:p><w:p>${r('<w:fldChar w:fldCharType="end"/>')}</w:p></w:body></w:document>`),
    });
    const toc = (importDocx(docx).content as any).content.find((n: any) => n.type === 'tableOfContents');
    expect(toc.attrs.maxLevel).toBe(4);
    expect(toc.attrs.entries[0].text).toBe('1\tIntro');
  });
});
