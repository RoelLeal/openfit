<script lang="ts">
  import Icon, { type IconName } from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { APP_VERSION } from '../config.ts';
  import {
    ACCENTS,
    WEIGHT_UNITS,
    type Accent,
    type Locale,
    type Prefs,
    type Theme,
    type WeightUnit,
  } from '../core/types.ts';
  import { getPrefs, savePrefs } from '../db/repos/settings.ts';
  import { t, type MessageKey } from '../i18n/index.svelte.ts';
  import { applyUpdate, promptInstall, pwa } from '../state/app.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import { showError } from '../state/toasts.svelte.ts';

  const prefs = live<Prefs | null>(getPrefs, null);

  const links: { href: string; icon: IconName; label: MessageKey }[] = [
    { href: '#/settings/profile', icon: 'user', label: 'settings.profile' },
    { href: '#/settings/goals', icon: 'target', label: 'settings.goals' },
    { href: '#/settings/data', icon: 'download', label: 'settings.data' },
    { href: '#/settings/catalogs', icon: 'database', label: 'settings.catalogs' },
    { href: '#/settings/about', icon: 'shield', label: 'settings.about' },
  ];

  type LocaleChoice = Locale | 'auto';
  const localeOptions = $derived([
    { value: 'auto' as const, label: t('settings.languageAuto') },
    { value: 'es' as const, label: 'Español' },
    { value: 'en' as const, label: 'English' },
  ]);
  const themeOptions = $derived([
    { value: 'system' as const, label: t('settings.theme.system') },
    { value: 'light' as const, label: t('settings.theme.light') },
    { value: 'dark' as const, label: t('settings.theme.dark') },
  ]);

  const unitOptions = $derived(
    WEIGHT_UNITS.map((value) => ({ value, label: t(`weightUnit.${value}`) })),
  );

  function update(patch: Partial<Pick<Prefs, 'locale' | 'theme' | 'accent' | 'weightUnit'>>) {
    savePrefs(patch).catch((error: unknown) => showError(error, t('common.error')));
  }
</script>

<PageHeader title={t('settings.title')} />

<div class="stack-lg">
  {#if pwa.updateAvailable}
    <div class="notice">
      <Icon name="refresh" />
      <span class="spacer">{t('settings.update')}</span>
      <button class="btn btn-sm btn-primary" type="button" onclick={applyUpdate}
        >{t('settings.updateNow')}</button
      >
    </div>
  {/if}

  <ul class="list">
    {#each links as link (link.href)}
      <li>
        <a class="list-item" href={link.href}>
          <Icon name={link.icon} />
          <span class="main"><span class="title">{t(link.label)}</span></span>
          <Icon name="forward" size={18} />
        </a>
      </li>
    {/each}
  </ul>

  {#if prefs.value}
    {@const current = prefs.value}
    <section class="card stack">
      <h2>{t('settings.preferences')}</h2>
      <div class="field">
        <span class="label">{t('settings.language')}</span>
        <Segmented
          label={t('settings.language')}
          options={localeOptions}
          bind:value={
            () => (current.locale ?? 'auto') as LocaleChoice,
            (value) => update({ locale: value === 'auto' ? null : value })
          }
          size="sm"
        />
      </div>
      <div class="field">
        <span class="label">{t('settings.theme')}</span>
        <Segmented
          label={t('settings.theme')}
          options={themeOptions}
          bind:value={() => current.theme, (value: Theme) => update({ theme: value })}
          size="sm"
        />
      </div>
      <fieldset class="accents">
        <legend class="label">{t('settings.accent')}</legend>
        <div class="swatches">
          {#each ACCENTS as accent (accent)}
            <label class="swatch" data-accent={accent} title={t(`accent.${accent}`)}>
              <input
                type="radio"
                name="accent"
                value={accent}
                checked={current.accent === accent}
                onchange={() => update({ accent: accent as Accent })}
              />
              <span class="color" aria-hidden="true"></span>
              <span class="visually-hidden">{t(`accent.${accent}`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="field">
        <span class="label">{t('settings.weightUnit')}</span>
        <Segmented
          label={t('settings.weightUnit')}
          options={unitOptions}
          bind:value={
            () => current.weightUnit, (value: WeightUnit) => update({ weightUnit: value })
          }
          size="sm"
        />
      </div>
    </section>
  {/if}

  {#if !pwa.native}
    <section class="card stack">
      <div class="row">
        <Icon name="phone" />
        <h2>{t('settings.install')}</h2>
      </div>
      {#if pwa.installed}
        <p class="muted small">{t('settings.installed')}</p>
      {:else}
        <p class="muted small">{t('settings.installHint')}</p>
        {#if pwa.canInstall}
          <button class="btn btn-primary" type="button" onclick={promptInstall}
            >{t('settings.install')}</button
          >
        {:else if pwa.isIos}
          <p class="small">{t('settings.installIos')}</p>
        {/if}
      {/if}
    </section>
  {/if}

  <p class="subtle tiny version">OpenFit · {t('about.version', { version: APP_VERSION })}</p>
</div>

<style>
  .accents {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .swatch {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
  }

  .swatch input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* Each swatch shows its own accent by scoping the same variables the app uses. */
  .swatch .color {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: inset 0 0 0 3px var(--surface);
  }

  .swatch:has(input:checked) .color {
    box-shadow:
      inset 0 0 0 3px var(--surface),
      0 0 0 2px var(--accent);
  }

  .swatch:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .version {
    text-align: center;
  }

  .row :global(svg) {
    color: var(--text-2);
  }
</style>
