/**
 * Size budget for the production build (run after `npm run build`).
 *
 *   initial  = JS + CSS loaded by index.html before the first screen renders,
 *              plus the largest language dictionary (loaded before mounting)
 *   precache = every file the service worker stores for offline use (catalog packs included)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LOCALES } from '../src/core/types.ts';

// The precache includes the USDA catalog (~230 KB gzip), hence the larger budget.
const BUDGET_KB = { initial: 60, precache: 400 };

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

function gzipKb(file: string): number {
  return gzipSync(readFileSync(join(dist, file)), { level: 9 }).length / 1024;
}

function precachedFiles(): string[] {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const match = /const FILES = (\[.*?\]);/s.exec(sw);
  if (!match?.[1]) throw new Error('Could not read the precache list from dist/sw.js');
  return JSON.parse(match[1]) as string[];
}

/** Files referenced by index.html (scripts, module preloads and stylesheets). */
function initialFiles(): string[] {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\.\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
  return [...new Set(refs)];
}

const precache = precachedFiles();
const dictionaryPattern = new RegExp(`^assets/(${LOCALES.join('|')})-[\\w-]+\\.js$`);
const dictionaries = precache.filter((file) => dictionaryPattern.test(file));
if (dictionaries.length !== LOCALES.length) {
  throw new Error(
    `Expected ${LOCALES.length} dictionary chunks, found: ${dictionaries.join(', ')}`,
  );
}
const largestDictionary = dictionaries.sort((a, b) => gzipKb(b) - gzipKb(a))[0]!;
const initial = [...initialFiles(), largestDictionary];
const all = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join('/'));

const initialKb = initial.reduce((sum, file) => sum + gzipKb(file), 0);
const precacheKb = precache.reduce((sum, file) => sum + gzipKb(file), 0);

console.log('Initial load (gzip):');
for (const file of initial) console.log(`  ${gzipKb(file).toFixed(1).padStart(6)} KB  ${file}`);
console.log(`\ninitial   ${initialKb.toFixed(1)} KB / ${BUDGET_KB.initial} KB`);
console.log(
  `precache  ${precacheKb.toFixed(1)} KB / ${BUDGET_KB.precache} KB (${precache.length} files)`,
);
console.log(
  `not precached: ${all.filter((f) => f !== 'sw.js' && !precache.includes(f)).join(', ') || '-'}`,
);

const failures = [
  initialKb > BUDGET_KB.initial && 'initial load',
  precacheKb > BUDGET_KB.precache && 'precache',
].filter(Boolean);
if (failures.length > 0) {
  console.error(`\n✗ Over budget: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ Within budget');
}
