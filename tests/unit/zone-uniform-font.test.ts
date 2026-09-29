import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importOdt } from '../../src/lib/import/odt';

// A footer paragraph whose style says 11pt but whose runs all say 10pt is a 10pt line,
// as it is in the body: its style's size must not stay on the block as a floor.
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';

const styles = `<?xml version="1.0"?><office:document-styles ${NS}><office:styles>
 <style:style style:name="Standard" style:family="paragraph"/>
 <style:style style:name="Footer" style:family="paragraph" style:parent-style-name="Standard">
  <style:text-properties fo:font-size="11pt"/></style:style>
</office:styles><office:automatic-styles>
 <style:style style:name="T1" style:family="text"><style:text-properties fo:font-size="10pt"/></style:style>
 <style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"/></style:page-layout>
</office:automatic-styles><office:master-styles>
 <style:master-page style:name="Standard" style:page-layout-name="pm1">
  <style:footer><text:p text:style-name="Footer"><text:span text:style-name="T1">Page one</text:span></text:p></style:footer>
 </style:master-page>
</office:master-styles></office:document-styles>`;
const content = `<?xml version="1.0"?><office:document-content ${NS}><office:body><office:text>
 <text:p text:style-name="Standard">Body</text:p></office:text></office:body></office:document-content>`;

describe('a footer line whose runs agree on a font', () => {
  it('takes their size', () => {
    const footer = importOdt(zipSync({ 'content.xml': strToU8(content), 'styles.xml': strToU8(styles) })).footer as any;
    expect(String(footer.content[0].attrs?.fontSize)).toMatch(/^10(pt)?$/);
  });
});
