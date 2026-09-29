import { cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageAssets = resolve(demoRoot, '../../packages/edentext-vue/dist/assets');
const publicAssets = resolve(demoRoot, 'public/assets');

for (const directory of ['dictionaries', 'thesaurus']) {
  await cp(resolve(packageAssets, directory), resolve(publicAssets, directory), { recursive: true, force: true });
}
