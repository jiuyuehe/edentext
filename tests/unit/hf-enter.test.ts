// A header or footer holds blocks like the body: Enter splits the paragraph, and
// the zone schema admits lists and tables but not the page flow's own nodes.
import { describe, it, expect } from 'vitest';
import { Editor, getSchema } from '@tiptap/core';
import { zoneExtensions, extensions } from '../../src/lib/editor/extensions';

type N = any;

function makeEditor(content: N) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new Editor({ element: el, extensions: zoneExtensions(), content });
}
const pressEnter = (editor: Editor) =>
  editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

describe('header/footer zone schema', () => {
  it('Enter splits the paragraph', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Seite 1' }] }] });
    editor.commands.focus('end');
    pressEnter(editor);
    const json = editor.getJSON();
    expect(json.content!.length).toBe(2);
    expect(JSON.stringify(json)).not.toContain('hardBreak');
    editor.destroy();
  });

  it('keeps the body blocks and drops the page flow', () => {
    const zone = getSchema(zoneExtensions());
    const body = getSchema(extensions);
    for (const n of ['table', 'bulletList', 'heading', 'textBox', 'image', 'pageNumber', 'chapterField']) expect(zone.nodes[n], n).toBeTruthy();
    for (const n of ['noteSection', 'pageBreak', 'columns', 'tableOfContents']) expect(zone.nodes[n], n).toBeUndefined();
    expect(zone.marks.comment).toBeUndefined();
    expect(Object.keys(body.nodes).filter((n) => !zone.nodes[n]).sort())
      .toEqual(['columns', 'note', 'noteRef', 'noteSection', 'tableOfContents']);
  });
});
