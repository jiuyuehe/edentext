import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { scopeEdentextVueCss } from './scripts/scope-edentext-vue-css.mjs';
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

function scopePackageCss(): Plugin {
  const fontDirectory = `${projectRoot}/src/assets/fonts`;
  const fontPathsByHash = new Map<string, string>();
  for (const fileName of readdirSync(fontDirectory)) {
    const filePath = `${fontDirectory}/${fileName}`;
    const bytes = readFileSync(filePath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    fontPathsByHash.set(digest, `./assets/fonts/${fileName}`);
  }

  return {
    name: 'scope-edentext-vue-css',
    enforce: 'post' as const,
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || output.fileName !== 'style.css' || output.source === undefined) continue;
        let css = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source);
        css = css.replace(/url\((['"]?)(data:font\/[^;]+;base64,([^'")]+))\1\)/g, (match, quote, dataUrl, base64) => {
          const digest = createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
          const fontPath = fontPathsByHash.get(digest);
          if (!fontPath) throw new Error('Unable to match an embedded EdenText font asset to its package file.');
          return `url(${quote}${fontPath}${quote})`;
        });
        output.source = scopeEdentextVueCss(css);
      }
    },
  };
}

export default defineConfig({
  plugins: [vue({ include: [/\.vue$/] }), svelte({ include: [/\.svelte$/] }), scopePackageCss(), copyPackageAssets()],
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
