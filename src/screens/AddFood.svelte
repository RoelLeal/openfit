<script lang="ts">
  import { onMount } from 'svelte';
  import FoodSearch from '../components/FoodSearch.svelte';
  import MealLogSheet from '../components/MealLogSheet.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import QuantitySheet, { type QuantityResult } from '../components/QuantitySheet.svelte';
  import { isDayKey } from '../core/dates.ts';
  import { mealForHour } from '../core/meals.ts';
  import { toFoodFacts } from '../core/nutrition.ts';
  import { displayName } from '../core/search.ts';
  import type { AnyFood, FoodFacts, MealTemplate, Unit } from '../core/types.ts';
  import { defaultQuantity } from '../core/units.ts';
  import { addEntry, deleteEntry, type RecentFood } from '../db/repos/entries.ts';
  import { findFood } from '../db/repos/foods.ts';
  import { logMeal } from '../db/repos/meals.ts';
  import { fmtDayLabel, i18n, mealLabel, t, tp } from '../i18n/index.svelte.ts';
  import type { ScreenProps } from '../routes.ts';
  import { clock } from '../state/app.svelte.ts';
  import { takeHandedOffFood } from '../state/handoff.ts';
  import { goBack, href, navigate } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let { query }: ScreenProps = $props();

  const date = $derived.by(() => {
    const value = query.get('date');
    return value && isDayKey(value) ? value : clock.today;
  });
  const meal = $derived(query.get('meal') || mealForHour(new Date().getHours()));
  const diaryPath = $derived(date === clock.today ? '/' : `/day/${date}`);

  interface Selection {
    foodId: string;
    food: FoodFacts;
    amount: number;
    unit: Unit;
  }

  let selection = $state.raw<Selection | null>(null);
  let quantityOpen = $state(false);
  let mealToLog = $state.raw<MealTemplate | null>(null);
  let mealOpen = $state(false);

  function select(item: AnyFood | RecentFood) {
    if ('foodId' in item) {
      selection = { foodId: item.foodId, food: item.food, amount: item.amount, unit: item.unit };
    } else {
      selection = { foodId: item.id, food: toFoodFacts(item), ...defaultQuantity(item) };
    }
    quantityOpen = true;
  }

  // A food just created from this screen opens straight in the quantity sheet.
  onMount(async () => {
    const id = takeHandedOffFood();
    const food = id ? await findFood(id) : null;
    if (food) select(food);
  });

  async function log(item: Selection, amount: number, unit: Unit, slot: string) {
    try {
      const entry = await addEntry({
        date,
        meal: slot,
        foodId: item.foodId,
        food: item.food,
        amount,
        unit,
      });
      showToast(t('diary.added', { food: displayName(item.food, i18n.locale) }), {
        action: { label: t('common.undo'), run: () => deleteEntry(entry.id) },
      });
      goBack(diaryPath);
    } catch (error) {
      showError(error, t('common.error'));
      throw error;
    }
  }

  function submit({ amount, unit, meal: slot }: QuantityResult) {
    if (!selection) return;
    return log(selection, amount, unit, slot);
  }

  function quickAdd(recent: RecentFood) {
    return log(recent, recent.amount, recent.unit, meal).catch(() => {});
  }

  function pickMeal(template: MealTemplate) {
    mealToLog = template;
    mealOpen = true;
  }

  async function submitMeal(slot: string) {
    if (!mealToLog) return;
    try {
      const entries = await logMeal(mealToLog, date, slot);
      showToast(tp('diary.addedMany', entries.length), {
        action: {
          label: t('common.undo'),
          run: async () => {
            for (const entry of entries) await deleteEntry(entry.id);
          },
        },
      });
      goBack(diaryPath);
    } catch (error) {
      showError(error, t('common.error'));
    }
  }

  function create(name: string) {
    navigate(href('/foods/new', { name: name || undefined, then: 'add', date, meal }));
  }
</script>

<PageHeader
  title={t('add.title')}
  subtitle="{mealLabel(meal)} · {fmtDayLabel(date, clock.today)}"
  back={diaryPath}
/>

<FoodSearch
  autofocus
  onpick={select}
  onquickadd={quickAdd}
  onpickmeal={pickMeal}
  oncreate={create}
  oncreatemeal={() => navigate('/meals/new')}
/>

<QuantitySheet
  bind:open={quantityOpen}
  food={selection?.food ?? null}
  amount={selection?.amount ?? 1}
  unit={selection?.unit ?? 'g'}
  {meal}
  submitLabel={t('common.add')}
  onsubmit={submit}
/>

<MealLogSheet bind:open={mealOpen} meal={mealToLog} slot={meal} onlog={submitMeal} />
