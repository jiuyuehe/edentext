import { describe, it, expect } from 'vitest';
import { stackRank } from '../../src/lib/editor/extensions/image';

// Ranks stay under stackZ's caps in a part with many frames: only frames anchored near
// each other are ordered against each other.
describe('stackRank', () => {
  const far = Array.from({ length: 40 }, (_, i) => `<p><a z="${i}"/></p><p/><p/><p/><p/>`).join('');
  const doc = new DOMParser().parseFromString(`<body>${far}<p><a id="mid" z="1001"/><a id="top" z="1002"/><a id="low" z="1000"/><t><p/><p/></t></p></body>`, 'application/xml');
  const rank = (id: string) => stackRank(doc.getElementById(id)!, null, 'z');
  it('orders the frames that can overlap', () => {
    expect([rank('low'), rank('mid'), rank('top')]).toEqual([0, 1, 2]);
  });
  it('restarts where none can', () => {
    expect(stackRank(doc.getElementsByTagName('a')[39], null, 'z')).toBe(0);
  });
});
