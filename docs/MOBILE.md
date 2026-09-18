# Android and iOS apps

The native apps are the same web app packaged with
[Capacitor 8](https://capacitorjs.com/). No feature lives only in the apps: the
PWA is always complete. The apps add what a browser cannot give:

- a store listing and a home-screen icon without "install this site" steps;
- the system share sheet for exports (save to Files/Drive, send by email…);
- the Android back button;
- a **private copy of the data** in the app sandbox, restored automatically if
  the system clears the WebView storage;
- no Internet permission on Android (enforced by the OS, not only by the app).

## Requirements

| Target  | Needs                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android | Android Studio (Otter 2025.2.1+) or the SDK with platform 36 and build-tools. Any JDK 17+ can run Gradle; the Java 21 toolchain Capacitor 8 needs is picked from the JDKs installed on the machine or downloaded automatically. |
| iOS     | macOS with Xcode 26+ (iOS 15+ devices). Cannot be built on Windows or Linux.                                                                                                                                                    |

Capacitor 8 targets Android 7.0+ (API 24) and iOS 15+.

## Everyday workflow

```bash
npm run mobile:sync     # build the web app (--mode native) and copy it into android/ and ios/
npm run android         # …then run on the connected device / running emulator
npm run android:open    # open the project in Android Studio
npm run android:apk     # debug APK in android/app/build/outputs/apk/debug/
npm run ios             # macOS: build and run on a simulator or device
npm run ios:open        # macOS: open in Xcode
```

Run `npm run mobile:sync` after every web change you want to test natively.
Native projects are committed (`android/`, `ios/`); build outputs are ignored.

The native build differs from the PWA build only in `import.meta.env.MODE ===
'native'`: no service worker (files ship in the package), exports use the share
sheet, catalog packs are "installed" from the bundled copy. Native-only code is
in `src/platform/native.ts` and is never part of the web bundle.

### Debugging the WebView

Both platforms expose the WebView to desktop dev tools in debug builds:
Chrome → `chrome://inspect` for Android, Safari → Develop menu for iOS. The
`e2e/` folder shows how to drive the Android WebView with Playwright over CDP.

## Icons and splash screens

`npm run icons` draws the logo as PNGs: PWA icons in `public/icons/` and the
sources for the apps in `assets/`. `npm run mobile:assets` turns those sources
into every Android/iOS resource (`@capacitor/assets`, run with `npx`, not a
dependency). Commit the generated resources.

## Privacy decisions in the native projects

| Where                               | Setting                                 | Why                                                           |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `android/…/AndroidManifest.xml`     | no `INTERNET` permission                | The app never uses the network.                               |
| `android/…/AndroidManifest.xml`     | `android:allowBackup="false"`           | Keeps personal data out of Google's cloud backups by default. |
| `ios/App/App/PrivacyInfo.xcprivacy` | no tracking, no collected data          | Apple privacy manifest.                                       |
| `ios/App/App/Info.plist`            | `ITSAppUsesNonExemptEncryption = false` | No custom encryption (App Store export compliance).           |
| `capacitor.config.ts`               | `SystemBars.insetsHandling = css`       | Safe areas handled in CSS (`--safe-top`, `--safe-bottom`).    |

The device copy (`openfit-device-copy.json`) lives in the app's private
directory (`Directory.Library`): not readable by other apps, removed on
uninstall, excluded from Android auto-backup. It is rewritten shortly after
changes and when the app goes to the background, and deleted by "Delete all my
data".

## Releasing

Before the first store upload:

1. **Choose the final `appId`** in `capacitor.config.ts` (currently
   `org.openfit.app`), then update `android/app/build.gradle`
   (`applicationId`/`namespace`), the Java package folder, and the bundle
   identifier in Xcode. Store ids cannot change later.
2. **Version numbers**: `versionCode`/`versionName` in `android/app/build.gradle`,
   `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in Xcode. Keep `package.json`
   in step; the app shows it in Settings → About.
3. **Android signing**: create an upload keystore, keep it out of git
   (`*.keystore`/`*.jks` are ignored) and build a bundle:
   `node scripts/gradle.ts bundleRelease`. Configure signing through
   `~/.gradle/gradle.properties` or a `keystore.properties` file that is not
   committed.
4. **iOS**: an Apple Developer account, a bundle id, and archive from Xcode.
5. Store listings must state the privacy facts truthfully: no data collected,
   no tracking (Google Play Data safety form, App Store privacy "nutrition
   labels").

The `Android` workflow (`.github/workflows/android.yml`) builds a debug APK on
demand or for `v*` tags, useful for testers.

## Troubleshooting

- **`error: invalid source release: 21`** — Capacitor 8 compiles with Java 21 while
  Gradle was started with an older JDK. `android/build.gradle` declares a Java 21
  toolchain and `android/settings.gradle` the Foojay resolver, so Gradle finds or
  downloads a JDK 21 on its own. If the error still appears, run
  `./gradlew javaToolchains` inside `android/` to see what Gradle detects, or set
  `org.gradle.java.home` in your user `~/.gradle/gradle.properties`.
- **`'gradlew' is not recognized as an internal or external command`** (Windows) — the
  machine sets `NoDefaultCurrentDirectoryInExePath`, so cmd.exe does not look for
  `gradlew.bat` in the current folder. The npm scripts go through `scripts/cap.ts` and
  `scripts/gradle.ts`, which handle this; when calling the wrapper by hand, prefix it
  with the folder (`.\gradlew.bat assembleDebug`).
- **Android Studio uses another JDK** — File → Settings → Build Tools → Gradle →
  Gradle JDK. Thanks to the toolchain it only has to be 17 or newer.

## Known limitations

- iOS builds need a Mac; the project was generated and configured here but not
  compiled on macOS yet.
- The WebView's `<input type="file">` is used for restoring backups; on iOS the
  picker offers Files, on Android any document provider.
- Capacitor logs three harmless `Error injecting safe area CSS` lines on Android
  before the page exists; the insets are applied once the page has loaded.
