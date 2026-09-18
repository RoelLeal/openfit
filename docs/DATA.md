# Food data

OpenFit keeps two very different kinds of data apart:

- **Nutrition catalog** — public information about foods. Shipped with the app,
  extendable with optional packs, never personal, never included in backups.
- **Personal data** — profile, diary, weights, custom foods and meals. Stays on
  the device.

## Sources and licenses

| Source                                       | License                 | Used for                                                        |
| -------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| USDA FoodData Central — SR Legacy (2018-04)  | CC0 1.0 / public domain | Built-in catalog (curated selection) and the optional full pack |
| OpenFit curated data (`data/base-foods.csv`) | CC0 1.0                 | Spanish/English names, aliases, unit and serving sizes          |

USDA asks that FoodData Central be cited as the source; the app does so in
Settings → About, and every pack file carries `license`, `attribution` and
`source` fields.

Not used, on purpose:

- **Open Food Facts** (ODbL + DbCL, images CC-BY-SA): share-alike terms would
  apply to any derived database. It could become a separate, clearly labelled
  ODbL pack later, but it is never mixed with the CC0 data.
- National tables (BEDCA, SMAE, INCAP, …): licenses are restrictive or unclear.

## Pipeline

```
data/base-foods.csv ─┐
                     ├─ scripts/build-catalog.ts ─┬─► src/catalog/base-foods.json   (bundled, ~12 KB)
USDA SR Legacy zip ──┘                            ├─► public/packs/usda-sr-legacy.json (optional, ~700 KB)
(downloaded once into data/raw/)                  └─► public/packs/index.json
```

```bash
npm run catalog                       # downloads the USDA zip on first run
npm run catalog -- --source <zip|dir> # use a copy you already have
```

The script reads three USDA CSVs (`food.csv`, `food_nutrient.csv`,
`food_portion.csv`), keeps energy (1008), protein (1003), fat (1004) and
carbohydrates (1005) per 100 g, and:

- for the **curated base**, uses the FDC ids listed in `data/base-foods.csv`,
  adds names, aliases, unit size (`unit_g`) and serving size (`serving_g`), and
  expresses liquids per 100 ml using the density from USDA's cup/fl-oz portions;
- for the **full pack**, keeps every SR Legacy food with complete data, per
  100 g, and adds a Spanish name produced by `scripts/lib/glossary.ts` (see below).

Output is validated with the same parser the app uses (`src/catalog/packs.ts`).

## `data/base-foods.csv`

| Column      | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `slug`      | Stable id (`base:<slug>` in the app). Never rename a released one. |
| `fdc_id`    | USDA FoodData Central id the values come from                      |
| `name_es`   | Spanish name (Mexican Spanish first, regional synonyms in aliases) |
| `name_en`   | English name (also the canonical `name`)                           |
| `aliases`   | `;`-separated search synonyms                                      |
| `unit`      | `g` or `ml` (base unit of the nutrition facts)                     |
| `unit_g`    | Weight in grams of one unit (one egg, one tortilla…), optional     |
| `serving_g` | Weight in grams of one serving, optional                           |

To fix or add a food: edit the CSV (with a public source for any value),
run `npm run catalog`, run `npm test` (the bundled pack is checked), and open a
pull request. The pack `version` changes automatically with the content, which
makes the app reinstall the base catalog on the next start.

## Spanish names for the full catalog

USDA names are structured ("Chicken, broilers or fryers, breast, meat only, cooked,
roasted"). `scripts/lib/glossary.ts` translates them segment by segment with a
glossary of ~600 phrases and words (Mexican Spanish first): "Pollo, de engorde,
pechuga, solo carne, cocido, asado". Unknown words and brand names stay in English,
so the result is meant for **searching** and as a readable label, not as prose; the
app says so in Settings → Food catalogs. Average word coverage is about 76 %.
To improve a translation, add or fix entries in the glossary and run
`npm run catalog`; `scripts/lib/glossary.test.ts` pins a few examples.

The pack is marked `default` in `public/packs/index.json`, so the app installs it
on first start. It ships with the app: precached by the service worker in the PWA
(about 230 KB gzip) and bundled in the Android/iOS packages.

## Pack format

```json
{
  "format": "openfit-pack",
  "formatVersion": 1,
  "id": "usda-sr-legacy",
  "version": "2018-04+<content hash>",
  "name": "USDA SR Legacy",
  "license": "CC0-1.0",
  "attribution": "U.S. Department of Agriculture, ...",
  "source": "https://fdc.nal.usda.gov/",
  "fields": ["id", "name", "kcal", "protein", "carbs", "fat"],
  "foods": [["171287", "Egg, whole, raw, fresh", 143, 12.56, 0.72, 9.51]]
}
```

Column-based to stay small. Allowed fields: `id`, `name`, `name_es`, `name_en`,
`aliases`, `brand`, `unit` (`g`/`ml`/`unit`, default `g`), `amount` (default
100), `kcal`, `protein`, `carbs`, `fat`, `unitSize`, `servingSize`, `sourceId`.
Food ids become `<pack id>:<id>`.

Packs listed in `public/packs/index.json` appear in Settings → Food catalogs,
where they can be removed (to free space) and installed again. Packs flagged
`default` install automatically. Removing a pack never breaks diary entries:
each entry keeps a snapshot of its food.

## Nutrition math

- Facts are stored per `baseAmount` of `baseUnit`. A quantity is converted to
  the base unit (`src/core/units.ts`) and scaled (`src/core/nutrition.ts`).
- `g↔kg` and `ml↔l` always convert; `unit` needs `unitSize`, `serving` needs
  `servingSize`. Grams and millilitres are never converted into each other in
  the app.
- Values are kept as floats and rounded only for display.
- Goal suggestions use Mifflin-St Jeor (`src/core/goals.ts`) and are labelled
  as an estimate, not medical advice.
