import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native Android and iOS packaging (Capacitor) of the same app.
 * Build the web files with `npm run build:native` before syncing.
 *
 * Before the first store release, choose the final `appId`: it identifies the app in
 * Google Play and the App Store and cannot be changed afterwards (see docs/MOBILE.md).
 */
const config: CapacitorConfig = {
  appId: 'org.openfit.app',
  appName: 'OpenFit',
  webDir: 'dist',
  backgroundColor: '#f6f6f4',
  android: {
    allowMixedContent: false,
  },
  ios: {
    // Safe areas are handled in CSS with env(safe-area-inset-*).
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DEFAULT',
    },
  },
};

export default config;
