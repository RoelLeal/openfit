/**
 * Live queries: `live(() => repo.listX(arg))` re-runs when a reactive value read
 * by the query changes, and after any database write (in this or another tab).
 * Must be called during component initialisation.
 */
import { onChange } from '../db/changes.ts';

export class Live<T> {
  /** Raw (not deeply proxied): query results can be large and are replaced, never mutated. */
  value: T = $state.raw() as T;
  loading = $state(true);
  error = $state.raw<unknown>(null);

  constructor(initial: T) {
    this.value = initial;
  }
}

export function live<T>(query: () => Promise<T>, initial: T): Live<T> {
  const result = new Live(initial);

  $effect(() => {
    let active = true;
    let run = 0;
    const execute = () => {
      const id = ++run;
      query().then(
        (value) => {
          if (!active || id !== run) return;
          result.value = value;
          result.error = null;
          result.loading = false;
        },
        (error: unknown) => {
          if (!active || id !== run) return;
          console.error(error);
          result.error = error;
          result.loading = false;
        },
      );
    };
    // Reactive values read synchronously inside `query` become dependencies of this effect.
    execute();
    const unsubscribe = onChange(execute);
    return () => {
      active = false;
      unsubscribe();
    };
  });

  return result;
}
