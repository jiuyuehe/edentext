// A header or footer is a text area like the body: paragraphs, a list, a table and a text
// box holding a page number come back from both formats as the blocks they went out as.
import { describe, it, expect } from 'vitest';
import { buildDocx } from '../../src/lib/export/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { importOdt } from '../../src/lib/import/odt';
import { importDocx } from '../../src/lib/import/docx';

type N = any;
const t = (text: string): N => ({ type: 'text', text });
const p = (...content: N[]): N => ({ type: 'paragraph', ...(content.length ? { content } : {}) });

const header: N = { type: 'doc', content: [
  p(t('Line one')),
  p(t('Line two')),
  { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('Point'))] }] },
  { type: 'table', content: [{ type: 'tableRow', content: [
    { type: 'tableCell', content: [p(t('A'))] }, { type: 'tableCell', content: [p(t('B'))] },
  ] }] },
  p(),
] };
const footer: N = { type: 'doc', content: [
  p({ type: 'textBox', attrs: { width: 80, height: 30 }, content: [p({ type: 'pageNumber' })] }, t('Report')),
] };
const body: N = { type: 'doc', content: [p(t('Body'))] };
const hf = { header, footer, pageCount: 1 };

// A block's type and text, down through lists, tables and boxes.
const shape = (n: N): N => n.type === 'text' ? n.text
  : [n.type, ...(n.content ?? []).map(shape)];
const zoneShape = (d: N) => (d?.content ?? []).map(shape);

describe('header/footer zones hold blocks', () => {
  it('round-trips through ODT', async () => {
    const back = importOdt(await buildOdt(body, undefined, 'portrait', hf));
    expect(zoneShape(back.header)).toEqual(zoneShape(header));
    expect(zoneShape(back.footer)).toEqual(zoneShape(footer));
  });

  it('round-trips through DOCX', async () => {
    const back = importDocx(await buildDocx(body, undefined, 'portrait', hf));
    expect(zoneShape(back.header)).toEqual(zoneShape(header));
    expect(zoneShape(back.footer)).toEqual(zoneShape(footer));
  });
});
