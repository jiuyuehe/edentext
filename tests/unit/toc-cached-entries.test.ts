// An imported index keeps the rows its file cached, as both word processors show them,
// and they survive a save through either format.
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { matchRows } from '../../src/lib/editor/extensions/tableOfContents';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MARGINS = { top: 2, bottom: 2, left: 2, right: 2 };

const row = (style: string, text: string, page: string) =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`;

// The cache deliberately lists one heading fewer than the document holds.
const docx = zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?>
<w:document xmlns:w="${W}"><w:body>
  <w:p>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Chapter</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>3</w:t></w:r>
  </w:p>
  ${row('TOC2', 'Section', '4')}
  <w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Left out</w:t></w:r></w:p>
</w:body></w:document>`),
  'word/styles.xml': strToU8(`<?xml version="1.0"?>
<w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/></w:style></w:styles>`),
});

const toc = (doc: any) => doc.content.content.find((n: any) => n.type === 'tableOfContents');
const CACHED = [{ text: '1\tChapter', level: 1, page: 3 }, { text: 'Section', level: 2, page: 4 }];

describe('an imported index', () => {
  it('shows the rows its DOCX field cached', () => {
    expect(toc(importDocx(docx)).attrs.entries).toEqual(CACHED);
  });

  it('keeps them through ODF and DOCX', async () => {
    const doc: any = importDocx(docx).content;
    expect(toc(importOdt(await buildOdt(doc, MARGINS, 'portrait'))).attrs.entries).toEqual(CACHED);
    expect(toc(importDocx(await buildDocx(doc, MARGINS, 'portrait'))).attrs.entries).toEqual(CACHED);
  });

  it('reads an ODF bibliography whose body is a table, one source per row', () => {
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
      + 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
      + 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
    const cell = (t: string) => `<table:table-cell><text:p>${t}</text:p></table:table-cell>`;
    const odt = zipSync({ 'content.xml': strToU8(`<?xml version="1.0"?><office:document-content ${NS}>
      <office:body><office:text><text:bibliography text:name="B"><text:index-body><table:table>
        <table:table-row>${cell('[1] ')}${cell('A. Author, Title.')}</table:table-row>
        <table:table-row>${cell('[2]')}${cell('B. Author, Other.')}</table:table-row>
      </table:table></text:index-body></text:bibliography></office:text></office:body></office:document-content>`) });
    expect(toc(importOdt(odt)).attrs.entries).toEqual([
      { text: '[1] A. Author, Title.', level: 1, page: 1 }, { text: '[2] B. Author, Other.', level: 1, page: 1 }]);
  });
});

describe('updating page numbers only', () => {
  it('finds each saved row\'s source in order, by text or past its number label', () => {
    const fresh = [{ text: '1 Intro' }, { text: 'Same' }, { text: 'Same' }, { text: '2 Method' }];
    expect(matchRows([{ text: 'Same' }, { text: '1.\tIntro' }, { text: 'Same' }, { text: 'Gone' }, { text: '2. Method' }], fresh))
      .toEqual([1, 0, 2, -1, 3]);
  });
});
