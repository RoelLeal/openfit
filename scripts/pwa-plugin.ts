/**
 * Tiny Vite plugin that turns src/pwa/sw.js into dist/sw.js with the list of files
 * to precache and a version hash derived from their content. Replaces Workbox.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface PwaOptions {
  /** Service worker template, relative to the project root. */
  swSource: string;
  /** Output paths (relative to outDir, forward slashes) that must not be precached. */
  exclude?: RegExp[];
}

export const VERSION_PLACEHOLDER = 'self.__PRECACHE_VERSION__';
export const FILES_PLACEHOLDER = 'self.__PRECACHE_FILES__';

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

/** Pure part of the plugin, exported for tests. */
export function renderServiceWorker(template: string, version: string, files: string[]): string {
  if (!template.includes(VERSION_PLACEHOLDER) || !template.includes(FILES_PLACEHOLDER)) {
    throw new Error('Service worker template is missing its placeholders');
  }
  return template
    .replace(VERSION_PLACEHOLDER, JSON.stringify(version))
    .replace(FILES_PLACEHOLDER, JSON.stringify(files));
}

export function pwa({ swSource, exclude = [] }: PwaOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'openfit-pwa',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const files = (await listFiles(outDir))
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
        .filter((file) => !exclude.some((pattern) => pattern.test(file)))
        .sort();

      const template = await readFile(resolve(config.root, swSource), 'utf8');
      // The version changes when any precached file or the worker itself changes.
      const hash = createHash('sha256').update(template);
      for (const file of files) {
        hash.update(file);
        hash.update(await readFile(join(outDir, file)));
      }
      const version = hash.digest('hex').slice(0, 12);
      await writeFile(join(outDir, 'sw.js'), renderServiceWorker(template, version, files));
      config.logger.info(`\n[pwa] sw.js: ${files.length} files precached, version ${version}`);
    },
  };
}

/**
 * Strict Content-Security-Policy for the production build. `connect-src 'self'`
 * guarantees the app cannot send data to any other origin. Dev mode is left alone
 * because Vite's HMR needs websockets and inline styles.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function contentSecurityPolicy(policy: string = CONTENT_SECURITY_POLICY): Plugin {
  return {
    name: 'openfit-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes('<!-- CSP -->'))
        throw new Error('index.html is missing the <!-- CSP --> marker');
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}
