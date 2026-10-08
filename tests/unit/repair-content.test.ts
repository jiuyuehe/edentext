import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { repairContent } from '../../src/lib/import/repairContent';

const schema = getSchema(extensions);
const text = (t: string) => ({ type: 'text', text: t });

describe('repairContent', () => {
  it('returns valid content untouched', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [text('a')] }] };
    const r = repairContent(doc, schema);
    expect(r).toEqual({ content: doc, error: null });
  });

  it('gives a list item that starts with a sub-list its paragraph', () => {
    const doc = { type: 'doc', content: [{ type: 'orderedList', content: [{ type: 'listItem', content: [
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('chapter')] }] }] },
    ] }] }] };
    const r = repairContent(doc, schema);
    expect(r.error).toBeTruthy();
    expect(() => schema.nodeFromJSON(r.content).check()).not.toThrow();
    expect(schema.nodeFromJSON(r.content).textContent).toBe('chapter');
  });

  it('wraps loose text in a paragraph', () => {
    const r = repairContent({ type: 'doc', content: [text('loose')] }, schema);
    expect(r.content.content?.[0].type).toBe('paragraph');
    expect(() => schema.nodeFromJSON(r.content).check()).not.toThrow();
    expect(schema.nodeFromJSON(r.content).textContent).toBe('loose');
  });
});
