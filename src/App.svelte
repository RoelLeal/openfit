<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import AppNav from './components/AppNav.svelte';
  import DialogHost from './components/DialogHost.svelte';
  import Icon from './components/Icon.svelte';
  import Toasts from './components/Toasts.svelte';
  import type { Prefs, Profile } from './core/types.ts';
  import { getDb, setDatabaseHandlers } from './db/database.ts';
  import { ensureBaseCatalog, ensureDefaultPacks } from './db/repos/catalog.ts';
  import { getPrefs, getProfile } from './db/repos/settings.ts';
  import { cacheLocale, detectLocale, i18n, setLocale, t } from './i18n/index.svelte.ts';
  import { routes, WELCOME_PATH, type RouteDef } from './routes.ts';
  import {
    applyAppearance,
    applyUpdate,
    initInstallPrompt,
    pwa,
    registerServiceWorker,
    startClock,
  } from './state/app.svelte.ts';
  import { applySystemBars, startNativeServices } from './platform/index.ts';
  import { markFirstUse } from './state/backup.ts';
  import { live } from './state/live.svelte.ts';
  import { initRouter, matchRoute, navigate, router } from './state/router.svelte.ts';
  import { showError, showToast } from './state/toasts.svelte.ts';

  type BootState = 'loading' | 'ready' | 'no-storage' | 'stale' | 'error';

  let boot = $state<BootState>('loading');
  const prefs = live<Prefs | null>(getPrefs, null);
  const profile = live<Profile | null | undefined>(getProfile, undefined);
  const loaded = new SvelteMap<RouteDef, NonNullable<RouteDef['component']>>();

  const match = $derived.by(() => {
    for (const def of routes) {
      const params = matchRoute(def.pattern, router.route.path);
      if (params) return { def, params };
    }
    return null;
  });
  const Screen = $derived(match ? (match.def.component ?? loaded.get(match.def)) : undefined);
  const screenKey = $derived(match ? (match.def.group ?? router.route.path) : '');

  // Language and theme follow the stored preferences.
  $effect(() => {
    if (!prefs.value) return;
    const locale = prefs.value.locale ?? detectLocale();
    cacheLocale(locale);
    if (locale !== i18n.locale) setLocale(locale).catch((error: unknown) => console.error(error));
    applyAppearance(prefs.value.theme, prefs.value.accent);
    applySystemBars(prefs.value.theme).catch((error: unknown) => console.warn(error));
  });

  // Lazy screens.
  $effect(() => {
    const def = match?.def;
    if (!def?.load || loaded.has(def)) return;
    def.load().then(
      (module) => loaded.set(def, module.default),
      (error: unknown) => showError(error, t('common.error')),
    );
  });

  // Unknown routes go home; without a profile, onboarding comes first.
  $effect(() => {
    if (boot !== 'ready' || profile.loading) return;
    const path = router.route.path;
    if (!match) navigate('/', { replace: true });
    else if (!profile.value && path !== WELCOME_PATH) navigate(WELCOME_PATH, { replace: true });
    else if (profile.value && path === WELCOME_PATH) navigate('/', { replace: true });
  });

  $effect(() => {
    if (boot === 'ready' && profile.value) markFirstUse().catch(() => {});
  });

  async function start() {
    if (typeof indexedDB === 'undefined') {
      boot = 'no-storage';
      return;
    }
    try {
      await getDb();
      await ensureBaseCatalog();
      const recovered = await startNativeServices();
      boot = 'ready';
      // The full food catalog installs in the background; search works meanwhile.
      ensureDefaultPacks(document.baseURI).catch((error: unknown) =>
        console.warn('Default catalogs not installed yet', error),
      );
      if (recovered) showToast(t('native.recovered'), { duration: 8000 });
    } catch (error) {
      console.error(error);
      const name = (error as { name?: string } | null)?.name;
      boot =
        name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError'
          ? 'no-storage'
          : 'error';
    }
  }

  onMount(() => {
    const stopRouter = initRouter();
    const stopClock = startClock();
    initInstallPrompt();
    setDatabaseHandlers({
      versionChange: () => (boot = 'stale'),
      blocked: () => showToast(t('error.blocked'), { tone: 'error', duration: 10_000 }),
    });
    const onRejection = (event: PromiseRejectionEvent) => {
      const quota = (event.reason as { name?: string } | null)?.name === 'QuotaExceededError';
      showError(event.reason, t(quota ? 'error.quota' : 'common.error'));
    };
    window.addEventListener('unhandledrejection', onRejection);
    start();
    registerServiceWorker().catch((error: unknown) =>
      console.warn('Service worker not registered', error),
    );
    return () => {
      stopRouter();
      stopClock();
      window.removeEventListener('unhandledrejection', onRejection);
    };
  });
</script>

{#if boot === 'loading'}
  <div class="splash" aria-busy="true"></div>
{:else if boot !== 'ready'}
  <main class="fatal">
    <Icon name="alert" size={32} />
    <h1>{boot === 'stale' ? t('error.versionChange') : t('error.title')}</h1>
    {#if boot === 'no-storage'}<p class="muted">{t('error.noStorage')}</p>{/if}
    {#if boot === 'error'}<p class="muted">{t('common.error')}</p>{/if}
    <button class="btn btn-primary" type="button" onclick={() => location.reload()}
      >{t('common.reload')}</button
    >
  </main>
{:else}
  <div class="app" class:bare={match?.def.bare}>
    {#if !match?.def.bare}
      <AppNav active={match?.def.nav ?? null} />
    {/if}
    {#if pwa.updateAvailable}
      <div class="update" role="status">
        <Icon name="refresh" size={18} />
        <span>{t('settings.update')}</span>
        <button class="btn btn-sm btn-primary" type="button" onclick={applyUpdate}
          >{t('settings.updateNow')}</button
        >
      </div>
    {/if}
    <main class="content">
      {#if match && Screen && !profile.loading && !prefs.loading}
        {#key screenKey}
          <Screen params={match.params} query={router.route.query} />
        {/key}
      {/if}
    </main>
  </div>
  <Toasts />
  <DialogHost />
{/if}

<style>
  .splash {
    min-height: 100dvh;
  }

  .fatal {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    min-height: 100dvh;
    max-width: 420px;
    margin: 0 auto;
    padding: var(--space-5);
    text-align: center;
  }

  .update {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: var(--content-width);
    margin: var(--space-2) auto 0;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--accent-soft);
    font-size: 0.9375rem;
  }

  .update span {
    flex: 1;
  }

  @media (min-width: 900px) {
    .app:not(.bare) {
      padding-left: 232px;
    }
  }
</style>
