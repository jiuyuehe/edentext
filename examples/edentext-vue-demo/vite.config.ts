import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const demoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      allow: [resolve(demoRoot, '../..')],
    },
  },
});
