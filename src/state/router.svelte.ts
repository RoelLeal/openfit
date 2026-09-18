/**
 * Hash router: `#/path?query`. Works from any sub-path and on any static host
 * without server rewrites.
 */

export interface Route {
  path: string;
  query: URLSearchParams;
}

interface HistoryState {
  depth: number;
}

function parse(hash: string = location.hash): Route {
  const [path = '/', query = ''] = hash.replace(/^#/, '').split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(query) };
}

let current = $state.raw<Route>(parse());

export const router = {
  get route(): Route {
    return current;
  },
};

function depth(): number {
  return (history.state as HistoryState | null)?.depth ?? 0;
}

let lastDepth = 0;

function update(): void {
  // Plain links (<a href="#/...">) create history entries without state: number them here.
  if (history.state === null) {
    history.replaceState({ depth: lastDepth + 1 } satisfies HistoryState, '');
    window.scrollTo(0, 0);
  }
  lastDepth = depth();
  current = parse();
}

export function initRouter(): () => void {
  if (history.state === null) history.replaceState({ depth: 0 } satisfies HistoryState, '');
  window.addEventListener('popstate', update);
  window.addEventListener('hashchange', update);
  return () => {
    window.removeEventListener('popstate', update);
    window.removeEventListener('hashchange', update);
  };
}

export function href(path: string, query?: Record<string, string | undefined>): string {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- temporary value used to build a string
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return `#${path}${search ? `?${search}` : ''}`;
}

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}): void {
  const url = to.startsWith('#') ? to : `#${to}`;
  if (url === location.hash) return;
  if (replace) history.replaceState({ depth: depth() } satisfies HistoryState, '', url);
  else history.pushState({ depth: depth() + 1 } satisfies HistoryState, '', url);
  update();
  if (!replace) window.scrollTo(0, 0);
}

/** Whether there is an earlier in-app screen to go back to. */
export function canGoBack(): boolean {
  return depth() > 0;
}

/** Goes back inside the app, or to `fallback` when there is no in-app history. */
export function goBack(fallback = '/'): void {
  if (canGoBack()) history.back();
  else navigate(fallback, { replace: true });
}

/** Matches `/foods/:id` style patterns. Returns the params, or null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = path.split('/');
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    const part = expected[i]!;
    const value = actual[i]!;
    if (part.startsWith(':')) {
      if (!value) return null;
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}
