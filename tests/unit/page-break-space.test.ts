import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildOdt } from '../../src/lib/export/odt';

// Where a block opening a page keeps its space above (all probed in LibreOffice): Word's
// 2013 layout drops it after a paragraph's own page break, an older file keeps it, a
// section start always does, and a page break character never leaves it.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const spaced = '<w:spacing w:before="480"/>';
const sect = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>';
const body = `<w:p><w:r><w:t>first</w:t></w:r></w:p>`
  + `<w:p><w:pPr><w:pageBreakBefore/>${spaced}</w:pPr><w:r><w:t>own break</w:t></w:r></w:p>`
  + `<w:p><w:pPr>${sect}</w:pPr><w:r><w:t>ends section</w:t></w:r></w:p>`
  + `<w:p><w:pPr><w:pageBreakBefore/>${spaced}</w:pPr><w:r><w:t>opens section</w:t></w:r></w:p>`
  + `<w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:pPr>${spaced}</w:pPr><w:r><w:t>after a break character</w:t></w:r></w:p>`;
const docx = (mode: string | null) => zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${body}${sect}</w:body></w:document>`),
  ...(mode ? { 'word/settings.xml': strToU8(`<?xml version="1.0"?><w:settings ${W}><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="${mode}"/></w:compat></w:settings>`) } : {}),
});
const spaces = (doc: any): Record<string, unknown> => Object.fromEntries((doc.content as any[])
  .filter((n) => n.content?.[0]?.text && n.content[0].text !== 'first' && n.content[0].text !== 'ends section')
  .map((n) => [n.content[0].text, n.attrs?.spaceBefore]));

describe('the space above a block opening a page', () => {
  it('goes after its own break in Word 2013 layout, but not at a section start', () => {
    expect(spaces(importDocx(docx('15')).content)).toEqual({ 'own break': 0, 'opens section': 24, 'after a break character': 0 });
  });
  it('stays after its own break in an older file', () => {
    expect(spaces(importDocx(docx('14')).content)).toEqual({ 'own break': 24, 'opens section': 24, 'after a break character': 0 });
  });
  it('goes in a LibreOffice file that stores the 2013 layout as TabOverSpacing', async () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
      { type: 'paragraph', attrs: { breakBefore: 'page', spaceBefore: 24 }, content: [{ type: 'text', text: 'own break' }] },
    ] };
    const files = unzipSync(await buildOdt(doc as any));
    expect(spaces(importOdt(zipSync(files)).content)).toEqual({ 'own break': 24 });
    const settings = strFromU8(files['settings.xml']).replace('</config:config-item-set>',
      '<config:config-item config:name="TabOverSpacing" config:type="boolean">true</config:config-item></config:config-item-set>');
    expect(spaces(importOdt(zipSync({ ...files, 'settings.xml': strToU8(settings) })).content)).toEqual({ 'own break': 0 });
  });
});
