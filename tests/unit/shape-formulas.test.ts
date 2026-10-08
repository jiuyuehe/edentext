// A shape whose outline is formulas and arcs: ODF's enhanced geometry, a DrawingML
// preset from the table and a custGeom with guides all resolve to a plain outline.
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, strFromU8, unzipSync } from 'fflate';
import { evalFormula, enhancedGeometryPath, drawingMlGuides } from '../../src/lib/utils/enhancedGeometry';
import { arcBeziers, parseSvgPath, shadeColor } from '../../src/lib/utils/shapes';
import { presetGeometry } from '../../src/lib/utils/shapePresets';
import { importOdt } from '../../src/lib/import/odt';
import { importDocx } from '../../src/lib/import/docx';
import { buildOdt } from '../../src/lib/export/odt';
import { buildDocx } from '../../src/lib/export/docx';

type N = any;

const shape = (r: N): N => {
  const find = (n: N): N => n?.type === 'textBox' ? n : (n?.content ?? []).map(find).find(Boolean);
  return find(r.content);
};
const geometry = (path: string, more: object = {}) => enhancedGeometryPath({
  path, equations: {}, modifiers: [], viewBox: [0, 0, 100, 100], logW: 1000, logH: 1000, ...more,
});

describe('the ODF formula language', () => {
  it('evaluates precedence, functions and references', () => {
    const ref = (n: string) => ({ f0: 4 } as Record<string, number>)[n];
    expect(evalFormula('2+3*?f0 -logwidth/2', ref, () => 0, { logwidth: 10 })).toBe(9);
    expect(evalFormula('if(-1,5,if(1,$0 ,7))', ref, () => 3, {})).toBe(3);
    expect(evalFormula('atan2(1,1)*4/pi', ref, () => 0, {})).toBeCloseTo(1);
  });

  it('gives up on a cycle or an unknown name rather than draw wrong', () => {
    expect(geometry('M 0 0 L ?f0 100', { equations: { f0: '?f1', f1: '?f0' } })).toBe('');
    expect(geometry('M 0 0 L ?f0 100')).toBe('');
  });

  it('applies modifiers and the mirror flags', () => {
    expect(geometry('M 0 0 L $0 100 Z', { modifiers: [25], mirrorH: true })).toBe('M 100 0 L 75 100 Z');
  });

  it('draws a full angle ellipse as four quarter curves', () => {
    const d = geometry('U 10800 10800 10800 10800 0 360 Z N', { viewBox: [0, 0, 21600, 21600] });
    expect(d.startsWith('M 100 50 C')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
    expect(d).toContain(' 50 0 C');
  });
});

describe('an arc as curves', () => {
  it('uses the quarter-circle control points', () => {
    const k = (4 / 3) * (Math.SQRT2 - 1);
    const [c] = arcBeziers(0, 0, 1, 1, 0, Math.PI / 2) as { p: number[] }[];
    [1, k, k, 1, 0, 1].forEach((v, i) => expect(c.p[i]).toBeCloseTo(v));
  });

  it("follows an SVG arc's flags", () => {
    const cmds = parseSvgPath('M 0 50 A 50 50 0 0 1 100 50') as { c: string; p: number[] }[];
    expect(cmds.map((c) => c.c)).toEqual(['M', 'C', 'C']);
    expect(cmds[1].p.slice(4).map(Math.round)).toEqual([50, 0]);
    expect(cmds[2].p.slice(4).map(Math.round)).toEqual([100, 50]);
  });
});

const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
  + ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
  + ' xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"'
  + ' xmlns:drawooo="http://openoffice.org/2010/draw"'
  + ' xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';

const odt = (body: string) => zipSync({
  'mimetype': strToU8('application/vnd.oasis.opendocument.text'),
  'content.xml': strToU8(`<?xml version="1.0"?><office:document-content ${NS}><office:body><office:text>`
    + `${body}</office:text></office:body></office:document-content>`),
});

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const wsp = (spPr: string, flip = '') => zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="${W}"`
    + ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
    + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
    + ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>'
    + '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="1440000" cy="1080000"/><a:graphic><a:graphicData>'
    + `<wps:wsp><wps:spPr><a:xfrm${flip}><a:off x="0" y="0"/><a:ext cx="1440000" cy="1080000"/></a:xfrm>${spPr}</wps:spPr>`
    + '<wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:body></w:document>'),
});

describe('a shape built from formulas', () => {
  it("opens from LibreOffice's fuller path, its arcs included", () => {
    const r = importOdt(odt('<text:p><draw:custom-shape text:anchor-type="paragraph" svg:width="4cm" svg:height="2cm">'
      + '<draw:enhanced-geometry svg:viewBox="0 0 0 0" draw:type="ooxml-ellipseLike"'
      + ' draw:enhanced-path="M 0 ?f0 Z N" drawooo:enhanced-path="M 0 ?f0 G ?f1 ?f0 180 360 Z N">'
      + '<draw:equation draw:name="f0" draw:formula="logheight/2"/>'
      + '<draw:equation draw:name="f1" draw:formula="logwidth/2"/>'
      + '</draw:enhanced-geometry></draw:custom-shape></text:p>'));
    const d: string = shape(r).attrs.shapePath;
    expect(d.startsWith('M 0 50 C')).toBe(true);
    expect(d).toContain(' 50 0 C');
    expect(r.warnings).toEqual([]);
  });

  it('opens a DrawingML preset from the table, with its adjust values', () => {
    const smiley = importDocx(wsp('<a:prstGeom prst="smileyFace"><a:avLst/></a:prstGeom>'));
    // The face, both eyes and the mouth.
    expect(shape(smiley).attrs.shapePath.match(/M/g).length).toBeGreaterThanOrEqual(4);
    expect([...smiley.warnings]).toEqual([]);
    const thin = shape(importDocx(wsp('<a:prstGeom prst="moon"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom>')));
    const thick = shape(importDocx(wsp('<a:prstGeom prst="moon"><a:avLst/></a:prstGeom>')));
    expect(thin.attrs.shapePath).not.toBe(thick.attrs.shapePath);
  });

  it('reads a custGeom with guides and an arcTo', () => {
    const r = importDocx(wsp('<a:custGeom><a:avLst/><a:gdLst><a:gd name="half" fmla="*/ h 1 2"/></a:gdLst>'
      + '<a:pathLst><a:path><a:moveTo><a:pt x="l" y="half"/></a:moveTo>'
      + '<a:arcTo wR="hc" hR="half" stAng="cd2" swAng="cd2"/><a:close/></a:path></a:pathLst></a:custGeom>'));
    const d: string = shape(r).attrs.shapePath;
    expect(d.startsWith('M 0 50 C')).toBe(true);
    expect(d).toContain(' 50 0 C');
    expect(d.endsWith('100 50 Z')).toBe(true);
    expect(drawingMlGuides([['a', 'pin 0 150 100'], ['b', 'at2 1 1']], 10, 10).get('a')).toBe(100);
  });

  it('keeps a part drawn only filled or only stroked apart, arrow heads on the lines', () => {
    const arc = shape(importDocx(wsp('<a:prstGeom prst="arc"><a:avLst/></a:prstGeom>'
      + '<a:ln><a:tailEnd type="triangle"/></a:ln>')));
    expect(arc.attrs.shapePath).toMatch(/Z S N .* F N$/);
    expect(arc.attrs.arrowHeads).toBe('end');
  });

  it('keeps the outline and its parts through both formats', async () => {
    const box = shape(importDocx(wsp('<a:prstGeom prst="smileyFace"><a:avLst/></a:prstGeom>')));
    const { viaOdt, viaDocx, odt, docx } = await roundTrip({ ...box, attrs: { ...box.attrs, shapePreset: null } });
    expect(odt).toMatch(/draw:enhanced-path="M [^"]* Z S N [^"]* F N"/);
    expect(docx).toContain(' fill="none">');
    expect(near(viaOdt.attrs.shapePath)).toEqual(near(box.attrs.shapePath));
    expect(near(viaDocx.attrs.shapePath)).toEqual(near(box.attrs.shapePath));
    expect(viaDocx.attrs.shapePath.match(/[FS] N/g)).toEqual(box.attrs.shapePath.match(/[FS] N/g));
  });

  it('shades a face darker or lighter, in both formats', async () => {
    const cube = shape(importDocx(wsp('<a:prstGeom prst="cube"><a:avLst/></a:prstGeom>')));
    expect(cube.attrs.shapePath).toMatch(/Z I S N .* Z K S N/);
    expect(shadeColor('#ffd320', 'I')).toBe('#cca819');
    expect(shadeColor('#ffd320', 'K')).toBe('#ffdb4c');
    const { viaOdt, viaDocx, odt, docx } = await roundTrip({ ...cube, attrs: { ...cube.attrs, shapePreset: null } });
    expect(docx).toContain(' fill="darkenLess"');
    expect(odt).toMatch(/drawooo:enhanced-path="[^"]* I S N/);
    expect(odt).not.toMatch(/ draw:enhanced-path="[^"]*[HIJK] /);
    expect(odt).toContain('xmlns:drawooo=');
    for (const b of [viaOdt, viaDocx]) expect(b.attrs.shapePath.match(/[HIJK]/g)).toEqual(['I', 'K']);
  });

  it('keeps the text area a shape declares', async () => {
    const area = presetGeometry({ name: 'cube', adj: {} }, 1440000, 1080000).textArea!;
    expect(area[0]).toBe(0);
    expect(area[1]).toBeGreaterThan(0);
    expect(area[2]).toBeLessThan(100);
    const free = shape(importDocx(wsp('<a:custGeom><a:avLst/><a:rect l="wd4" t="t" r="r" b="vc"/><a:pathLst>'
      + '<a:path w="2" h="2"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="2" y="2"/></a:lnTo>'
      + '<a:lnTo><a:pt x="0" y="2"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>')));
    expect(free.attrs.shapeTextArea).toEqual([25, 0, 100, 50]);
    const { viaOdt, viaDocx } = await roundTrip(free);
    expect(viaOdt.attrs.shapeTextArea).toEqual([25, 0, 100, 50]);
    expect(viaDocx.attrs.shapeTextArea).toEqual([25, 0, 100, 50]);
  });

  it('keeps a preset a preset, its adjust values and flips with it', async () => {
    const moon = shape(importDocx(wsp('<a:prstGeom prst="moon"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom>', ' flipH="1"')));
    const preset = { name: 'moon', adj: { adj: 10000 }, flipH: true };
    expect(moon.attrs.shapePreset).toEqual(preset);
    const { viaOdt, viaDocx, odt, docx } = await roundTrip(moon);
    expect(docx).toContain('<a:prstGeom prst="moon"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom>');
    expect(docx).toContain('flipH="1"');
    expect(odt).toContain('draw:type="ooxml-moon"');
    expect(odt).toContain('draw:modifiers="10000"');
    expect(viaOdt.attrs.shapePreset).toEqual(preset);
    expect(viaDocx.attrs.shapePreset).toEqual(preset);
    expect(near(viaOdt.attrs.shapePath)).toEqual(near(moon.attrs.shapePath));
    // Redrawn for its size: a cube's depth is a share of its shorter side.
    const cube = (w: number, h: number) => presetGeometry({ name: 'cube', adj: {} }, w, h).path;
    expect(cube(2000000, 1000000)).not.toBe(cube(1000000, 2000000));
  });
});

const near = (d: string) => (d.match(/-?[\d.]+/g) ?? []).map((v) => Math.round(Number(v)));

async function roundTrip(box: N) {
  const doc: N = { type: 'doc', content: [{ type: 'paragraph', content: [box] }] };
  const margins = { top: 2, bottom: 2, left: 2, right: 2 };
  const odtBytes = await buildOdt(doc, margins, 'portrait');
  const docxBytes = await buildDocx(doc, margins, 'portrait');
  return {
    odt: strFromU8(unzipSync(odtBytes)['content.xml']),
    docx: strFromU8(unzipSync(docxBytes)['word/document.xml']),
    viaOdt: shape(importOdt(odtBytes)),
    viaDocx: shape(importDocx(docxBytes)),
  };
}
