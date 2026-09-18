/** App-wide reactive state: today's date, theme and PWA status. */
import { today as todayKey } from '../core/dates.ts';
import type { Accent, Theme } from '../core/types.ts';
import { IS_NATIVE } from '../platform/index.ts';

const THEME_CACHE_KEY = 'openfit:theme';
const ACCENT_CACHE_KEY = 'openfit:accent';

export const clock = $state({ today: todayKey() });

/** Keeps `clock.today` right after midnight or when the app comes back from the background. */
export function startClock(): () => void {
  const tick = () => {
    const now = todayKey();
    if (now !== clock.today) clock.today = now;
  };
  const interval = setInterval(tick, 30_000);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', tick);
  };
}

export function applyAppearance(theme: Theme, accent: Accent): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  if (accent === 'green') delete root.dataset.accent;
  else root.dataset.accent = accent;
  // Cached per device only to avoid a flash of the wrong look on start (public/theme.js).
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
    localStorage.setItem(ACCENT_CACHE_KEY, accent);
  } catch {
    // Storage may be unavailable (private mode); the appearance still applies.
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state({
  /** Running inside the Android/iOS app: no install prompt, no service worker. */
  native: IS_NATIVE,
  updateAvailable: false,
  canInstall: false,
  installed: false,
  isIos: false,
});

let installEvent: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;

export function initInstallPrompt(): void {
  pwa.installed =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  pwa.isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event as BeforeInstallPromptEvent;
    pwa.canInstall = true;
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    pwa.canInstall = false;
    pwa.installed = true;
  });
}

export async function promptInstall(): Promise<void> {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  pwa.canInstall = false;
}

/** Registers the service worker (production only) and tracks available updates. */
export async function registerServiceWorker(): Promise<void> {
  // The native apps ship their files inside the package; no service worker needed.
  if (!import.meta.env.PROD || IS_NATIVE || !('serviceWorker' in navigator)) return;
  const hadController = navigator.serviceWorker.controller !== null;
  registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });

  const watch = (worker: ServiceWorker | null) => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        pwa.updateAvailable = true;
      }
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) pwa.updateAvailable = true;
  watch(registration.installing);
  registration.addEventListener('updatefound', () => watch(registration?.installing ?? null));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install takes control silently; later changes mean an accepted update.
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  const check = () => registration?.update().catch(() => {});
  setInterval(check, 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (waiting) waiting.postMessage('skipWaiting');
  else location.reload();
}
