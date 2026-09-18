/**
 * Native (Capacitor) integration for the Android and iOS apps.
 * Only loaded by the native build; see ./index.ts.
 */
import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { APP_NAME, APP_VERSION } from '../config.ts';
import { parseBackup, summarizeBackup } from '../core/backup.ts';
import type { Theme } from '../core/types.ts';
import { onChange } from '../db/changes.ts';
import { exportBackup, hasUserData, importBackup } from '../db/repos/data.ts';
import { getProfile } from '../db/repos/settings.ts';
import { USER_STORES } from '../db/schema.ts';
import { canGoBack, navigate, router } from '../state/router.svelte.ts';

/**
 * Copy of all personal data inside the app sandbox (never uploaded by the app).
 * It protects against the WebView storage being cleared by the operating system.
 */
const DEVICE_COPY = { path: 'openfit-device-copy.json', directory: Directory.Library };
const DEVICE_COPY_DELAY_MS = 1500;

export async function shareFile(name: string, content: string, _type: string): Promise<boolean> {
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: name, files: [uri] });
    return true;
  } catch (error) {
    if (/cancel/i.test(String((error as Error | undefined)?.message ?? error))) return false;
    throw error;
  }
}

/** Android back button: close the open sheet, go back, go to the diary, then leave the app. */
export function handleBackButton(): void {
  void App.addListener('backButton', () => {
    const open = document.querySelectorAll('dialog[open]');
    const top = open[open.length - 1];
    if (top instanceof HTMLDialogElement) {
      top.close();
    } else if (canGoBack()) {
      history.back();
    } else if (router.route.path !== '/' && router.route.path !== '/welcome') {
      navigate('/', { replace: true });
    } else {
      void App.minimizeApp();
    }
  });
}

async function writeDeviceCopy(): Promise<void> {
  try {
    const backup = await exportBackup({ name: APP_NAME, version: APP_VERSION });
    await Filesystem.writeFile({
      ...DEVICE_COPY,
      data: JSON.stringify(backup),
      encoding: Encoding.UTF8,
    });
  } catch (error) {
    console.warn('Could not update the device copy', error);
  }
}

/** Rewrites the device copy shortly after personal data changes, and when the app goes to the background. */
export function keepDeviceCopy(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const userStores: readonly string[] = USER_STORES;
  onChange((stores) => {
    if (!stores.some((store) => userStores.includes(store))) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void writeDeviceCopy();
    }, DEVICE_COPY_DELAY_MS);
  });
  void App.addListener('pause', () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    void writeDeviceCopy();
  });
}

/** Restores the device copy when the database is empty but the copy has data. */
export async function recoverFromDeviceCopy(): Promise<boolean> {
  if ((await hasUserData()) || (await getProfile())) return false;
  try {
    const { data } = await Filesystem.readFile({ ...DEVICE_COPY, encoding: Encoding.UTF8 });
    const backup = parseBackup(typeof data === 'string' ? data : await data.text());
    const summary = summarizeBackup(backup);
    if (!summary.hasProfile && summary.entries === 0 && summary.weights === 0) return false;
    await importBackup(backup, 'replace');
    return true;
  } catch {
    // No copy yet, or an unreadable one: start fresh.
    return false;
  }
}

export async function deleteDeviceCopy(): Promise<void> {
  try {
    await Filesystem.deleteFile(DEVICE_COPY);
  } catch {
    // Nothing to delete.
  }
}

export async function applySystemBars(theme: Theme): Promise<void> {
  const style =
    theme === 'dark'
      ? SystemBarsStyle.Dark
      : theme === 'light'
        ? SystemBarsStyle.Light
        : SystemBarsStyle.Default;
  await SystemBars.setStyle({ style });
}
