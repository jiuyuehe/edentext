import { describe, expect, it } from 'vitest';
import { scopeEdentextVueCss } from '../../scripts/scope-edentext-vue-css.mjs';

describe('Vue package CSS scope', () => {
  it('moves document-wide selectors onto the editor host', () => {
    const css = scopeEdentextVueCss(`
      *, *::before { box-sizing: border-box; }
      :root { --color-bg: white; }
      html, body { height: 100%; }
      [data-theme="dark"] .paper { color: white; }
      [data-accent="blue"] { --brand-slate: blue; }
      .edentext-vue-host { min-height: 320px; }
    `);

    expect(css).toContain('.edentext-vue-host *,.edentext-vue-host *::before');
    expect(css).toContain('.edentext-vue-host { --color-bg: white; }');
    expect(css).toContain('.edentext-vue-host,.edentext-vue-host { height: 100%; }');
    expect(css).toContain('.edentext-vue-host[data-theme="dark"] .paper');
    expect(css).toContain('.edentext-vue-host[data-accent="blue"]');
    expect(css).toContain('.edentext-vue-host { min-height: 320px; }');
  });

  it('leaves keyframe steps and font-face rules global', () => {
    const css = scopeEdentextVueCss(`
      @font-face { font-family: EditorFont; src: url(font.woff2); }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    `);

    expect(css).toContain('@font-face');
    expect(css).toContain('@keyframes fade { from { opacity: 0; } to { opacity: 1; } }');
  });
});
