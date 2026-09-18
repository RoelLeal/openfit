# OpenFit

A local-first, privacy-first nutrition tracker: calories, macros, weight and
goals. Runs as an **Android app**, an **iOS app** and an installable **PWA** —
all from the same code.

- **No account, no server, no cloud.** Everything lives on your device.
- **Works offline**, always. Nothing is sent anywhere; the Android app does not
  even request the Internet permission.
- **Your data is yours:** export a JSON backup or CSV files, restore, or delete
  everything, whenever you want.
- **Fast:** open → add food → amount → save. Recent foods are one tap away.
- **Small:** ~57 KB of JavaScript and CSS for the first load, no runtime
  dependencies besides the app itself.
- Spanish and English, light and dark themes, six accent colors, keyboard and screen-reader friendly.

> **Name:** "OpenFit" is a working name. Check for trademark conflicts before
> publishing under it (see [docs/DESIGN.md](docs/DESIGN.md), section 17).

## Features (MVP 0.1.0)

| Area           | What you can do                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diary          | Log foods per meal (breakfast, lunch, dinner, snacks), see calories and macros against your goals.                                                 |
| Foods          | ~7,800 foods out of the box (99 curated with ES/EN names + the USDA SR Legacy catalog with translated names); create your own only if you want to. |
| Meals          | Save combinations you eat often and log them in one tap.                                                                                           |
| Quantities     | Grams, kilograms, millilitres, litres, units and servings.                                                                                         |
| History        | Move between days, pick a date in the calendar.                                                                                                    |
| Weight         | Log your weight in kg or lb, see the trend, your target and a body figure sized by your height and weight.                                         |
| Goals          | Calories, protein, carbs, fat. Get a suggestion (Mifflin-St Jeor, from your birthday, sex, height and weight) or set your own.                     |
| Data ownership | JSON backup/restore (replace or merge), CSV exports, delete everything.                                                                            |

## Quick start (developers)

Requirements: Node 22.18+ (24 recommended, see `.nvmrc`).

```bash
git clone <this repository>
cd openfit
npm install
npm run dev        # http://localhost:5173
```

Useful commands:

| Command               | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `npm test`            | Unit tests (Vitest; IndexedDB tests run on `fake-indexeddb`).         |
| `npm run check`       | Type checks (svelte-check + tsc for scripts).                         |
| `npm run lint`        | ESLint + Prettier.                                                    |
| `npm run build`       | Production PWA in `dist/` (service worker generated).                 |
| `npm run size`        | Checks the size budget of the build.                                  |
| `npm run e2e`         | Browser smoke test of `dist/` (needs Chrome installed).               |
| `npm run ci`          | Everything CI runs: lint, check, test, build, size.                   |
| `npm run catalog`     | Rebuilds the food catalog from USDA data (downloads a 6 MB zip once). |
| `npm run icons`       | Regenerates PWA icons and native icon/splash sources.                 |
| `npm run android`     | Builds the web app and runs it on a connected device or emulator.     |
| `npm run android:apk` | Builds a debug APK (`android/app/build/outputs/apk/debug/`).          |
| `npm run ios`         | Builds and runs the iOS app (macOS + Xcode).                          |

Mobile details (requirements, signing, store release, device testing):
[docs/MOBILE.md](docs/MOBILE.md).

## Hosting the PWA yourself

The build is a folder of static files with relative URLs: put `dist/` behind any
web server, on any sub-path. `npm run preview` serves it locally; the
[Dockerfile](Dockerfile) builds an nginx image (`docker build -t openfit . &&
docker run -p 8080:80 openfit`). GitHub Pages works out of the box with the
included workflow.

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md) — product and technical design (Spanish):
  goals, MVP, stack decision, data model, backup format, roadmap, risks.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code is organised and
  the rules to follow when changing it.
- [docs/DATA.md](docs/DATA.md) — food catalog pipeline, pack format, licenses.
- [docs/MOBILE.md](docs/MOBILE.md) — Android and iOS apps.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
  [CHANGELOG.md](CHANGELOG.md).

## Privacy

No accounts, servers, analytics, ads or cookies. Your profile, entries and
weights never leave your device unless you export them yourself. Nutrition
values come from [USDA FoodData Central](https://fdc.nal.usda.gov/) (public
domain, CC0 1.0). OpenFit is a tracking tool and does not give medical advice.

## License

Code: [MIT](LICENSE). Curated food data in `data/` and `src/catalog/`: CC0 1.0.
