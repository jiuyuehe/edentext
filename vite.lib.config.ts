import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, relative, sep } from 'node:path';
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
        ['public/dictionaries/en', 'dist/assets/dictionaries/en'],
        ['public/dictionaries/en-GB', 'dist/assets/dictionaries/en-GB'],
        ['public/thesaurus/en', 'dist/assets/thesaurus/en'],
        ['public/font-licenses', 'dist/assets/font-licenses'],
        ['public/EdenText.png', 'dist/assets/EdenText.png'],
        ['public/favicon.svg', 'dist/assets/favicon.svg'],
      ] as const;
      for (const [source, target] of assets) {
        await cp(`${projectRoot}/${source}`, `${packageRoot}/${target}`, { recursive: true, force: true });
      }
      const grammarDirectory = `${packageRoot}/dist/assets/grammar`;
      await mkdir(grammarDirectory, { recursive: true });
      await cp(
        `${projectRoot}/node_modules/harper.js/dist/harper_wasm_bg.wasm`,
        `${grammarDirectory}/harper_wasm_bg.wasm`,
        { force: true },
      );
    },
  };
}

function externalizeLibraryRuntimeAssets(): Plugin {
  const runtimeAssetsModule = fileURLToPath(new URL('./src/lib/runtimeAssets.ts', import.meta.url));
  const fontUrl = /url\((['"]?)(\.\.\/assets\/fonts\/([^'")]+))\1\)/g;
  const harperWasmUrl = /new URL\((['"])harper_wasm_bg\.wasm\1,\s*import\.meta\.url\)\.href/;

  return {
    name: 'externalize-edentext-vue-runtime-assets',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (!normalizedId.includes('/src/styles/global.css?inline') && !normalizedId.includes('/node_modules/harper.js/dist/binary.js')) return null;
      if (normalizedId.endsWith('/src/styles/global.css?inline')) {
        let matchedFonts = 0;
        const transformed = code.replace(fontUrl, (_match, quote, _path, fileName) => {
          matchedFonts++;
          return `url(${quote}https://edentext-vue-assets.invalid/fonts/${fileName}${quote})`;
        });
        if (!matchedFonts) throw new Error('Unable to externalize the inline PDF font URLs for edentext-vue.');
        return transformed;
      }

      if (normalizedId.endsWith('/node_modules/harper.js/dist/binary.js')) {
        if (!harperWasmUrl.test(code)) throw new Error('Unable to externalize the Harper WASM URL for edentext-vue.');
        const specifier = relative(dirname(id), runtimeAssetsModule).split(sep).join('/');
        const runtimeImport = specifier.startsWith('.') ? specifier : `./${specifier}`;
        return `${code.replace(harperWasmUrl, 'runtimeAssetUrl("grammar/harper_wasm_bg.wasm")')}\nimport { runtimeAssetUrl } from ${JSON.stringify(runtimeImport)};`;
      }

      return null;
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
  plugins: [externalizeLibraryRuntimeAssets(), vue({ include: [/\.vue$/] }), svelte({ include: [/\.svelte$/] }), scopePackageCss(), copyPackageAssets()],
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
    __EDENTEXT_VUE_ZH_EN__: JSON.stringify(true),
  },
  resolve: {
    alias: {
      'hunspell-asm': 'hunspell-asm/dist/cjs/index.js',
      'emscripten-wasm-loader': 'emscripten-wasm-loader/dist/cjs/index.js',
    },
  },
});
