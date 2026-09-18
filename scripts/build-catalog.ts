/**
 * Builds the food catalog from USDA FoodData Central – SR Legacy (public domain, CC0 1.0).
 *
 *   npm run catalog                          downloads the dataset (6 MB) into data/raw/ if needed
 *   npm run catalog -- --source <zip|folder> uses a dataset you already have
 *
 * Outputs
 *   src/catalog/base-foods.json        curated foods bundled with the app (data/base-foods.csv)
 *   public/packs/usda-sr-legacy.json   optional pack, downloaded by users on demand
 *   public/packs/index.json            list of optional packs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  BASE_PACK_ID,
  encodePack,
  parsePack,
  type PackFile,
  type PackInfo,
  type PackListing,
} from '../src/catalog/packs.ts';
import { parseCsvObjects } from '../src/core/csv.ts';
import {
  buildBaseRows,
  buildFullRows,
  foodNames,
  nutrientsByFood,
  portionsByFood,
  type CuratedFood,
  type PackRow,
} from './lib/usda.ts';
import { translateName } from './lib/glossary.ts';
import { listZipEntries } from './lib/zip.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const DATASET = 'FoodData_Central_sr_legacy_food_csv_2018-04';
const DATASET_URL = `https://fdc.nal.usda.gov/fdc-datasets/${DATASET}.zip`;
const NEEDED = ['food.csv', 'food_nutrient.csv', 'food_portion.csv'];
const USDA = {
  license: 'CC0-1.0',
  attribution:
    'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, April 2018. fdc.nal.usda.gov',
  source: 'https://fdc.nal.usda.gov/',
};

async function readDataset(source: string | undefined): Promise<Record<string, string>> {
  let path = source;
  if (!path) {
    path = join(root, 'data', 'raw', `${DATASET}.zip`);
    if (!existsSync(path)) {
      console.log(`Downloading ${DATASET_URL} ...`);
      const response = await fetch(DATASET_URL);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(await response.arrayBuffer()));
    }
  }

  const files: Record<string, string> = {};
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      if (NEEDED.includes(name)) files[name] = readFileSync(join(path, name), 'utf8');
    }
  } else {
    for (const entry of listZipEntries(readFileSync(path))) {
      const name = basename(entry.name);
      if (NEEDED.includes(name)) files[name] = entry.read().toString('utf8');
    }
  }
  for (const name of NEEDED) {
    if (files[name] === undefined) throw new Error(`${name} not found in ${path}`);
  }
  return files;
}

function contentVersion(prefix: string, rows: PackRow[]): string {
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 10);
  return `${prefix}+${hash}`;
}

/** One food per line keeps diffs readable. */
function stringifyPack(pack: PackFile): string {
  const { foods, ...header } = pack;
  const head = JSON.stringify(header, null, 2).replace(/\n}$/, '');
  const body = foods.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  return `${head},\n  "foods": [\n${body}\n  ]\n}\n`;
}

function writePack(path: string, info: PackInfo, rows: PackRow[]): { text: string; count: number } {
  const text = stringifyPack(encodePack(info, rows));
  const count = parsePack(JSON.parse(text)).foods.length; // validates the output
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(
    `✓ ${path.slice(root.length)}  ${count} foods, ${(text.length / 1024).toFixed(1)} KB`,
  );
  return { text, count };
}

async function main() {
  const { values } = parseArgs({ options: { source: { type: 'string' } } });
  const files = await readDataset(values.source);
  const nutrients = nutrientsByFood(files['food_nutrient.csv']!);
  const portions = portionsByFood(files['food_portion.csv']!);
  const names = foodNames(files['food.csv']!);

  const curated = parseCsvObjects(
    readFileSync(join(root, 'data', 'base-foods.csv'), 'utf8'),
  ) as unknown as CuratedFood[];
  const baseRows = buildBaseRows(curated, nutrients, portions);
  writePack(
    join(root, 'src', 'catalog', 'base-foods.json'),
    {
      id: BASE_PACK_ID,
      version: contentVersion('1', baseRows),
      name: 'OpenFit basics',
      description: 'Common foods with Spanish and English names, curated from USDA SR Legacy.',
      ...USDA,
    },
    baseRows,
  );

  const fullRows = buildFullRows(
    names,
    nutrients,
    new Set(curated.map((food) => food.fdc_id)),
    translateName,
  );
  const fullInfo: PackInfo = {
    id: 'usda-sr-legacy',
    version: contentVersion('2018-04', fullRows),
    name: 'USDA SR Legacy',
    description:
      'About 7,700 generic foods from the USDA, per 100 g, with automatically translated Spanish names.',
    ...USDA,
  };
  const full = writePack(join(root, 'public', 'packs', 'usda-sr-legacy.json'), fullInfo, fullRows);

  const listing: PackListing = {
    id: fullInfo.id,
    default: true,
    version: fullInfo.version,
    name: fullInfo.name,
    description: fullInfo.description ?? '',
    file: 'usda-sr-legacy.json',
    foods: full.count,
    bytes: Buffer.byteLength(full.text),
    license: fullInfo.license,
  };
  writeFileSync(
    join(root, 'public', 'packs', 'index.json'),
    `${JSON.stringify({ packs: [listing] }, null, 2)}\n`,
  );
  console.log('✓ public/packs/index.json');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
