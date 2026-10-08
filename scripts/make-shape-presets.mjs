// Regenerates src/lib/utils/shapePresets.json from LibreOffice's dump of the DrawingML
// preset shapes (filter/oox-drawingml-cs-presets, MPL-2.0): per preset its adjust
// defaults, equations, path and text area, in the ODF enhanced-geometry language. Argument: the dump.
import { readFile, writeFile } from 'node:fs/promises';

const SRC = process.argv[2]
  ?? '/Applications/LibreOffice.app/Contents/Resources/filter/oox-drawingml-cs-presets';
const OUT = 'src/lib/utils/shapePresets.json';

// EnhancedCustomShapeSegmentCommand → path letter, and the coordinate pairs one takes.
const SEGMENTS = {
  1: ['M', 1], 2: ['L', 1], 3: ['C', 3], 4: ['Z', 0], 5: ['N', 0], 6: ['F', 0], 7: ['S', 0],
  8: ['T', 3], 9: ['U', 3], 10: ['A', 4], 11: ['B', 4], 12: ['W', 4], 13: ['V', 4],
  14: ['X', 1], 15: ['Y', 1], 16: ['Q', 2], 17: ['G', 2],
  18: ['H', 0], 19: ['I', 0], 20: ['J', 0], 21: ['K', 0],
};

const between = (s, from, to) => {
  const i = s.indexOf(from);
  if (i < 0) return '';
  const j = to ? s.indexOf(to, i) : -1;
  return s.slice(i, j < 0 ? undefined : j);
};

const presets = {};
for (const block of (await readFile(SRC, 'utf8')).split(/^\/\* (?=\w+ \*\/$)/m).slice(1)) {
  const name = block.slice(0, block.indexOf(' '));
  const prop = (key) => block.match(new RegExp(`^${key}\\n(.*)$`, 'm'))?.[1] ?? '';
  const adj = [...prop('AdjustmentValues').matchAll(/\(long\) (-?\d+) \}, State = [^,]*, Name = "(\w+)"/g)]
    .map((m) => [m[2], Number(m[1])]);
  const eq = [...prop('Equations').matchAll(/"([^"]*)"/g)].map((m) => m[1].replace(/\?(\d+)/g, '?f$1').trim());
  const path = prop('Path');
  const params = (s) => [...s.matchAll(/\(long\) (-?\d+) \}, Type = \(short\) (\d)/g)]
    .map((m) => (m[2] === '1' ? `?f${m[1]}` : m[2] === '2' ? `$${m[1]}` : m[1]));
  const coords = params(between(path, 'Name = "Coordinates"', 'Name = "Segments"'));
  const text = params(between(path, 'Name = "TextFrames"', 'State =')).slice(0, 4).join(' ');
  const parts = [];
  let at = 0;
  for (const m of between(path, 'Name = "Segments"', 'State =').matchAll(/Command = \(short\) (\d+), Count = \(short\) (\d+)/g)) {
    const [letter, pairs] = SEGMENTS[m[1]];
    const n = pairs * 2 * Math.max(1, Number(m[2]));
    parts.push(pairs ? `${letter} ${coords.slice(at, at + n).join(' ')}` : letter);
    if (pairs) at += n;
  }
  const sub = [...between(path, 'Name = "SubViewSize"', 'State =')
    .matchAll(/Width = \(long\) (\d+), Height = \(long\) (\d+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
  presets[name] = { ...(adj.length ? { adj } : {}), eq, path: parts.join(' '), ...(sub.length ? { sub } : {}),
    ...(text ? { text } : {}) };
}

await writeFile(OUT, `${JSON.stringify(presets)}\n`);
console.log(`${Object.keys(presets).length} presets → ${OUT}`);
