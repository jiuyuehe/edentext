// Autolinking runs for typed text only; a typed URL followed by a space still links.
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';

describe('autolink', () => {
  it('links a typed URL once a space follows it', () => {
    const editor = new Editor({ element: document.createElement('div'), extensions, content: '<p></p>' });
    editor.commands.insertContent('see www.example.com');
    editor.commands.insertContent(' ');
    const link = editor.getJSON().content?.[0].content?.find((n) => n.marks?.some((m) => m.type === 'link'));
    expect(link?.text).toBe('www.example.com');
    editor.destroy();
  });
});
