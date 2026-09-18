<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import { BASE_PACK_ID, type PackListing } from '../catalog/packs.ts';
  import {
    downloadAndInstallPack,
    fetchAvailablePacks,
    listInstalledPacks,
    removePack,
    type InstalledPack,
  } from '../db/repos/catalog.ts';
  import { fmtBytes, hasMessage, t, tp } from '../i18n/index.svelte.ts';
  import { confirmAction } from '../state/dialogs.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  const installed = live(listInstalledPacks, [] as InstalledPack[]);
  let available = $state<PackListing[] | null>(null);
  let loadFailed = $state(false);
  let downloading = $state<string | null>(null);

  const installedVersions = $derived(
    new Map(installed.value.map((pack) => [pack.id, pack.version])),
  );
  // Packs not installed yet, or whose bundled version is newer than the installed one.
  const pending = $derived(
    (available ?? []).filter((listing) => installedVersions.get(listing.id) !== listing.version),
  );

  onMount(loadAvailable);

  async function loadAvailable() {
    loadFailed = false;
    try {
      available = await fetchAvailablePacks(document.baseURI);
    } catch (error) {
      console.warn(error);
      loadFailed = true;
    }
  }

  function describe(listing: PackListing): string {
    const key = `catalogs.description.${listing.id}`;
    return hasMessage(key) ? t(key) : listing.description;
  }

  async function download(listing: PackListing) {
    downloading = listing.id;
    try {
      const pack = await downloadAndInstallPack(document.baseURI, listing);
      showToast(t('catalogs.installedToast', { name: pack.name }));
    } catch (error) {
      const quota = (error as { name?: string } | null)?.name === 'QuotaExceededError';
      showError(error, quota ? t('error.quota') : t('catalogs.failed'));
    } finally {
      downloading = null;
    }
  }

  async function remove(pack: InstalledPack) {
    const confirmed = await confirmAction({
      title: t('catalogs.remove'),
      message: t('catalogs.removeConfirm', { name: pack.name }),
      confirmLabel: t('catalogs.remove'),
      danger: true,
    });
    if (!confirmed) return;
    await removePack(pack.id).catch((error: unknown) => showError(error, t('common.error')));
  }
</script>

<PageHeader title={t('catalogs.title')} back="/settings" />

<div class="stack-lg">
  <p class="muted">{t('catalogs.intro')}</p>

  <section class="stack">
    <h2 class="section-title">{t('catalogs.installed')}</h2>
    <ul class="list">
      {#each installed.value as pack (pack.id)}
        <li class="list-item">
          <Icon name="database" />
          <span class="main">
            <span class="title">
              {pack.name}
              {#if pack.id === BASE_PACK_ID}<span class="badge">{t('catalogs.included')}</span>{/if}
            </span>
            <span class="meta">
              {tp('catalogs.foods', pack.foods)} · {t('catalogs.license', {
                license: pack.license,
              })}
            </span>
          </span>
          {#if pack.id !== BASE_PACK_ID}
            <button class="btn btn-sm btn-danger" type="button" onclick={() => remove(pack)}>
              {t('catalogs.remove')}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <p class="subtle tiny">{t('catalogs.englishOnly')}</p>

  {#if loadFailed || pending.length > 0}
    <section class="stack">
      <h2 class="section-title">{t('catalogs.available')}</h2>
      {#if loadFailed}
        <div class="notice">
          <Icon name="alert" />
          <div class="stack">
            <p>{t('catalogs.offline')}</p>
            <button class="btn btn-sm" type="button" onclick={loadAvailable}
              >{t('common.retry')}</button
            >
          </div>
        </div>
      {:else}
        <ul class="list">
          {#each pending as listing (listing.id)}
            <li class="list-item">
              <span class="main">
                <span class="title">{listing.name}</span>
                <span class="meta">{describe(listing)}</span>
                <span class="meta">
                  {tp('catalogs.foods', listing.foods)} · {t('catalogs.license', {
                    license: listing.license,
                  })}
                </span>
              </span>
              <button
                class="btn btn-sm btn-primary"
                type="button"
                onclick={() => download(listing)}
                disabled={downloading !== null}
              >
                {downloading === listing.id
                  ? t('catalogs.downloading')
                  : t('catalogs.install', { size: fmtBytes(listing.bytes) })}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>
