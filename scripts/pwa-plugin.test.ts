import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderServiceWorker } from './pwa-plugin.ts';

describe('renderServiceWorker', () => {
  it('injects the version and file list into the real template', () => {
    const template = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8');
    const sw = renderServiceWorker(template, 'abc123', ['index.html', 'assets/app.js']);
    expect(sw).toContain('const VERSION = "abc123";');
    expect(sw).toContain('const FILES = ["index.html","assets/app.js"];');
    expect(sw).not.toContain('__PRECACHE');
  });

  it('fails loudly when placeholders are missing', () => {
    expect(() => renderServiceWorker('console.log(1)', 'v', [])).toThrow(/placeholders/);
  });
});
