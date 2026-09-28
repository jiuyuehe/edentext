import { copyFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = resolve(root, 'packages/edentext-vue');
const files = ['LICENSE', 'THIRD-PARTY-NOTICES.md'];

if (process.argv.includes('--clean')) {
  await Promise.all(files.map((name) => rm(resolve(packageDir, name), { force: true })));
} else {
  await Promise.all(files.map((name) => copyFile(resolve(root, name), resolve(packageDir, name))));
}
