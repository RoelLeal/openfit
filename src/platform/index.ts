/**
 * Platform facade. The same app runs as a PWA in the browser and, packaged with
 * Capacitor, as a native Android/iOS app (built with `vite build --mode native`).
 * Native code is only imported in the native build, so the web bundle stays small.
 */
import type { Theme } from '../core/types.ts';
import * as web from './web.ts';

export const IS_NATIVE = import.meta.env.MODE === 'native';

export type { StorageStatus } from './web.ts';

const loadNative = () => import('./native.ts');

/**
 * Hands a file to the user: a download on the web (or the share sheet when asked),
 * the system share sheet in the native apps (save to Files, Drive, email...).
 * Resolves false when the user cancels.
 */
export async function exportFile(
  name: string,
  content: string,
  type: string,
  { share = false }: { share?: boolean } = {},
): Promise<boolean> {
  if (IS_NATIVE) return (await loadNative()).shareFile(name, content, type);
  if (share) return web.shareFile(name, content, type);
  web.downloadFile(name, content, type);
  return true;
}

/** Whether a separate "share" action makes sense (the native export already shares). */
export function canShareFiles(): boolean {
  return !IS_NATIVE && web.canShareFiles();
}

// A file <input> works in browsers and in the Capacitor WebViews.
export const pickTextFile = web.pickTextFile;
export const getStorageStatus = web.getStorageStatus;
export const requestPersistentStorage = web.requestPersistentStorage;

/**
 * Starts native-only services (Android back button, device copy of the data).
 * Resolves true when data was recovered from the device copy.
 */
export async function startNativeServices(): Promise<boolean> {
  if (!IS_NATIVE) return false;
  const native = await loadNative();
  native.handleBackButton();
  const recovered = await native.recoverFromDeviceCopy();
  native.keepDeviceCopy();
  return recovered;
}

/** Removes the device copy (used by "delete all my data"). */
export async function deleteDeviceCopy(): Promise<void> {
  if (IS_NATIVE) await (await loadNative()).deleteDeviceCopy();
}

/** Keeps the status/navigation bar icons readable for the chosen theme. */
export async function applySystemBars(theme: Theme): Promise<void> {
  if (IS_NATIVE) await (await loadNative()).applySystemBars(theme);
}
