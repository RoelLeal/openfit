import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { contentSecurityPolicy, pwa } from './scripts/pwa-plugin.ts';

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = readJson('./package.json') as { version: string };
const baseCatalog = readJson('./src/catalog/base-foods.json') as { version: string };

// `vite build` produces the PWA; `vite build --mode native` the files packaged by Capacitor
// for Android and iOS (no service worker: the files already live inside the app).
export default defineConfig(({ mode }) => ({
  // Relative base: the build works from any sub-path (GitHub Pages, a NAS folder, ...).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BASE_CATALOG_VERSION__: JSON.stringify(baseCatalog.version),
  },
  plugins: [
    svelte(),
    contentSecurityPolicy(),
    // Catalog packs are precached too: the full food list must work offline from day one.
    mode !== 'native' && pwa({ swSource: 'src/pwa/sw.js' }),
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}));
