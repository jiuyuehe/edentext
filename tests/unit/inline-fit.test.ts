import { describe, it, expect } from 'vitest';
import { fitInlineImage } from '../../src/lib/editor/extensions/image';

describe('an as-character image against the column', () => {
  it('trims a sub-pixel overhang and keeps a wider picture at its size', () => {
    const near = { width: 642.6, height: 300 }, wide = { width: 680, height: 400 };
    fitInlineImage(near, 642);
    fitInlineImage(wide, 642);
    expect(near).toEqual({ width: 642, height: 300 });
    expect(wide).toEqual({ width: 680, height: 400 });
  });
});
