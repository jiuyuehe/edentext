import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importDocx } from '../../src/lib/import/docx';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { DEFAULT_MARGINS } from '../../src/lib/storage/pageMargins';

// A list whose label sits a first-line indent right of the text and is followed by a
// space (w:suff), with the geometry on the item's own w:ind — as WPS writes it.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const rel = (type: string, target: string, id: string) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const docxOf = (item: string, lvl: string) => zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  'word/_rels/document.xml.rels': strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('numbering', 'numbering.xml', 'rId1')}</Relationships>`),
  'word/numbering.xml': strToU8(`<?xml version="1.0"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/>${lvl}<w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`),
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>${item}</w:pPr><w:r><w:t>one</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>${item}</w:pPr><w:r><w:t>two</w:t></w:r></w:p>
  </w:body></w:document>`),
});

const label = (doc: any) => {
  const { hanging = null, markerSuffix = null } = doc.content[0].attrs ?? {};
  return { hanging, markerSuffix };
};
const roundTrips = async (doc: any) => [
  label(importDocx(await buildDocx(doc, DEFAULT_MARGINS)).content),
  label(importOdt(await buildOdt(doc, DEFAULT_MARGINS)).content),
];

describe('a list label set a first-line indent right, followed by a space', () => {
  const doc = importDocx(docxOf('<w:ind w:left="880" w:firstLine="480"/>', '<w:suff w:val="space"/>')).content;
  const want = { hanging: -0.85, markerSuffix: 'space' };
  it('imports as a negative hang and a space suffix', () => {
    expect(label(doc)).toEqual(want);
  });
  it('survives DOCX and ODT round trips', async () => {
    expect(await roundTrips(doc)).toEqual([want, want]);
  });
  it('counts a character indent in the paragraph style size', () => {
    const chars = importDocx(docxOf('<w:ind w:left="880" w:leftChars="400" w:firstLine="480" w:firstLineChars="200"/>', '')).content;
    // No style size: 12pt, so 2 characters are 0.85cm.
    expect(label(chars).hanging).toBe(-0.85);
  });
});

describe('a list with the usual hanging label', () => {
  it('carries no label attrs through either round trip', async () => {
    const doc = importDocx(docxOf('', '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>')).content;
    const none = { hanging: null, markerSuffix: null };
    expect(label(doc)).toEqual(none);
    expect(await roundTrips(doc)).toEqual([none, none]);
  });
});
