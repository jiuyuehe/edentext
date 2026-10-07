import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { setOutline, styleSheet } from '../../src/lib/styles/sheet.svelte';

function headingEditor(): Editor {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const editor = new Editor({ element: el, extensions, content: { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
  ] } });
  editor.commands.setTextSelection(2);
  return editor;
}

// A list item opens with a paragraph; the wrap must not reach a heading through a text box.
describe('list toggle on a heading', () => {
  it('toggleBulletList', () => {
    const editor = headingEditor();
    editor.commands.toggleBulletList();
    const list = editor.state.doc.firstChild!;
    expect(list.type.name).toBe('bulletList');
    expect(list.firstChild!.firstChild!.type.name).toBe('paragraph');
    expect(JSON.stringify(editor.getJSON())).not.toContain('textBox');
    expect(editor.state.doc.textContent).toBe('Title');
    editor.destroy();
  });

  // Numbering a heading numbers the chapters and leaves the heading as it is.
  it('toggleOrderedList', () => {
    const editor = headingEditor();
    editor.commands.toggleOrderedList();
    expect(editor.state.doc.firstChild!.type.name).toBe('heading');
    expect(styleSheet().outline?.[0]?.format).toBe('1');
    setOutline(null);
    editor.destroy();
  });
});
