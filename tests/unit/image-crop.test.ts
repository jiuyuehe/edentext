import { describe, it, expect } from 'vitest';
import { buildDocx } from '../../src/lib/export/docx';
import { importDocx } from '../../src/lib/import/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { importOdt } from '../../src/lib/import/odt';
import { imageSizeCm } from '../../src/lib/import/imageFormats';

// A PNG header only (676×422 px, pHYs 4330 px/m = 110dpi): the size is all a crop reads.
function png(w: number, h: number, ppm?: number): Uint8Array {
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type: string, data: number[]) => [...u32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...u32(w), ...u32(h), 8, 6, 0, 0, 0]),
    ...(ppm ? chunk('pHYs', [...u32(ppm), ...u32(ppm), 1]) : []),
    ...chunk('IEND', []),
  ]);
}
const dataUrl = (b: Uint8Array) => `data:image/png;base64,${btoa(String.fromCharCode(...b))}`;

const crop = { l: 0.1, t: 0.01932, r: 0.05, b: 0.2 };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'image', attrs: { src: dataUrl(png(676, 422, 4330)), width: 300, height: 200, crop } },
] }] } as never;

const imageOf = (json: { content?: unknown[] }): { attrs: Record<string, unknown> } =>
  JSON.parse(JSON.stringify(json)).content.flatMap((b: { content?: unknown[] }) => b.content ?? [])
    .find((n: { type: string }) => n.type === 'image');

describe('picture crop', () => {
  it('measures a bitmap at its own resolution, 96dpi without one', () => {
    expect(imageSizeCm(png(676, 422, 4330))!.h).toBeCloseTo(9.746, 3);
    expect(imageSizeCm(png(96, 48))).toEqual({ w: 2.54, h: 1.27 });
  });

  it('round-trips through DOCX as a:srcRect', async () => {
    const got = imageOf(importDocx(await buildDocx(doc)).content as never).attrs.crop as typeof crop;
    for (const k of ['l', 't', 'r', 'b'] as const) expect(got[k]).toBeCloseTo(crop[k], 5);
  });

  it('round-trips through ODT as fo:clip', async () => {
    const got = imageOf(importOdt(await buildOdt(doc)).content as never).attrs.crop as typeof crop;
    for (const k of ['l', 't', 'r', 'b'] as const) expect(got[k]).toBeCloseTo(crop[k], 3);
  });
});
