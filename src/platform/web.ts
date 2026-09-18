/** Browser implementations: download, share and pick local files, storage persistence. Nothing leaves the device. */

export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Opens the system share sheet (useful on iOS to save into Files). Returns false if cancelled. */
export async function shareFile(name: string, content: string, type: string): Promise<boolean> {
  const file = new File([content], name, { type });
  try {
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

/** Asks the user for a file and resolves with its text, or null if cancelled. */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) resolve(null);
      else file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export interface StorageStatus {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage;
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.().catch(() => null) ?? null,
    storage?.estimate?.().catch(() => null) ?? null,
  ]);
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

/** Asks the browser not to evict our data. Resolves with the resulting state. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
