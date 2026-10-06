// A tab layout equal to the live decorations is not dispatched again, and with it the
// page recalc it asks for: a rounding step in an advance is the same layout.
import { describe, it, expect } from 'vitest';
import { Decoration } from '@tiptap/pm/view';
import { sameLayout } from '../../src/lib/editor/extensions/tabStops';

const tab = (pos: number, width: number, leader: string | null = null) =>
  Decoration.inline(pos, pos + 1, {}, { width, leader });
const wrap = (pos: number) => Decoration.widget(pos, () => document.createElement('br'), { key: 'tab-wrap' });

describe('sameLayout', () => {
  const live = [tab(10, 72.14), tab(40, 30, '.'), wrap(55)];
  it('ignores a sub-pixel change in an advance', () => {
    expect(sameLayout({ widths: [{ pos: 40, width: 30, leader: '.' }, { pos: 10, width: 72.15, leader: null }], breaks: [55] }, live)).toBe(true);
  });
  it('sees a moved tab, a wider advance, a new leader or a new wrap', () => {
    expect(sameLayout({ widths: [{ pos: 11, width: 72.14, leader: null }, { pos: 40, width: 30, leader: '.' }], breaks: [55] }, live)).toBe(false);
    expect(sameLayout({ widths: [{ pos: 10, width: 80, leader: null }, { pos: 40, width: 30, leader: '.' }], breaks: [55] }, live)).toBe(false);
    expect(sameLayout({ widths: [{ pos: 10, width: 72.14, leader: null }, { pos: 40, width: 30, leader: '-' }], breaks: [55] }, live)).toBe(false);
    expect(sameLayout({ widths: [{ pos: 10, width: 72.14, leader: null }, { pos: 40, width: 30, leader: '.' }], breaks: [55, 60] }, live)).toBe(false);
  });
});
