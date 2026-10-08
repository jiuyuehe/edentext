// The autosaved JSON leaves out attributes at their default and still loads as the
// same document.
import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import { extensions } from '../../src/lib/editor/extensions';
import { withoutDefaults } from '../../src/lib/storage/autosave';
import { kitchenSinkDoc } from '../kitchenSink';

const schema = getSchema(extensions);

describe('the autosaved document', () => {
  it('drops default attributes and loads back unchanged', () => {
    const doc = schema.nodeFromJSON(kitchenSinkDoc());
    const full = doc.toJSON();
    const slim = withoutDefaults(full, schema);
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(full).length / 2);
    expect(schema.nodeFromJSON(slim).eq(doc)).toBe(true);
  });
});
