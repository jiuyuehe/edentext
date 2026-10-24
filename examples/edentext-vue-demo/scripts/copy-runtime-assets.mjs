import { cp, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageAssets = resolve(demoRoot, '../../packages/edentext-vue/dist/assets');
const publicAssets = resolve(demoRoot, 'public/assets');

for (const directory of ['dictionaries', 'thesaurus', 'fonts', 'grammar']) {
  const destination = resolve(publicAssets, directory);
  if (!destination.startsWith(`${publicAssets}${sep}`)) throw new Error(`Unexpected runtime asset destination: ${destination}`);
  await rm(destination, { recursive: true, force: true });
  await cp(resolve(packageAssets, directory), destination, { recursive: true, force: true });
}
