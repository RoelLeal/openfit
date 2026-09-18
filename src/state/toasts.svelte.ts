/** Short, non-blocking messages with an optional action (e.g. "Undo"). */

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void | Promise<void> };
}

let nextId = 1;
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- timer handles, not reactive state
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const toasts = $state<Toast[]>([]);

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) toasts.splice(index, 1);
}

export function showToast(
  message: string,
  {
    action,
    tone = 'info',
    duration,
  }: Partial<Pick<Toast, 'action' | 'tone'>> & { duration?: number } = {},
): number {
  const id = nextId++;
  // Only one toast at a time keeps the screen calm.
  for (const toast of [...toasts]) dismissToast(toast.id);
  toasts.push({ id, message, tone, action });
  timers.set(
    id,
    setTimeout(() => dismissToast(id), duration ?? (action ? 6000 : 3000)),
  );
  return id;
}

export function showError(error: unknown, message: string): void {
  console.error(error);
  showToast(message, { tone: 'error', duration: 6000 });
}
