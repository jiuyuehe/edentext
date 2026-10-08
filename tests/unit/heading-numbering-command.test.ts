import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import ListItem from '@tiptap/extension-list-item';
import { OrderedList } from '../../src/lib/editor/extensions/orderedList';
import { decimalOutline, type OutlineNumbering } from '../../src/lib/styles/outlineNumbering';

// The numbering button on a heading numbers the chapters instead of wrapping the heading
// in a list item. Each editor is destroyed, or its DOM observer fires after jsdom is gone.
const editors: Editor[] = [];
afterEach(() => { while (editors.length) editors.pop()!.destroy(); });

function setup() {
  let outline: OutlineNumbering | null = null;
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Heading, ListItem,
      OrderedList.configure({ headingNumbering: { get: () => outline, set: (o) => { outline = o; } } })],
    content: '<h1>Chapter</h1><p>Body</p>',
  });
  editors.push(editor);
  return { editor, outline: () => outline };
}

describe('the numbering commands on a heading', () => {
  it('toggle the chapter numbering and keep the heading', () => {
    const { editor, outline } = setup();
    editor.commands.setTextSelection(2);
    editor.commands.toggleOrderedList();
    expect(outline()).toEqual(decimalOutline());
    expect(editor.getJSON().content?.[0].type).toBe('heading');
    editor.commands.toggleOrderedList();
    expect(outline()).toBeNull();
  });

  it('take a picked format for every level', () => {
    const { editor, outline } = setup();
    editor.commands.setTextSelection(2);
    editor.commands.setOrderedListType('upper-alpha');
    expect(outline()?.[1]).toMatchObject({ format: 'A', suffix: '. ', displayLevels: 1 });
  });

  it('still make a list of a paragraph', () => {
    const { editor, outline } = setup();
    editor.commands.setTextSelection(11);
    editor.commands.toggleOrderedList();
    expect(editor.getJSON().content?.[1].type).toBe('orderedList');
    expect(outline()).toBeNull();
  });
});
