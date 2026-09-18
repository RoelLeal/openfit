<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import { APP_NAME, APP_VERSION, REPOSITORY_URL } from '../config.ts';
  import { listInstalledPacks, type InstalledPack } from '../db/repos/catalog.ts';
  import { t } from '../i18n/index.svelte.ts';
  import { live } from '../state/live.svelte.ts';

  const packs = live(listInstalledPacks, [] as InstalledPack[]);
  const attributions = $derived([...new Set(packs.value.map((pack) => pack.attribution))]);
</script>

<PageHeader title={t('about.title')} back="/settings" />

<div class="stack-lg">
  <div class="brand">
    <img src="./favicon.svg" alt="" width="56" height="56" />
    <div>
      <h2>{APP_NAME}</h2>
      <p class="muted small">{t('about.version', { version: APP_VERSION })}</p>
    </div>
  </div>

  <section class="card stack">
    <h2 class="row"><Icon name="shield" /> {t('about.privacyTitle')}</h2>
    <p>{t('about.privacy')}</p>
  </section>

  <section class="card stack">
    <h2 class="row"><Icon name="database" /> {t('about.dataTitle')}</h2>
    <p>{t('about.data')}</p>
    {#each attributions as attribution (attribution)}
      <p class="subtle small">{attribution}</p>
    {/each}
  </section>

  <section class="card stack">
    <h2 class="row"><Icon name="info" /> {t('about.licenseTitle')}</h2>
    <p>{t('about.license')}</p>
    {#if REPOSITORY_URL}
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">{REPOSITORY_URL}</a>
    {/if}
    <p class="subtle small">{t('about.medical')}</p>
  </section>
</div>

<style>
  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .brand img {
    border-radius: 14px;
  }

  h2.row :global(svg) {
    color: var(--text-2);
  }
</style>
