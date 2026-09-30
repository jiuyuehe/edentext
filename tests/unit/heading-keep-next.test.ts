// A heading keeps with the next block because Word's and LibreOffice's heading styles
// say so; a file that defines its heading style without it lets the heading end a page,
// and that survives both formats.
import { describe, it, expect } from 'vitest';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { buildOdt } from '../../src/lib/export/odt';
import { importOdt } from '../../src/lib/import/odt';
import { buildDocx } from '../../src/lib/export/docx';
import { importDocx } from '../../src/lib/import/docx';

type N = any;
const doc: N = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
] };
const keep = (d: N) => d.content[0].attrs.keepNext ?? null;
const patch = (file: Uint8Array, part: string, edit: (x: string) => string) => {
  const files = unzipSync(file);
  files[part] = strToU8(edit(strFromU8(files[part])));
  return zipSync(files);
};

describe('a heading and keep with next', () => {
  it('keeps it by default in both formats', async () => {
    expect(keep(importOdt(await buildOdt(doc)).content)).toBe(null);
    expect(keep(importDocx(await buildDocx(doc)).content)).toBe(null);
  });

  it('drops it where the DOCX heading style has none, and keeps that through both formats', async () => {
    const docx = patch(await buildDocx(doc), 'word/styles.xml', (x) => x.replace(/<w:keepNext\/>/g, ''));
    const read = importDocx(docx).content as N;
    expect(keep(read)).toBe(false);
    expect(keep(importDocx(await buildDocx(read)).content)).toBe(false);
    expect(keep(importOdt(await buildOdt(read)).content)).toBe(false);
  });

  it('drops it where the ODT heading style has none', async () => {
    const odt = patch(await buildOdt(doc), 'styles.xml', (x) => x.replace(/fo:keep-with-next="always"/g, ''));
    expect(keep(importOdt(odt).content)).toBe(false);
  });
});
