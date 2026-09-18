# Architecture

A short guide for contributors. The reasoning behind these decisions is in
[DESIGN.md](DESIGN.md) (Spanish).

## One codebase, three targets

```
src/  ──vite build──────────►  dist/   (PWA: service worker, precache, manifest)
      ──vite build --mode native──►  dist/   ──cap sync──►  android/  ios/
```

The web build and the native build differ only in `import.meta.env.MODE`:
`src/platform/index.ts` checks it and loads `src/platform/native.ts` (Capacitor
plugins) only inside the apps. The web bundle never includes native code.

## Layers

```
┌─ UI ──────────────────────────────────────────────────────────┐
│ src/screens (one file per route)  src/components (reusable)    │
│ reads with live(() => repo.x()), writes with repo.y()          │
├─ App state ───────────────────────────────────────────────────┤
│ src/state: router (hash), live queries, toasts, dialogs, clock,│
│ PWA status, profile/backup glue                                │
├─ Repositories ─── the ONLY code touching IndexedDB ───────────┤
│ src/db/repos/*: stamp ids/timestamps, validate, emit changes   │
├─ Database ────────────────────────────────────────────────────┤
│ src/db/idb.ts (promise wrapper) · schema.ts (migrations)       │
└───────────────────────────────────────────────────────────────┘
        ▲ uses
┌─ Core (pure, no DOM, no DB) ──────────────────────────────────┐
│ src/core: units, nutrition, dates, goals, search, csv, backup, │
│ validate, exports, chart helpers. Most tests live here.        │
└───────────────────────────────────────────────────────────────┘
```

### Rules

- **UI never imports `src/db/idb.ts`** or opens transactions. Use a repository.
- **Every write** goes through `write()` in `src/db/database.ts`, which stamps
  `updatedAt` and emits a change event. `live()` queries re-run on changes, in
  this tab and in other tabs (`BroadcastChannel`).
- **Deleting is logical** (`deletedAt`), so it can be undone and, one day,
  synced. "Delete all my data" is the only physical deletion.
- **Entries store a snapshot** of the food (`entry.food`) so history never
  changes when a food is edited or removed.
- **Totals are computed, never stored.**
- **No network in `src/core` or `src/db`.** The only `fetch` calls are for the
  app's own optional catalog packs (`src/db/repos/catalog.ts`).

## Data model

Every personal record extends `Synced` (`id`, `createdAt`, `updatedAt`,
`deletedAt?`). Ids are UUIDs, except singletons (`profile`, `prefs`) and weights
(`weight:YYYY-MM-DD`, one per day). Types live in `src/core/types.ts`.

| Store      | Contents                                     | Backed up | Notes                       |
| ---------- | -------------------------------------------- | --------- | --------------------------- |
| `meta`     | device id, last backup, installed packs      | no        | device-local                |
| `settings` | `profile`, `prefs`                           | yes       | singletons                  |
| `foods`    | custom foods                                 | yes       |                             |
| `meals`    | reusable meals                               | yes       |                             |
| `entries`  | diary entries (with food snapshot)           | yes       | indexes: date, updatedAt    |
| `weights`  | weight log                                   | yes       |                             |
| `catalog`  | public nutrition data (base + default packs) | no        | never synced, reinstallable |

## Migrations

`DB_VERSION = migrations.length` (`src/db/schema.ts`). Each migration runs inside
the upgrade transaction, so it is atomic. To change the schema:

1. Append a migration (never edit a released one).
2. Bump `SCHEMA_VERSION` in `src/core/backup.ts` and add a backup migration in
   `BACKUP_MIGRATIONS` (backups carry their schema version).
3. Add a test in `src/db/idb.test.ts`.

A test asserts that `SCHEMA_VERSION === DB_VERSION`. Migration v2 is the reference
example: the record upgrade lives once in `src/core/migrations.ts` and is applied
both by the IndexedDB migration (cursor over `settings`) and by
`BACKUP_MIGRATIONS[1]`.

## Backups and the future sync

`src/core/backup.ts` defines the file format, validation and a last-writer-wins
merge (`mergeRecords`). A future optional sync server would exchange exactly
these records: `updatedAt` says what changed, `deletedAt` says what was removed,
`mergeRecords` resolves conflicts. No sync code exists yet, on purpose.

## PWA

`src/pwa/sw.js` is the service worker template; `scripts/pwa-plugin.ts` fills in
the precache list and a content hash at build time. Strategy: precache the whole
app, serve cache-first, navigation always answers with the app shell, updates
wait until the user accepts the banner. Optional packs (`public/packs`) are
never precached.

The same plugin injects a strict Content-Security-Policy into `index.html`
(`connect-src 'self'`).

## Native apps

`src/platform/native.ts` (loaded only in the apps):

- exports go through the system share sheet (`@capacitor/share`);
- the Android back button closes sheets, goes back, then minimises the app;
- a private copy of all data is written to the app sandbox after changes and
  when the app goes to the background, and restored automatically if the
  WebView storage was cleared;
- system bar icons follow the theme.

See [MOBILE.md](MOBILE.md).

## i18n

Flat typed dictionaries (`src/i18n/en.ts` defines the keys). Only the active
language is loaded. Numbers and dates use `Intl` with the browser's region.
`t()` and `tp()` (plurals) are reactive.

## Testing

- Unit: `*.test.ts` next to the code. Database tests use `fake-indexeddb`.
- Smoke: `e2e/smoke.ts` drives the production build in Chrome
  (onboarding → log → backup → offline → update).
- No 100 % coverage goal. Test what is easy to get wrong: math, conversions,
  dates, validation, migrations, backups.

## Size budget

`scripts/check-size.ts` fails the build if the initial load exceeds 60 KB gzip
or the precache exceeds 250 KB gzip. Check it after adding anything heavy.
