/**
 * End-to-end smoke test of the production build in a real browser.
 *
 *   npm run build && npm run e2e
 *
 * Uses the Chrome installed on the machine (playwright-core, no browser download).
 * Set E2E_HEADED=1 to watch it, E2E_BROWSER=<path> to use another Chromium build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Locator, type Page } from 'playwright-core';
import { preview } from 'vite';

const DIST = new URL('../dist/', import.meta.url);
const distPath = (name: string) => fileURLToPath(new URL(name, DIST));
const server = await preview({ preview: { port: 0 }, logLevel: 'silent' });
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('Could not start the preview server');

const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER ? undefined : 'chrome',
  executablePath: process.env.E2E_BROWSER,
  headless: !process.env.E2E_HEADED,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'es-MX',
  acceptDownloads: true,
});
const page = await context.newPage();
const problems: string[] = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});
const origins = new Set<string>();
page.on('request', (request) => origins.add(new URL(request.url()).origin));

let failed = false;
const step = (name: string) => console.log(`✓ ${name}`);
const text = async (locator: Locator) => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Expected ${message}`);
};
const diary = (p: Page = page) =>
  p.getByRole('heading', { name: /^(Diario|Diary)$/ }).waitFor({ timeout: 10_000 });

async function addFood(meal: string, query: string, name: RegExp, amount: string, unit?: string) {
  await page.getByRole('button', { name: `Añadir a ${meal}` }).click();
  await page.getByRole('searchbox', { name: 'Buscar alimentos' }).fill(query);
  await page.getByRole('button', { name }).first().click();
  const sheet = page.getByRole('dialog');
  if (unit) await sheet.getByRole('radio', { name: unit, exact: true }).check({ force: true });
  await sheet.getByLabel('Cantidad').fill(amount);
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click();
  await diary();
}

try {
  // Onboarding with a suggested goal.
  await page.goto(base);
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  const next = page.getByRole('button', { name: 'Continuar' });
  expect(await next.isDisabled(), 'the profile step to require data');
  await page.getByRole('radio', { name: 'Hombre' }).check({ force: true });
  await page.getByLabel('Fecha de nacimiento').fill('1996-03-15');
  await page.getByText(/30 años/).waitFor();
  await page.getByLabel('Altura (cm)').fill('175');
  await page.getByLabel('Peso actual (kg)').fill('80,5');
  await page.getByLabel('Peso objetivo (kg)').fill('75');
  await page.getByRole('img', { name: /Figura corporal: Hombre, 175 cm, 80.5 kg/ }).waitFor();
  await next.click();
  expect(Number(await page.getByLabel('Calorías').inputValue()) > 1200, 'a suggested calorie goal');
  await page.getByRole('button', { name: 'Empezar a registrar' }).click();
  await diary();
  step('onboarding');

  // Main flow: log a catalog food, then quick-add it from recents.
  await addFood('Desayuno', 'huevo', /Huevo entero/, '2');
  expect((await text(page.locator('.summary'))).includes('143'), '143 kcal in the summary');
  await page.getByRole('button', { name: 'Añadir a Comida' }).click();
  await page.getByRole('button', { name: /^Añadir: Huevo entero/ }).click();
  await diary();
  expect((await text(page.locator('.summary'))).includes('286'), '286 kcal after the quick add');
  step('log food and quick add');

  // Edit, delete and undo.
  const lunch = page.getByRole('region', { name: 'Comida' });
  await lunch.getByRole('button', { name: /Huevo entero/ }).click();
  await page.getByRole('dialog').getByLabel('Cantidad').fill('1');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(200);
  expect((await text(lunch)).includes('1 unidad'), 'the edited quantity');
  await lunch.getByRole('button', { name: /Huevo entero/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.waitForTimeout(200);
  expect((await lunch.getByRole('listitem').count()) === 1, 'the entry back after undo');
  step('edit, delete, undo');

  // Custom food created from the search, then logged.
  await page.getByRole('button', { name: 'Añadir a Cena' }).click();
  await page.getByRole('searchbox', { name: 'Buscar alimentos' }).fill('Arroz casero');
  await page.getByRole('button', { name: 'Crear «Arroz casero»' }).first().click();
  await page.getByLabel('Calorías (kcal)').fill('130');
  await page.getByLabel('Proteína (g)').fill('2,7');
  await page.getByLabel('Carbohidratos (g)').fill('28');
  await page.getByLabel('Grasas (g)').fill('0.3');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('heading', { name: 'Arroz casero' }).waitFor();
  await sheet.getByLabel('Cantidad').fill('150');
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click();
  await diary();
  expect(
    (await text(page.getByRole('region', { name: 'Cena' }))).includes('195'),
    '195 kcal of rice',
  );
  step('custom food');

  // Reusable meal from the breakfast, logged on another day.
  await addFood('Desayuno', 'avena', /Avena en hojuelas/, '50', 'g');
  await page
    .getByRole('button', { name: /Guardar como comida/ })
    .first()
    .click();
  await page.getByLabel('Nombre de la comida').fill('Desayuno habitual');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Comida guardada').waitFor();
  await page.getByRole('button', { name: 'Día anterior' }).click();
  await page.getByText('Ayer', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByRole('radio', { name: 'Comidas' }).check({ force: true });
  await page.getByRole('button', { name: /Desayuno habitual/ }).click();
  const logSheet = page.getByRole('dialog');
  await logSheet.getByRole('radio', { name: 'Desayuno' }).check({ force: true });
  await logSheet.getByRole('button', { name: /Añadir 2 alimentos/ }).click();
  await page.getByText('Ayer', { exact: true }).waitFor();
  expect(
    (await text(page.getByRole('region', { name: 'Desayuno' }))).includes('Avena'),
    'the meal logged yesterday',
  );
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  step('reusable meal and day navigation');

  // Weight.
  await page.getByRole('link', { name: 'Peso' }).click();
  await page.getByLabel('Peso (kg)').fill('79,6');
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  await page.getByText('Peso guardado').waitFor();
  await page.locator('.stats').getByText('79.6 kg').waitFor();
  await page.getByRole('slider', { name: 'Evolución del peso' }).waitFor();
  await page.getByRole('img', { name: /Figura corporal/ }).waitFor();
  step('weight');

  // Pounds: stored values stay in kg, the screens convert.
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: 'Libras (lb)' }).check({ force: true });
  await page.getByRole('link', { name: 'Peso' }).click();
  await page.locator('.stats').getByText('175.5 lb').waitFor();
  await page.getByLabel('Peso (lb)').fill('174');
  await page.getByRole('button', { name: 'Guardar peso' }).click();
  await page.locator('.stats').getByText('174 lb').waitFor();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: 'Kilogramos (kg)' }).check({ force: true });
  await page.getByRole('link', { name: 'Peso' }).click();
  await page.locator('.stats').getByText('78.9 kg').waitFor();
  step('pounds and kilograms');

  // The full USDA catalog installs itself: a food outside the curated base is searchable.
  await page.getByRole('link', { name: 'Diario' }).click();
  await page.getByRole('button', { name: 'Añadir alimento' }).click();
  await page.getByRole('searchbox', { name: 'Buscar alimentos' }).fill('camarón');
  await page
    .getByRole('button', { name: /Crustáceos, camarón/ })
    .first()
    .waitFor({ timeout: 15_000 });
  await page.getByRole('searchbox', { name: 'Buscar alimentos' }).fill('huevo');
  expect(
    (await page.locator('.list-item .title').first().innerText()).includes('Huevo'),
    'curated foods ranked first',
  );
  await page.getByRole('button', { name: 'Atrás' }).click();
  step('full catalog installed automatically');

  // Backup export and restore after deleting everything.
  await page.getByRole('link', { name: 'Diario' }).click();
  await diary();
  const summaryBefore = await text(page.locator('.summary'));
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('link', { name: 'Backup y datos' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const file = await download;
  const backupPath = distPath(file.suggestedFilename());
  await file.saveAs(backupPath);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as { data: { entries: unknown[] } };
  expect(backup.data.entries.length === 6, '6 entries in the backup');
  await page.getByRole('button', { name: 'Eliminar todos mis datos' }).click();
  await page.getByRole('button', { name: 'Eliminar sin backup' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('ELIMINAR');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('heading', { name: /bienvenida/ }).waitFor();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restaurar un backup' }).click();
  await (await chooser).setFiles(backupPath);
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
  await diary();
  expect(
    (await text(page.locator('.summary'))) === summaryBefore,
    'the same summary after restoring',
  );
  step('backup, delete all, restore');

  // Offline: reload and use the app with the network cut.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await diary();
  await page.goto(`${base}#/weight`);
  await page.getByRole('heading', { name: 'Peso' }).waitFor();
  await context.setOffline(false);
  step('offline reload');

  // Service worker update: a new sw.js shows the banner and reloads on accept.
  const swPath = distPath('sw.js');
  const original = readFileSync(swPath, 'utf8');
  writeFileSync(swPath, original.replace(/const VERSION = "\w+"/, 'const VERSION = "e2e-update"'));
  try {
    await page.goto(base);
    await page.reload();
    await page.getByText('Hay una nueva versión disponible.').first().waitFor({ timeout: 15_000 });
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Actualizar' }).first().click(),
    ]);
    await diary();
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches.length === 1 && caches[0]?.endsWith('e2e-update'), 'only the new cache');
  } finally {
    writeFileSync(swPath, original);
  }
  step('service worker update');

  // Language and theme persist across reloads.
  await page.goto(`${base}#/settings`);
  await page.getByRole('radio', { name: 'English' }).check({ force: true });
  await page.getByRole('radio', { name: 'Dark' }).check({ force: true });
  await page.getByRole('radio', { name: 'Blue' }).check({ force: true });
  await page.reload();
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  const root = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    accent: document.documentElement.dataset.accent,
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  }));
  expect(
    root.theme === 'dark' && root.accent === 'blue' && root.color === '#6da7ec',
    `the dark blue accent (${JSON.stringify(root)})`,
  );
  step('preferences: language, theme and accent');

  const external = [...origins].filter((origin) => origin !== new URL(base).origin);
  expect(external.length === 0, `no external requests (saw ${external.join(', ')})`);
  expect(problems.length === 0, `no console errors:\n${problems.join('\n')}`);
  step('no network requests to other origins, no console errors');
} catch (error) {
  failed = true;
  console.error('✗', error instanceof Error ? error.message : error);
  await page.screenshot({ path: distPath('failure.png') }).catch(() => {});
  console.error('  screenshot: dist/failure.png');
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
