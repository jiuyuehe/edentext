// The ribbon's command search: ranking, accent folding, the English fallback, and
// that every indexed id has a control to click.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import de from '../../src/lib/i18n/locales/de';
import { RIBBON_COMMANDS, searchCommands } from '../../src/lib/components/ribbon/commands';

const ids = (q: string, recent: string[] = []) => searchCommands(q, RIBBON_COMMANDS, de, recent).map((c) => c.id);

describe('command search', () => {
  it('ranks a label prefix first', () => {
    expect(ids('ta')[0]).toBe('table');
  });

  it('folds umlauts and matches inside a compound', () => {
    expect(ids('rander')).toContain('margins');
  });

  it('matches the English label under another UI language', () => {
    expect(ids('table')[0]).toBe('table');
  });

  it('lists recent commands for an empty query and prefers them on a tie', () => {
    expect(ids('', ['footnote', 'table'])).toEqual(['footnote', 'table']);
    expect(ids('s', ['superscript'])[0]).toBe('superscript');
  });

  it('indexes only ids a control carries', () => {
    const dir = 'src/lib/components/ribbon/';
    const src = [dir + 'Ribbon.svelte', ...readdirSync(dir + 'tabs').map((f) => `${dir}tabs/${f}`)]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    // A loop renders `<prefix>-<key>` from a template literal; the Review tab's show-kind
    // snippet takes its id as an argument.
    const has = (id: string) => src.includes(`cmd="${id}"`) || src.includes(`showKind('${id}'`)
      || (id.includes('-') && src.includes(`cmd={\`${id.split('-')[0]}-`));
    const missing = RIBBON_COMMANDS.filter((c) => !has(c.id) || (c.via && !has(c.via))).map((c) => c.id);
    expect(missing).toEqual([]);
    expect(new Set(RIBBON_COMMANDS.map((c) => c.id)).size).toBe(RIBBON_COMMANDS.length);
  });
});
