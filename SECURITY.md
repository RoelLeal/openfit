# Security policy

## What OpenFit does with your data

- All personal data (profile, entries, weights, custom foods, meals) is stored on
  the device: in IndexedDB (browser/PWA) and, in the Android and iOS apps, also as
  a private copy inside the app sandbox.
- The app makes **no network requests with personal data**. The only requests are
  to its own origin (app files and optional food catalogs). The production build
  ships a Content-Security-Policy with `connect-src 'self'`, and the Android app
  does not request the `INTERNET` permission at all.
- There are no accounts, analytics, crash reporters or third-party scripts.

Backup files (`openfit-backup-*.json`) are **not encrypted**: they contain your
data in clear text. Store them somewhere you trust.

## Reporting a vulnerability

If you find a way for personal data to leave the device, a bug in backup parsing
that could corrupt data, or any other security issue, please report it
**privately** through GitHub's "Report a vulnerability" button (Security tab of
the repository) rather than a public issue.

Include the app version (Settings → About), platform and steps to reproduce.
We aim to acknowledge reports within 7 days.

## Supported versions

Only the latest release receives fixes.
