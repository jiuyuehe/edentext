// ODF's enhanced geometry and DrawingML's guides evaluated to a plain outline: the
// shape's formulas, modifiers and arc segments resolved once for its size, so the
// result is an ordinary path in the 0…100 box (`shapes.ts`) both exports already write.

import { arcBeziers, asTextArea, fitPath, joinOutlineParts, type OutlinePart, type PathCmd, type Shade } from './shapes';

export type EnhancedGeometry = {
  /** `draw:enhanced-path`, or LibreOffice's fuller `drawooo:enhanced-path`. */
  path: string;
  /** `draw:equation` formulas by name, referenced as `?name`. */
  equations: Record<string, string>;
  /** `draw:modifiers`, referenced as `$0`, `$1`, …. */
  modifiers: number[];
  /** `svg:viewBox`; all zero (LibreOffice's presets) means the shape's own size. */
  viewBox: number[];
  /** The shape's size in 1/100 mm: `logwidth` and `logheight`. */
  logW: number;
  logH: number;
  mirrorH?: boolean;
  mirrorV?: boolean;
  /** `drawooo:sub-view-size`: each `N`-ended subpath's own width and height. */
  subViews?: number[];
  /** `draw:text-areas`: the first rectangle's left, top, right and bottom. */
  textAreas?: string;
};

/** A resolved geometry: the outline and the text area, both in the 0…100 box. */
export type ResolvedGeometry = { path: string; textArea: [number, number, number, number] | null };

const FUNCS: Record<string, (...a: number[]) => number> = {
  abs: Math.abs, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  atan: Math.atan, atan2: Math.atan2, min: Math.min, max: Math.max,
  if: (c, a, b) => (c > 0 ? a : b),
};

/** One ODF formula: `+ - * /`, parentheses, functions, `?name`, `$N` and the constants. */
export function evalFormula(src: string, ref: (name: string) => number, mod: (i: number) => number,
  consts: Record<string, number>): number {
  const toks = src.match(/\?\w+|\$\d+|[a-z]\w*|\d*\.?\d+(?:e[-+]?\d+)?|[-+*/(),]/gi) ?? [];
  let i = 0;
  const fail = (): never => { throw new Error(`formula: ${src}`); };
  const expr = (): number => {
    let v = term();
    while (toks[i] === '+' || toks[i] === '-') v = toks[i++] === '+' ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (toks[i] === '*' || toks[i] === '/') v = toks[i++] === '*' ? v * unary() : v / unary();
    return v;
  };
  const unary = (): number => {
    if (toks[i] === '-') { i++; return -unary(); }
    if (toks[i] === '+') { i++; return unary(); }
    return primary();
  };
  const primary = (): number => {
    const t = toks[i++] ?? fail();
    if (t === '(') { const v = expr(); if (toks[i++] !== ')') fail(); return v; }
    if (t[0] === '?') return ref(t.slice(1));
    if (t[0] === '$') return mod(Number(t.slice(1)));
    if (/^[\d.]/.test(t)) return Number(t);
    if (t === 'pi') return Math.PI;
    if (t in consts) return consts[t];
    const fn = FUNCS[t] ?? fail();
    if (toks[i++] !== '(') fail();
    const args = [expr()];
    while (toks[i] === ',') { i++; args.push(expr()); }
    if (toks[i++] !== ')') fail();
    return fn(...args);
  };
  const v = expr();
  if (i !== toks.length || !Number.isFinite(v)) fail();
  return v;
}

/** Equations resolved on demand, each once; a cycle or a missing name throws. */
function equationResolver(eqs: Record<string, string>, mod: (i: number) => number, consts: Record<string, number>) {
  const memo = new Map<string, number>();
  const busy = new Set<string>();
  const ref = (name: string): number => {
    const hit = memo.get(name);
    if (hit !== undefined) return hit;
    if (busy.has(name) || !(name in eqs)) throw new Error(`equation: ${name}`);
    busy.add(name);
    const v = evalFormula(eqs[name], ref, mod, consts);
    busy.delete(name);
    memo.set(name, v);
    return v;
  };
  return ref;
}

const ARITY: Record<string, number> = {
  M: 2, L: 2, C: 6, Q: 4, T: 6, U: 6, A: 8, B: 8, W: 8, V: 8, X: 2, Y: 2, G: 4,
  Z: 0, N: 0, F: 0, S: 0, H: 0, I: 0, J: 0, K: 0,
};
const TAU = 2 * Math.PI;
const KAPPA = (4 / 3) * (Math.SQRT2 - 1);

// An angle difference brought into (0, 2π], so equal ends make a full turn.
function turn(d: number): number {
  const m = ((d % TAU) + TAU) % TAU;
  return m < 1e-9 ? TAU : m;
}

/** The outline an enhanced geometry draws, in the 0…100 box; '' when it cannot be resolved. */
export function enhancedGeometryPath(g: EnhancedGeometry): string {
  return resolveGeometry(g).path;
}

/**
 * An enhanced geometry's outline and text area for its size. Each `N`-ended part keeps
 * its `F`/`S` switches and its shading (`outlineParts`); a formula or reference that
 * cannot be resolved gives no outline at all.
 */
export function resolveGeometry(g: EnhancedGeometry): ResolvedGeometry {
  const none: ResolvedGeometry = { path: '', textArea: null };
  try {
    const own = !(g.viewBox[2] > 0 && g.viewBox[3] > 0);
    const [vx, vy, vw, vh] = own ? [0, 0, g.logW, g.logH] : g.viewBox;
    if (!(vw > 0 && vh > 0)) return none;
    const consts: Record<string, number> = {
      left: vx, top: vy, right: vx + vw, bottom: vy + vh, width: vw, height: vh,
      logwidth: g.logW, logheight: g.logH, xstretch: 0, ystretch: 0, hasstroke: 1, hasfill: 1,
    };
    const mod = (i: number) => g.modifiers[i] ?? 0;
    const ref = equationResolver(g.equations, mod, consts);
    const toks = g.path.match(/\?\w+|\$\d+|[a-z]\w*|[A-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
    const num = (t: string): number => t[0] === '?' ? ref(t.slice(1))
      : t[0] === '$' ? mod(Number(t.slice(1)))
      : /^[a-z]/.test(t) ? (t in consts ? consts[t] : NaN) : Number(t);

    const parts: { cmds: PathCmd[]; fill: boolean; stroke: boolean; shade?: Shade }[] = [];
    let out: PathCmd[] = [];
    let [fill, stroke] = [true, true];
    let shade: Shade | undefined;
    let [x, y, sx, sy] = [0, 0, 1, 1];
    let sub = 0;
    const subView = () => {
      const [w, h] = [g.subViews?.[sub * 2], g.subViews?.[sub * 2 + 1]];
      [sx, sy] = w && h ? [vw / w, vh / h] : [1, 1];
    };
    subView();
    const pt = (px: number, py: number): [number, number] => [vx + (px - vx) * sx, vy + (py - vy) * sy];
    const to = (c: 'M' | 'L', p: [number, number]) => { out.push({ c, p }); [x, y] = p; };
    const arc = (cx: number, cy: number, rx: number, ry: number, t0: number, dt: number, join?: 'M' | 'L') => {
      if (join) to(join, [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0)]);
      out.push(...arcBeziers(cx, cy, rx, ry, t0, dt));
      [x, y] = [cx + rx * Math.cos(t0 + dt), cy + ry * Math.sin(t0 + dt)];
    };

    let i = 0;
    while (i < toks.length) {
      const cmd = toks[i++];
      const n = ARITY[cmd];
      if (n === undefined) return none;
      if (cmd === 'Z') { out.push({ c: 'Z' }); continue; }
      if (cmd === 'N') {
        parts.push({ cmds: out, fill, stroke, shade });
        [out, fill, stroke, shade] = [[], true, true, undefined];
        sub++;
        subView();
        continue;
      }
      if (cmd === 'F') fill = false;
      if (cmd === 'S') stroke = false;
      if (cmd === 'H' || cmd === 'I' || cmd === 'J' || cmd === 'K') shade = cmd;
      if (!n) continue;
      for (let first = true, quad = cmd === 'X'; i < toks.length && !/^[A-Z]$/.test(toks[i]); first = false) {
        const a = toks.slice(i, i + n).map(num);
        if (a.length < n || a.some((v) => !Number.isFinite(v))) return none;
        i += n;
        if (cmd === 'M' || cmd === 'L') to(cmd === 'M' && first ? 'M' : 'L', pt(a[0], a[1]));
        else if (cmd === 'C' || cmd === 'Q') {
          const p = [pt(a[0], a[1]), pt(a[2], a[3]), ...(cmd === 'C' ? [pt(a[4], a[5])] : [])];
          const e = p[p.length - 1];
          const c = cmd === 'C' ? p.flat()
            : [x + (2 / 3) * (p[0][0] - x), y + (2 / 3) * (p[0][1] - y),
               e[0] + (2 / 3) * (p[0][0] - e[0]), e[1] + (2 / 3) * (p[0][1] - e[1]), ...e];
          out.push({ c: 'C', p: c });
          [x, y] = e;
        } else if (cmd === 'T' || cmd === 'U') {
          // Centre, radii and two angles in degrees, counter-clockwise.
          const [cx, cy] = pt(a[0], a[1]);
          const [t0, t1] = [(-a[4] * Math.PI) / 180, (-a[5] * Math.PI) / 180];
          arc(cx, cy, a[2] * sx, a[3] * sy, t0, -turn(t0 - t1), cmd === 'U' ? 'M' : 'L');
        } else if (cmd === 'A' || cmd === 'B' || cmd === 'W' || cmd === 'V') {
          // The ellipse's bounding box, then the directions its start and end lie in.
          const [p1, p2, p3, p4] = [pt(a[0], a[1]), pt(a[2], a[3]), pt(a[4], a[5]), pt(a[6], a[7])];
          const [cx, cy] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
          const [rx, ry] = [Math.abs(p2[0] - p1[0]) / 2, Math.abs(p2[1] - p1[1]) / 2];
          const at = (p: [number, number]) => Math.atan2(rx * (p[1] - cy), ry * (p[0] - cx));
          const [t0, t1] = [at(p3), at(p4)];
          const cw = cmd === 'W' || cmd === 'V';
          arc(cx, cy, rx, ry, t0, cw ? turn(t1 - t0) : -turn(t0 - t1), cmd === 'A' || cmd === 'W' ? 'L' : 'M');
        } else if (cmd === 'G') {
          // OOXML's arcTo: radii, then start and sweep as angles seen on the ellipse.
          const [rx, ry] = [a[0] * sx, a[1] * sy];
          const t0 = visualToParam(a[2], rx, ry);
          const dt = sweepParam(a[2], a[3], rx, ry);
          arc(x - rx * Math.cos(t0), y - ry * Math.sin(t0), rx, ry, t0, dt);
        } else {
          // A quarter ellipse leaving along x (`X`) or y (`Y`), the two alternating.
          const [ex, ey] = pt(a[0], a[1]);
          const c = quad
            ? [x + KAPPA * (ex - x), y, ex, ey + KAPPA * (y - ey)]
            : [x, y + KAPPA * (ey - y), ex + KAPPA * (x - ex), ey];
          out.push({ c: 'C', p: [...c, ex, ey] });
          [x, y] = [ex, ey];
          quad = !quad;
        }
      }
    }
    parts.push({ cmds: out, fill, stroke, shade });
    const mirror = (c: PathCmd): PathCmd => c.c === 'Z' ? c : {
      c: c.c, p: c.p.map((v, j) => j % 2 ? (g.mirrorV ? 2 * vy + vh - v : v) : (g.mirrorH ? 2 * vx + vw - v : v)),
    } as PathCmd;
    const fitted: OutlinePart[] = parts.filter((p) => p.cmds.length && (p.fill || p.stroke))
      .map((p) => ({ d: fitPath(p.cmds.map(mirror), vw, vh, vx, vy), fill: p.fill, stroke: p.stroke, ...(p.shade ? { shade: p.shade } : {}) }));
    if (!fitted.length) return none;
    return { path: joinOutlineParts(fitted), textArea: textArea(g.textAreas, num, [vx, vy, vw, vh], g) };
  } catch {
    return none;
  }
}

// The first text rectangle, mirrored with the shape and as 0…100 fractions of its box.
function textArea(spec: string | undefined, num: (t: string) => number, [vx, vy, vw, vh]: number[],
  g: EnhancedGeometry): ResolvedGeometry['textArea'] {
  const toks = spec?.trim().split(/\s+/) ?? [];
  if (toks.length < 4) return null;
  let [l, t, r, b] = toks.slice(0, 4).map(num);
  if (g.mirrorH) [l, r] = [2 * vx + vw - r, 2 * vx + vw - l];
  if (g.mirrorV) [t, b] = [2 * vy + vh - b, 2 * vy + vh - t];
  const area = [(l - vx) / vw, (t - vy) / vh, (r - vx) / vw, (b - vy) / vh].map((v) => Math.round(v * 100000) / 1000);
  return asTextArea(area);
}

// An angle in degrees as seen from the centre, as the ellipse parameter it lands on.
function visualToParam(deg: number, rx: number, ry: number): number {
  const a = (deg * Math.PI) / 180;
  return Math.atan2(rx * Math.sin(a), ry * Math.cos(a));
}

// A visual sweep in degrees as a parameter sweep, keeping its direction and full turns.
function sweepParam(st: number, sw: number, rx: number, ry: number): number {
  if (!sw) return 0;
  if (Math.abs(sw) >= 360) return Math.sign(sw) * TAU;
  const d = visualToParam(st + sw, rx, ry) - visualToParam(st, rx, ry);
  return sw > 0 ? turn(d) : -turn(-d);
}

// ---- DrawingML guides --------------------------------------------------------

const ANGLES: Record<string, number> = {
  cd2: 10800000, cd4: 5400000, cd8: 2700000, '3cd4': 16200000, '3cd8': 8100000,
  '5cd8': 13500000, '7cd8': 18900000,
};
const RAD = Math.PI / 10800000;

/**
 * DrawingML shape guides (`a:avLst` then `a:gdLst`, each `[name, fmla]`) resolved for a
 * `w`×`h` shape. Angles are 60000ths of a degree; an unknown name or operator throws.
 */
export function drawingMlGuides(guides: [string, string][], w: number, h: number): Map<string, number> {
  const ss = Math.min(w, h);
  const vals = new Map<string, number>([
    ['w', w], ['h', h], ['l', 0], ['t', 0], ['r', w], ['b', h], ['hc', w / 2], ['vc', h / 2],
    ['ss', ss], ['ls', Math.max(w, h)], ...Object.entries(ANGLES),
  ]);
  for (const [name, fmla] of guides) vals.set(name, drawingMlFormula(fmla, vals));
  return vals;
}

/** A guide argument: a literal, a guide already resolved or one of the `wd4`-style fractions. */
export function drawingMlValue(arg: string, vals: Map<string, number>): number {
  const v = vals.get(arg) ?? (/^-?\d+$/.test(arg) ? Number(arg) : undefined);
  if (v !== undefined) return v;
  const m = /^(w|h|ss)d(\d+)$/.exec(arg);
  if (m) return (vals.get(m[1]) ?? NaN) / Number(m[2]);
  throw new Error(`guide: ${arg}`);
}

function drawingMlFormula(fmla: string, vals: Map<string, number>): number {
  const [op, ...args] = fmla.trim().split(/\s+/);
  const [x, y, z] = args.map((a) => drawingMlValue(a, vals));
  const deg = (r: number) => r / RAD;
  switch (op) {
    case 'val': return x;
    case '*/': return (x * y) / z;
    case '+-': return x + y - z;
    case '+/': return (x + y) / z;
    case '?:': return x > 0 ? y : z;
    case 'abs': return Math.abs(x);
    case 'at2': return deg(Math.atan2(y, x));
    case 'cat2': return x * Math.cos(Math.atan2(z, y));
    case 'sat2': return x * Math.sin(Math.atan2(z, y));
    case 'cos': return x * Math.cos(y * RAD);
    case 'sin': return x * Math.sin(y * RAD);
    case 'tan': return x * Math.tan(y * RAD);
    case 'max': return Math.max(x, y);
    case 'min': return Math.min(x, y);
    case 'mod': return Math.sqrt(x * x + y * y + z * z);
    case 'pin': return y < x ? x : y > z ? z : y;
    case 'sqrt': return Math.sqrt(x);
    default: throw new Error(`guide operator: ${op}`);
  }
}

/** DrawingML's `arcTo` from the current point, as cubics: radii and angles in its units. */
export function drawingMlArc(x: number, y: number, wR: number, hR: number, stAng: number, swAng: number): PathCmd[] {
  const [st, sw] = [stAng / 60000, swAng / 60000];
  const t0 = visualToParam(st, wR, hR);
  return arcBeziers(x - wR * Math.cos(t0), y - hR * Math.sin(t0), wR, hR, t0, sweepParam(st, sw, wR, hR));
}
