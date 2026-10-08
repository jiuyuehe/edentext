// An alphabetical index in columns: Word opens the INDEX field in the paragraph that ends
// the section before and caches its rows in a multi-column section of their own.
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MARGINS = { top: 2, bottom: 2, left: 2, right: 2 };
const sect = (cols: string) =>
  `<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="11900" w:h="16840"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1134" w:left="1418"/>${cols}</w:sectPr>`;
const row = (style: string, text: string, page?: string) =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="4304"/></w:tabs></w:pPr>`
  + `<w:r><w:t>${text}</w:t></w:r>${page ? `<w:r><w:tab/><w:t>${page}</w:t></w:r>` : ''}</w:p>`;

const docx = zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?>
<w:document xmlns:w="${W}"><w:body>
  <w:p><w:r><w:t>Index</w:t></w:r></w:p>
  <w:p><w:pPr>${sect('<w:cols w:space="708"/>')}</w:pPr>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> INDEX \\e "</w:instrText></w:r><w:r><w:tab/><w:instrText xml:space="preserve">" \\c "2" \\z "1031" </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
  </w:p>
  ${row('Index1', 'Alpha', '3')}
  ${row('Index1', 'Beta')}
  ${row('Index2', 'gamma', '5')}
  <w:p><w:pPr>${sect('<w:cols w:num="2" w:space="720"/>')}</w:pPr></w:p>
  <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
  <w:p><w:r><w:t>After</w:t></w:r></w:p>
  ${sect('<w:cols w:space="708"/>')}
</w:body></w:document>`),
  'word/styles.xml': strToU8(`<?xml version="1.0"?>
<w:styles xmlns:w="${W}">
  <w:style w:type="paragraph" w:styleId="Index1"><w:name w:val="index 1"/><w:pPr><w:ind w:left="220" w:hanging="220"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Index2"><w:name w:val="index 2"/><w:pPr><w:ind w:left="440" w:hanging="220"/></w:pPr></w:style>
</w:styles>`),
});

const indexOf = (doc: any) => doc.content.content.find((n: any) => n.type === 'tableOfContents');

describe('an index in columns', () => {
  it('keeps the rows Word caches past the section break it opens in', () => {
    const { attrs } = indexOf(importDocx(docx));
    expect(attrs.index).toBe('alphabetical');
    // Beta heads its subentry and lists no page of its own.
    expect(attrs.entries).toEqual([
      { text: 'Alpha', level: 1, page: 3 },
      { text: 'Beta', level: 1, page: 1, pages: [] },
      { text: 'gamma', level: 2, page: 5 },
    ]);
    expect(attrs.columns).toBe(2);
    expect(attrs.columnGapCm).toBeCloseTo(1.27, 2);
    expect(attrs.levelStyles?.slice(0, 2)).toEqual(['Index 1', 'Index 2']);
  });

  it('keeps its columns through DOCX and ODF', async () => {
    const doc: any = importDocx(docx).content;
    for (const back of [
      importDocx(await buildDocx(doc, MARGINS, 'portrait')),
      importOdt(await buildOdt(doc, MARGINS, 'portrait')),
    ]) {
      const { attrs } = indexOf(back);
      expect(attrs.columns).toBe(2);
      expect(attrs.columnGapCm).toBeCloseTo(1.27, 2);
      expect(attrs.entries).toEqual(indexOf(importDocx(docx)).attrs.entries);
    }
  });
});
