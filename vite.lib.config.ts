import { fileURLToPath } from 'node:url';
import { cp } from 'node:fs/promises';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import pkg from './package.json' with { type: 'json' };

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = fileURLToPath(new URL('./packages/edentext-vue/', import.meta.url));

function copyPackageAssets() {
  return {
    name: 'copy-edentext-package-assets',
    async closeBundle() {
      const assets = [
        ['src/assets/fonts', 'dist/assets/fonts'],
        ['public/dictionaries', 'dist/assets/dictionaries'],
        ['public/thesaurus', 'dist/assets/thesaurus'],
        ['public/font-licenses', 'dist/assets/font-licenses'],
        ['public/EdenText.png', 'dist/assets/EdenText.png'],
        ['public/favicon.svg', 'dist/assets/favicon.svg'],
      ] as const;
      for (const [source, target] of assets) {
        await cp(`${projectRoot}/${source}`, `${packageRoot}/${target}`, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [vue({ include: [/\.vue$/] }), svelte({ include: [/\.svelte$/] }), copyPackageAssets()],
  publicDir: false,
  build: {
    outDir: 'packages/edentext-vue/dist',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/lib/vue/index.ts', import.meta.url)),
      name: 'EdentextVue',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue'],
      output: { assetFileNames: (asset) => asset.name === 'style.css' ? 'style.css' : 'assets/[name]-[hash][extname]' },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      'hunspell-asm': 'hunspell-asm/dist/cjs/index.js',
      'emscripten-wasm-loader': 'emscripten-wasm-loader/dist/cjs/index.js',
    },
  },
});
