import { readdirSync, readFileSync, readlinkSync, lstatSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maxContextLines = 100;
const maxArchitectureLines = 200;

function localClaudeFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...localClaudeFiles(path));
    else if (entry.name === 'CLAUDE.md') files.push(path);
  }
  return files;
}

function lineCount(path: string) {
  return readFileSync(path, 'utf8').trimEnd().split('\n').length;
}

function architectureDocs() {
  const dir = join(root, 'docs', 'architecture');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name));
}

describe('repository instructions', () => {
  it('keeps AGENTS.md as the root CLAUDE.md alias', () => {
    const agents = join(root, 'AGENTS.md');
    if (lstatSync(agents).isSymbolicLink()) {
      expect(readlinkSync(agents)).toBe('CLAUDE.md');
    } else {
      // Git checks a symlink out as its target text when core.symlinks is disabled.
      expect(readFileSync(agents, 'utf8')).toBe('CLAUDE.md');
    }
  });

  it('keeps automatically loaded context concise', () => {
    const files = [join(root, 'CLAUDE.md'), ...localClaudeFiles(join(root, 'src'))];
    for (const file of files) {
      expect(lineCount(file), file).toBeLessThanOrEqual(maxContextLines);
    }
  });

  it('keeps architecture documentation focused', () => {
    for (const file of architectureDocs()) {
      expect(lineCount(file), file).toBeLessThanOrEqual(maxArchitectureLines);
    }
  });

  it('links every detailed instruction from the root guide', () => {
    const guide = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    const detailSection = guide.slice(guide.indexOf('## Where the detail lives'));
    const references = [...detailSection.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    for (const reference of references) {
      expect(existsSync(join(root, reference)), reference).toBe(true);
    }
  });
});
