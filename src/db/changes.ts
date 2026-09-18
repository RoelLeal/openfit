/**
 * Change notifications. Every repository write calls `emitChange`, which re-runs
 * live queries in this tab and, through BroadcastChannel, in other open tabs.
 * A future sync layer can subscribe here to know when to push.
 */
import type { StoreName } from './schema.ts';

type Listener = (stores: StoreName[]) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null | undefined;

function notify(stores: StoreName[]): void {
  for (const listener of listeners) listener(stores);
}

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel =
      typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('openfit:changes')
        : null;
    channel?.addEventListener('message', (event: MessageEvent<StoreName[]>) => notify(event.data));
  }
  return channel;
}

export function emitChange(stores: StoreName[]): void {
  notify(stores);
  getChannel()?.postMessage(stores);
}

export function onChange(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
