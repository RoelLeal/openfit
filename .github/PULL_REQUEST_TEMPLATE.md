## What

<!-- What does this change do, and why? Link the issue if there is one. -->

## How to test

<!-- Steps a reviewer can follow. Mention if it needs a real device (Android/iOS). -->

## Checklist

- [ ] `npm run ci` passes locally (lint, types, tests, build, size budget)
- [ ] New logic in `src/core` or `src/db` has tests
- [ ] User-facing text was added to **both** `src/i18n/en.ts` and `src/i18n/es.ts`
- [ ] No personal data leaves the device (no new network requests, no analytics)
- [ ] Database changes come with a new migration and a backup migration (`docs/ARCHITECTURE.md`)
