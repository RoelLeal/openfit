<script lang="ts">
  import { entryMacros, sumMacros } from '../core/nutrition.ts';
  import { displayName } from '../core/search.ts';
  import type { Entry } from '../core/types.ts';
  import { fmtGrams, fmtKcal, fmtQuantity, i18n, mealLabel, t } from '../i18n/index.svelte.ts';
  import Icon from './Icon.svelte';

  let {
    meal,
    entries,
    onadd,
    onedit,
    onsaveasmeal,
  }: {
    meal: string;
    entries: Entry[];
    onadd: () => void;
    onedit: (entry: Entry) => void;
    onsaveasmeal: () => void;
  } = $props();

  const rows = $derived(entries.map((entry) => ({ entry, macros: entryMacros(entry) })));
  const total = $derived(sumMacros(rows.map((row) => row.macros)));
  const label = $derived(mealLabel(meal));
  const headingId = `meal-${Math.random().toString(36).slice(2)}`;
</script>

<section class="meal" aria-labelledby={headingId}>
  <header>
    <h2 id={headingId}>{label}</h2>
    {#if entries.length > 0}
      <span class="kcal num">{fmtKcal(total.kcal)} kcal</span>
    {/if}
    <span class="spacer"></span>
    <button
      class="icon-btn accent"
      type="button"
      onclick={onadd}
      aria-label={t('diary.addTo', { meal: label })}
    >
      <Icon name="plus" />
    </button>
  </header>

  {#if rows.length === 0}
    <p class="empty subtle small">{t('diary.empty')}</p>
  {:else}
    <ul class="list">
      {#each rows as { entry, macros } (entry.id)}
        <li>
          <button class="list-item" type="button" onclick={() => onedit(entry)}>
            <span class="main">
              <span class="title">{displayName(entry.food, i18n.locale)}</span>
              <span class="meta">
                {fmtQuantity(entry.amount, entry.unit)}
                <span class="macros num" aria-hidden="true">
                  · {t('macro.short.protein')}
                  {fmtGrams(macros.protein)} · {t('macro.short.carbs')}
                  {fmtGrams(macros.carbs)} · {t('macro.short.fat')}
                  {fmtGrams(macros.fat)}
                </span>
                <span class="visually-hidden">
                  {t('macro.protein')}
                  {fmtGrams(macros.protein)} g, {t('macro.carbs')}
                  {fmtGrams(macros.carbs)} g, {t('macro.fat')}
                  {fmtGrams(macros.fat)} g
                </span>
              </span>
            </span>
            <span class="entry-kcal num"
              >{fmtKcal(macros.kcal)}&nbsp;<span class="unit">kcal</span></span
            >
          </button>
        </li>
      {/each}
    </ul>
    <button class="btn btn-ghost btn-sm save-meal" type="button" onclick={onsaveasmeal}>
      <Icon name="meal" size={16} />
      {t('diary.saveAsMeal')}
      <span class="visually-hidden">({label})</span>
    </button>
  {/if}
</section>

<style>
  .meal {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding-left: var(--space-1);
  }

  h2 {
    font-size: 1.0625rem;
  }

  .kcal {
    margin-left: var(--space-2);
    color: var(--text-2);
    font-size: 0.9375rem;
  }

  .empty {
    padding: 0 var(--space-1) var(--space-2);
  }

  .save-meal {
    align-self: flex-start;
    color: var(--text-2);
  }

  .entry-kcal {
    font-weight: 600;
    white-space: nowrap;
  }

  .unit {
    font-weight: 400;
    color: var(--text-2);
    font-size: 0.8125rem;
  }
</style>
