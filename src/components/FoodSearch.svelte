<script lang="ts">
  import { entryMacros, macrosFor, sumMacros, toFoodFacts } from '../core/nutrition.ts';
  import { displayName, searchFoods } from '../core/search.ts';
  import { BASE_PACK_ID } from '../catalog/packs.ts';
  import { isCustomFood, type AnyFood, type MealTemplate } from '../core/types.ts';
  import { recentFoods, type RecentFood } from '../db/repos/entries.ts';
  import { listCustomFoods, listSearchableFoods } from '../db/repos/foods.ts';
  import { listMeals } from '../db/repos/meals.ts';
  import { fmtBase, fmtKcal, fmtNumber, fmtQuantity, i18n, t, tp } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import EmptyState from './EmptyState.svelte';
  import Icon from './Icon.svelte';
  import Segmented from './Segmented.svelte';

  type Tab = 'recent' | 'custom' | 'meals';

  let {
    showMeals = true,
    autofocus = false,
    onpick,
    onquickadd,
    onpickmeal,
    oncreate,
    oncreatemeal,
  }: {
    showMeals?: boolean;
    autofocus?: boolean;
    onpick: (food: AnyFood | RecentFood) => void;
    /** Logs a recent food with its last quantity in one tap. */
    onquickadd?: (recent: RecentFood) => void;
    onpickmeal?: (meal: MealTemplate) => void;
    oncreate: (name: string) => void;
    oncreatemeal?: () => void;
  } = $props();

  let query = $state('');
  let tab = $state<Tab>('recent');
  let input: HTMLInputElement | undefined = $state();

  const recents = live(() => recentFoods({ today: clock.today }), [] as RecentFood[]);
  const custom = live(listCustomFoods, []);
  const meals = live(listMeals, [] as MealTemplate[]);
  const all = live(listSearchableFoods, [] as AnyFood[]);

  const recentIds = $derived(new Set(recents.value.map((r) => r.foodId)));
  const trimmed = $derived(query.trim());
  const results = $derived(
    trimmed
      ? searchFoods(all.value, trimmed, {
          locale: i18n.locale,
          limit: 60,
          // Recent and own foods first, then the curated base pack (short, translated names)
          // before the raw USDA rows, whose long names would otherwise score higher.
          boost: (food) =>
            (recentIds.has(food.id) ? 40 : 0) +
            (isCustomFood(food) ? 15 : 0) +
            (!isCustomFood(food) && food.pack === BASE_PACK_ID ? 100 : 0),
        })
      : [],
  );

  const tabs = $derived([
    { value: 'recent' as const, label: t('add.tab.recent') },
    { value: 'custom' as const, label: t('add.tab.custom') },
    ...(showMeals ? [{ value: 'meals' as const, label: t('add.tab.meals') }] : []),
  ]);

  $effect(() => {
    if (autofocus && input) input.focus();
  });

  /** Search results reuse the last quantity when the food was logged recently. */
  function pickFood(food: AnyFood) {
    const recent = recents.value.find((r) => r.foodId === food.id);
    onpick(recent ? { ...recent, food: toFoodFacts(food) } : food);
  }

  function describe(food: AnyFood): string {
    return [
      food.brand,
      t('macro.perBase', { kcal: fmtKcal(food.macros.kcal), base: fmtBase(food) }),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function recentMeta(recent: RecentFood): string {
    const kcal = macrosFor(recent.food, recent.amount, recent.unit)?.kcal ?? 0;
    return `${fmtQuantity(recent.amount, recent.unit)} · ${fmtKcal(kcal)} kcal`;
  }

  function mealMeta(meal: MealTemplate): string {
    const kcal = sumMacros(meal.items.map(entryMacros)).kcal;
    return tp('library.mealSummary', meal.items.length, { kcal: fmtKcal(kcal) });
  }
</script>

<div class="food-search stack">
  <div class="search">
    <Icon name="search" size={20} />
    <input
      bind:this={input}
      bind:value={query}
      class="input"
      type="search"
      placeholder={t('add.search')}
      aria-label={t('add.search')}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
    />
  </div>

  {#if trimmed}
    {#if results.length === 0 && !all.loading}
      <EmptyState icon="search" message={t('add.noResults', { query: trimmed })}>
        <button class="btn btn-primary" type="button" onclick={() => oncreate(trimmed)}>
          <Icon name="plus" size={18} />
          {t('add.createNamed', { query: trimmed })}
        </button>
      </EmptyState>
    {:else}
      <ul class="list" aria-label={t('add.search')}>
        {#each results as food (food.id)}
          <li>
            <button class="list-item" type="button" onclick={() => pickFood(food)}>
              <span class="main">
                <span class="title">
                  {displayName(food, i18n.locale)}
                  {#if isCustomFood(food)}<span class="badge">{t('add.custom')}</span>{/if}
                </span>
                <span class="meta">{describe(food)}</span>
              </span>
              <Icon name="forward" size={18} />
            </button>
          </li>
        {/each}
      </ul>
      <button class="btn btn-ghost create" type="button" onclick={() => oncreate(trimmed)}>
        <Icon name="plus" size={18} />
        {t('add.createNamed', { query: trimmed })}
      </button>
    {/if}
  {:else}
    <Segmented label={t('add.search')} options={tabs} bind:value={tab} size="sm" />

    {#if tab === 'recent'}
      {#if recents.value.length > 0}
        <ul class="list">
          {#each recents.value as recent (recent.foodId)}
            <li class="with-action">
              <button class="list-item" type="button" onclick={() => onpick(recent)}>
                <span class="main">
                  <span class="title">{displayName(recent.food, i18n.locale)}</span>
                  <span class="meta">{recentMeta(recent)}</span>
                </span>
              </button>
              {#if onquickadd}
                <button
                  class="icon-btn accent quick"
                  type="button"
                  onclick={() => onquickadd(recent)}
                  aria-label="{t('common.add')}: {displayName(
                    recent.food,
                    i18n.locale,
                  )}, {recentMeta(recent)}"
                >
                  <Icon name="plus" />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if !recents.loading}
        <EmptyState icon="diary" message={t('add.recentEmpty')}>
          {#if all.value.length > 0}
            <p class="subtle small">
              {t('add.searchHint', { count: fmtNumber(all.value.length) })}
            </p>
          {/if}
        </EmptyState>
      {/if}
    {:else if tab === 'custom'}
      {#if custom.value.length > 0}
        <ul class="list">
          {#each custom.value as food (food.id)}
            <li>
              <button class="list-item" type="button" onclick={() => pickFood(food)}>
                <span class="main">
                  <span class="title">{food.name}</span>
                  <span class="meta">{describe(food)}</span>
                </span>
                <Icon name="forward" size={18} />
              </button>
            </li>
          {/each}
        </ul>
      {:else if !custom.loading}
        <EmptyState icon="library" message={t('add.customEmpty')}>
          <button class="btn" type="button" onclick={() => oncreate('')}
            >{t('add.createFood')}</button
          >
        </EmptyState>
      {/if}
    {:else if tab === 'meals'}
      {#if meals.value.length > 0}
        <ul class="list">
          {#each meals.value as meal (meal.id)}
            <li>
              <button class="list-item" type="button" onclick={() => onpickmeal?.(meal)}>
                <span class="main">
                  <span class="title">{meal.name}</span>
                  <span class="meta">{mealMeta(meal)}</span>
                </span>
                <Icon name="forward" size={18} />
              </button>
            </li>
          {/each}
        </ul>
      {:else if !meals.loading}
        <EmptyState icon="meal" message={t('add.mealsEmpty')}>
          {#if oncreatemeal}
            <button class="btn" type="button" onclick={oncreatemeal}>{t('add.createMeal')}</button>
          {/if}
        </EmptyState>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .with-action {
    display: flex;
    align-items: center;
  }

  .with-action .list-item {
    flex: 1;
    min-width: 0;
  }

  .quick {
    margin-right: var(--space-2);
  }

  .create {
    align-self: flex-start;
  }
</style>
