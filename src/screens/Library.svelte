<script lang="ts">
  import EmptyState from '../components/EmptyState.svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { entryMacros, sumMacros } from '../core/nutrition.ts';
  import type { CustomFood, MealTemplate } from '../core/types.ts';
  import { listCustomFoods } from '../db/repos/foods.ts';
  import { listMeals } from '../db/repos/meals.ts';
  import { fmtBase, fmtKcal, t, tp } from '../i18n/index.svelte.ts';
  import type { ScreenProps } from '../routes.ts';
  import { live } from '../state/live.svelte.ts';
  import { navigate } from '../state/router.svelte.ts';

  type Tab = 'foods' | 'meals';

  let { query }: ScreenProps = $props();

  const foods = live(listCustomFoods, [] as CustomFood[]);
  const meals = live(listMeals, [] as MealTemplate[]);
  const tab = $derived<Tab>(query.get('tab') === 'meals' ? 'meals' : 'foods');
  const tabs = $derived([
    { value: 'foods' as const, label: t('library.foods') },
    { value: 'meals' as const, label: t('library.meals') },
  ]);

  function setTab(next: Tab) {
    navigate(next === 'meals' ? '/library?tab=meals' : '/library', { replace: true });
  }

  function mealSummary(meal: MealTemplate): string {
    return tp('library.mealSummary', meal.items.length, {
      kcal: fmtKcal(sumMacros(meal.items.map(entryMacros)).kcal),
    });
  }
</script>

<PageHeader title={t('library.title')}>
  {#snippet actions()}
    <a class="btn btn-sm btn-primary" href={tab === 'meals' ? '#/meals/new' : '#/foods/new'}>
      <Icon name="plus" size={18} />
      {tab === 'meals' ? t('library.newMeal') : t('library.newFood')}
    </a>
  {/snippet}
</PageHeader>

<div class="stack">
  <Segmented label={t('library.title')} options={tabs} bind:value={() => tab, setTab} />

  {#if tab === 'foods'}
    {#if foods.value.length > 0}
      <ul class="list">
        {#each foods.value as food (food.id)}
          <li>
            <a class="list-item" href="#/foods/{food.id}">
              <span class="main">
                <span class="title">{food.name}</span>
                <span class="meta">
                  {[
                    food.brand,
                    t('macro.perBase', { kcal: fmtKcal(food.macros.kcal), base: fmtBase(food) }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Icon name="forward" size={18} />
            </a>
          </li>
        {/each}
      </ul>
    {:else if !foods.loading}
      <EmptyState icon="library" message={t('library.foodsEmpty')}>
        <a class="btn" href="#/foods/new">{t('library.newFood')}</a>
      </EmptyState>
    {/if}
  {:else if meals.value.length > 0}
    <ul class="list">
      {#each meals.value as meal (meal.id)}
        <li>
          <a class="list-item" href="#/meals/{meal.id}">
            <span class="main">
              <span class="title">{meal.name}</span>
              <span class="meta">{mealSummary(meal)}</span>
            </span>
            <Icon name="forward" size={18} />
          </a>
        </li>
      {/each}
    </ul>
  {:else if !meals.loading}
    <EmptyState icon="meal" message={t('library.mealsEmpty')}>
      <a class="btn" href="#/meals/new">{t('library.newMeal')}</a>
    </EmptyState>
  {/if}
</div>
