import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import ListItem from '@tiptap/extension-list-item';
import { OrderedList } from '../../src/lib/editor/extensions/orderedList';
import { ListMarker, listMarkerDecos } from '../../src/lib/editor/extensions/listMarker';

// A level's own label size raises the item's first line (the marker joins the line), so
// only such an item is marked for it; a coloured one keeps the floated label.
const schema = getSchema([Document, Paragraph, Text, ListItem, OrderedList, ListMarker]);
const list = (markerFormat: unknown) => schema.nodes.doc.create(null, schema.nodes.orderedList.create({ markerFormat },
  schema.nodes.listItem.create(null, schema.nodes.paragraph.create(null, schema.text('one')))));
const classOf = (d: any): string => {
  const deco = listMarkerDecos(d).find(1, 2)[0] as unknown as { type: { attrs: Record<string, string> } };
  return deco?.type?.attrs?.class ?? '';
};

describe('a list level sized apart from its text', () => {
  it('puts its label in the line', () => expect(classOf(list({ fontSize: '12pt' }))).toBe('marker-sized'));
  it('leaves a merely coloured one floated', () => expect(classOf(list({ color: '#006465' }))).toBe(''));
});
