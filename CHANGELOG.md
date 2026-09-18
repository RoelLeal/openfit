# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The full USDA catalog (7,694 foods) installs automatically on first start and ships
  with the app (precached in the PWA, bundled in the apps), with automatically
  translated Spanish names for searching. Creating your own foods is now optional.
- Accent color (six choices) in Settings.
- Body weight in kilograms or pounds (stored in kg, converted on screen).
- A body figure drawn from sex, height and weight, with the target weight as an outline
  (profile, onboarding and weight screens).

### Changed

- The profile asks for the date of birth instead of an age, and sex (female or male) is
  required. Onboarding can no longer be skipped. Database and backup schema version 2
  migrate existing data.
- The curated base foods rank above the raw USDA rows in search results.

### Fixed

- Android build with a JDK other than 21 (Gradle toolchain) and on Windows machines
  where cmd.exe does not search the current directory for `gradlew`.

## [0.1.0] - 2026-09-17

First MVP: a local-first, privacy-first nutrition tracker for Android, iOS and
the web (installable PWA).

### Added

- Onboarding without accounts: profile (age, height, weight, target weight,
  activity), daily calorie and macro goals with a Mifflin-St Jeor suggestion.
- Diary by day (breakfast, lunch, dinner, snacks) with calories, protein, carbs
  and fat against goals; day navigation and calendar.
- Built-in catalog of 99 common foods (Spanish and English names, unit and
  serving sizes) curated from USDA FoodData Central (CC0); optional USDA SR
  Legacy pack (~7,700 foods).
- Search with recents and one-tap quick add; quantities in g, kg, ml, l, units
  and servings.
- Custom foods and reusable meals.
- Weight log with a chart and target line.
- JSON backup and restore (replace or merge), CSV exports, "delete all my
  data", backup reminders.
- Works fully offline (service worker), update banner, light/dark theme,
  Spanish and English.
- Android and iOS apps (Capacitor) sharing the same code: system share sheet
  for exports, back button handling, private device copy of the data for
  recovery, no INTERNET permission on Android.
