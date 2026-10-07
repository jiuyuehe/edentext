import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';

// A list item opens with a paragraph; the wrap must not reach a heading through a text box.
describe('list toggle on a heading', () => {
  for (const cmd of ['toggleBulletList', 'toggleOrderedList'] as const) {
    it(cmd, () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const editor = new Editor({ element: el, extensions, content: { type: 'doc', content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      ] } });
      editor.commands.setTextSelection(2);
      editor.commands[cmd]();
      const list = editor.state.doc.firstChild!;
      expect(list.type.name).toBe(cmd === 'toggleBulletList' ? 'bulletList' : 'orderedList');
      expect(list.firstChild!.firstChild!.type.name).toBe('paragraph');
      expect(JSON.stringify(editor.getJSON())).not.toContain('textBox');
      expect(editor.state.doc.textContent).toBe('Title');
      editor.destroy();
    });
  }
});
