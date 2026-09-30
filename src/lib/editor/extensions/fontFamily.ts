import { FontFamily as FontFamilyBase } from '@tiptap/extension-text-style';
import { fontPairDeclarations, singleLineHeight } from '../../styles/styleSheet';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamilyAsian: {
      setFontFamilyAsian: (fontFamily: string) => ReturnType;
      unsetFontFamilyAsian: () => ReturnType;
    };
  }
}

// Typing over a mixed selection makes the contenteditable insert a span carrying the
// computed style — a whole CSS stack, which is no font name the picker or either file
// can use. The first family is what renders, so that is the name the mark keeps — past
// the half-width space a balanced document puts in front (storage/balanceSpaces.ts).
export function firstFontFamily(value: string | null | undefined): string | null {
  const first = String(value ?? '').split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .find((f) => f !== 'EdenText Space');
  return first && !first.startsWith('var(') ? first : null;
}

// The raw style attribute first, as upstream does: element.style canonicalizes a
// single-quoted multi-word name into double quotes.
const declared = (el: HTMLElement, prop: string): string | null =>
  el.getAttribute('style')?.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;]*)`, 'i'))?.[1] ?? null;

// A span the editor rendered names its fonts in the pair variables; a foreign one in
// font-family, which is then the western font.
const westOf = (el: HTMLElement): string | null =>
  /--font-(west|asian)\s*:/.test(el.getAttribute('style') ?? '')
    ? firstFontFamily(declared(el, '--font-west'))
    : firstFontFamily(declared(el, 'font-family') ?? el.style.fontFamily);

const css = (decls: string[]) => (decls.length ? { style: decls.join('; ') } : {});

export const FontFamily = FontFamilyBase.extend({
  addGlobalAttributes() {
    return (this.parent?.() ?? []).map((group) => ({
      ...group,
      attributes: {
        ...group.attributes,
        fontFamily: {
          ...(group.attributes as Record<string, object>).fontFamily,
          parseHTML: westOf,
          // Both halves in one declaration: a style attribute keeps one font-family. A face
          // off the default carries its natural line: a taller one raises its line (editor.css).
          renderHTML: (attrs: Record<string, unknown>) => {
            if (!attrs.fontFamily) return {};
            const family = attrs.fontFamily as string, lh = singleLineHeight(family);
            return css([...fontPairDeclarations(family, attrs.fontFamilyAsian as string | null), ...(lh !== 1.15 ? [`--natural-line: ${lh}`] : [])]);
          },
        },
        fontFamilyAsian: {
          default: null,
          parseHTML: (el: HTMLElement) => firstFontFamily(declared(el, '--font-asian')),
          renderHTML: (attrs: Record<string, unknown>) =>
            css(attrs.fontFamily ? [] : fontPairDeclarations(null, attrs.fontFamilyAsian as string | null)),
        },
      },
    }));
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setFontFamilyAsian: (fontFamily: string) => ({ chain }) =>
        chain().setMark('textStyle', { fontFamilyAsian: fontFamily }).run(),
      unsetFontFamilyAsian: () => ({ chain }) =>
        chain().setMark('textStyle', { fontFamilyAsian: null }).removeEmptyTextStyle().run(),
    };
  },
});
