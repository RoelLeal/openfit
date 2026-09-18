<script lang="ts" module>
  import type { MealItem as DraftItem } from '../core/types.ts';

  /** Unsaved edits kept while the user leaves to create a new food. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain cache, not reactive state
  const drafts = new Map<string, { name: string; items: DraftItem[] }>();
</script>

<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import FoodSearch from '../components/FoodSearch.svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import QuantitySheet, { type QuantityResult } from '../components/QuantitySheet.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { entryMacros, sumMacros, toFoodFacts } from '../core/nutrition.ts';
  import { displayName } from '../core/search.ts';
  import type { AnyFood, MealItem } from '../core/types.ts';
  import { defaultQuantity } from '../core/units.ts';
  import type { RecentFood } from '../db/repos/entries.ts';
  import { findFood } from '../db/repos/foods.ts';
  import { deleteMeal, getMeal, restoreMeal, saveMeal } from '../db/repos/meals.ts';
  import { fmtGrams, fmtKcal, fmtQuantity, i18n, t } from '../i18n/index.svelte.ts';
  import type { ScreenProps } from '../routes.ts';
  import { confirmAction } from '../state/dialogs.svelte.ts';
  import { takeHandedOffFood } from '../state/handoff.ts';
  import { goBack, href, navigate } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let { params }: ScreenProps = $props();

  const id = $derived(params.id);
  let loaded = $state(untrack(() => !params.id));
  let name = $state('');
  let items = $state<MealItem[]>([]);
  let busy = $state(false);

  let pickerOpen = $state(false);
  let quantityOpen = $state(false);
  /** Item being added (index -1) or edited. */
  let current = $state<{ index: number; item: MealItem } | null>(null);

  const draftKey = untrack(() => params.id ?? 'new');
  let keepDraft = false;

  onMount(async () => {
    const draft = drafts.get(draftKey);
    drafts.delete(draftKey);
    if (draft) {
      name = draft.name;
      items = draft.items;
    } else if (params.id) {
      const meal = await getMeal(params.id);
      if (!meal) {
        goBack('/library?tab=meals');
        return;
      }
      name = meal.name;
      items = meal.items;
    }
    loaded = true;
    // A food created from the picker comes back through the handoff.
    const handedOff = takeHandedOffFood();
    const food = handedOff ? await findFood(handedOff) : null;
    if (food) pick(food);
  });

  onDestroy(() => {
    if (keepDraft) drafts.set(draftKey, { name, items: $state.snapshot(items) });
  });

  function createFood(query: string) {
    keepDraft = true;
    navigate(href('/foods/new', { name: query || undefined, then: 'meal' }));
  }

  const rows = $derived(items.map((item) => ({ item, macros: entryMacros(item) })));
  const total = $derived(sumMacros(rows.map((row) => row.macros)));
  const valid = $derived(name.trim() !== '' && items.length > 0);

  function pick(food: AnyFood | RecentFood) {
    pickerOpen = false;
    const item: MealItem =
      'foodId' in food
        ? { foodId: food.foodId, food: food.food, amount: food.amount, unit: food.unit }
        : { foodId: food.id, food: toFoodFacts(food), ...defaultQuantity(food) };
    current = { index: -1, item };
    quantityOpen = true;
  }

  function editItem(index: number) {
    const item = items[index];
    if (!item) return;
    current = { index, item };
    quantityOpen = true;
  }

  function applyQuantity({ amount, unit }: QuantityResult) {
    if (!current) return;
    const item = { ...current.item, amount, unit };
    items =
      current.index < 0
        ? [...items, item]
        : items.map((it, i) => (i === current!.index ? item : it));
  }

  function removeCurrent() {
    if (!current || current.index < 0) return;
    const index = current.index;
    items = items.filter((_, i) => i !== index);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    busy = true;
    try {
      await saveMeal({ id, name, items: $state.snapshot(items) });
      showToast(t('mealEditor.saved'));
      goBack('/library?tab=meals');
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!id) return;
    const confirmed = await confirmAction({
      title: t('common.delete'),
      message: t('mealEditor.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    const mealId = id;
    await deleteMeal(mealId);
    showToast(t('mealEditor.deleted'), {
      action: { label: t('common.undo'), run: () => restoreMeal(mealId) },
    });
    goBack('/library?tab=meals');
  }
</script>

<PageHeader title={id ? t('mealEditor.edit') : t('mealEditor.new')} back="/library?tab=meals">
  {#snippet actions()}
    {#if id}
      <button class="icon-btn" type="button" onclick={remove} aria-label={t('common.delete')}>
        <Icon name="trash" />
      </button>
    {/if}
  {/snippet}
</PageHeader>

{#if loaded}
  <form class="stack-lg" onsubmit={save}>
    <label class="field">
      <span class="label">{t('mealEditor.name')}</span>
      <input
        class="input"
        bind:value={name}
        placeholder={t('mealEditor.namePlaceholder')}
        required
        maxlength="200"
      />
    </label>

    <section class="stack">
      <div class="row">
        <h2>{t('mealEditor.items')}</h2>
        <span class="spacer"></span>
        {#if items.length > 0}
          <span class="muted num">{t('mealEditor.total')}: {fmtKcal(total.kcal)} kcal</span>
        {/if}
      </div>

      {#if rows.length > 0}
        <ul class="list">
          {#each rows as { item, macros }, index (index)}
            <li>
              <button class="list-item" type="button" onclick={() => editItem(index)}>
                <span class="main">
                  <span class="title">{displayName(item.food, i18n.locale)}</span>
                  <span class="meta">
                    {fmtQuantity(item.amount, item.unit)} · {t('macro.short.protein')}
                    {fmtGrams(macros.protein)} ·
                    {t('macro.short.carbs')}
                    {fmtGrams(macros.carbs)} · {t('macro.short.fat')}
                    {fmtGrams(macros.fat)}
                  </span>
                </span>
                <span class="num">{fmtKcal(macros.kcal)} kcal</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <EmptyState icon="meal" message={t('mealEditor.noItems')} />
      {/if}

      <button class="btn" type="button" onclick={() => (pickerOpen = true)}>
        <Icon name="plus" size={18} />
        {t('mealEditor.addItem')}
      </button>
    </section>

    <button class="btn btn-primary btn-block" type="submit" disabled={!valid || busy}>
      {t('common.save')}
    </button>
  </form>
{/if}

<Sheet bind:open={pickerOpen} title={t('mealEditor.addItem')}>
  <FoodSearch showMeals={false} autofocus onpick={pick} oncreate={createFood} />
</Sheet>

<QuantitySheet
  bind:open={quantityOpen}
  food={current?.item.food ?? null}
  amount={current?.item.amount ?? 1}
  unit={current?.item.unit ?? 'g'}
  showMeal={false}
  submitLabel={current && current.index >= 0 ? t('common.save') : t('common.add')}
  onsubmit={applyQuantity}
  ondelete={current && current.index >= 0 ? removeCurrent : undefined}
/>
