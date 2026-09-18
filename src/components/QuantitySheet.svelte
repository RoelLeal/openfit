<script lang="ts">
  import { macrosFor } from '../core/nutrition.ts';
  import { displayName } from '../core/search.ts';
  import { MEAL_SLOTS, type FoodFacts, type Unit } from '../core/types.ts';
  import { allowedUnits, fromBaseAmount, toBaseAmount } from '../core/units.ts';
  import {
    fmtBase,
    fmtGrams,
    fmtKcal,
    fmtQuantity,
    i18n,
    mealLabel,
    t,
    unitLabel,
  } from '../i18n/index.svelte.ts';
  import NumberField from './NumberField.svelte';
  import Segmented from './Segmented.svelte';
  import Sheet from './Sheet.svelte';

  export interface QuantityResult {
    amount: number;
    unit: Unit;
    meal: string;
  }

  /** Amount + unit (+ meal) picker with a live macro preview. The heart of the logging flow. */
  let {
    open = $bindable(false),
    food,
    amount: initialAmount,
    unit: initialUnit,
    meal: initialMeal = 'breakfast',
    showMeal = true,
    submitLabel,
    onsubmit,
    ondelete,
  }: {
    open?: boolean;
    food: FoodFacts | null;
    amount: number;
    unit: Unit;
    meal?: string;
    showMeal?: boolean;
    submitLabel: string;
    onsubmit: (result: QuantityResult) => void | Promise<void>;
    ondelete?: () => void | Promise<void>;
  } = $props();

  let amount = $state<number | null>(null);
  let unit = $state<Unit>('g');
  let meal = $state('breakfast');
  let busy = $state(false);

  // Reset the form every time the sheet opens.
  $effect(() => {
    if (open && food) {
      amount = initialAmount;
      unit = allowedUnits(food).includes(initialUnit) ? initialUnit : allowedUnits(food)[0]!;
      meal = initialMeal;
      busy = false;
    }
  });

  const units = $derived(food ? allowedUnits(food) : []);
  const unitOptions = $derived(units.map((value) => ({ value, label: unitLabel(value, 2) })));
  const mealOptions = $derived(MEAL_SLOTS.map((value) => ({ value, label: mealLabel(value) })));
  const macros = $derived(food && amount !== null ? macrosFor(food, amount, unit) : null);
  const valid = $derived(macros !== null && amount !== null && amount > 0);

  const sizeHints = $derived.by(() => {
    if (!food) return [];
    const hints: string[] = [];
    if (food.baseUnit !== 'unit' && food.unitSize) {
      hints.push(t('add.unitSize', { size: fmtQuantity(food.unitSize, food.baseUnit) }));
    }
    if (food.servingSize) {
      hints.push(t('add.servingSize', { size: fmtQuantity(food.servingSize, food.baseUnit) }));
    }
    return hints;
  });

  /** Switching units keeps the same quantity of food (100 g → 2 units for a 50 g egg). */
  function changeUnit(next: Unit) {
    if (!food || next === unit) return;
    const base = amount !== null ? toBaseAmount(food, amount, unit) : null;
    const converted = base !== null && base > 0 ? fromBaseAmount(food, base, next) : null;
    amount =
      converted !== null && converted > 0 ? converted : next === 'g' || next === 'ml' ? 100 : 1;
    unit = next;
  }

  async function submit() {
    if (!valid || amount === null || busy) return;
    busy = true;
    try {
      await onsubmit({ amount, unit, meal });
      open = false;
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!ondelete || busy) return;
    busy = true;
    try {
      await ondelete();
      open = false;
    } finally {
      busy = false;
    }
  }
</script>

<Sheet
  bind:open
  title={food ? displayName(food, i18n.locale) : ''}
  subtitle={food
    ? [food.brand, t('macro.perBase', { kcal: fmtKcal(food.macros.kcal), base: fmtBase(food) })]
        .filter(Boolean)
        .join(' · ')
    : ''}
>
  {#if food}
    <form
      class="stack"
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <NumberField
        label={t('add.amount')}
        bind:value={amount}
        large
        autofocus
        required
        error={valid ? null : t('add.invalidAmount')}
        onenter={submit}
      />
      {#if units.length > 1}
        <Segmented
          label={t('add.unit')}
          options={unitOptions}
          bind:value={() => unit, changeUnit}
        />
      {/if}
      {#if sizeHints.length > 0}
        <p class="subtle tiny">{sizeHints.join(' · ')}</p>
      {/if}
      {#if showMeal}
        <Segmented label={t('add.meal')} options={mealOptions} bind:value={meal} size="sm" />
      {/if}

      <div class="preview" aria-live="polite">
        <div class="kcal">
          <span class="num">{macros ? fmtKcal(macros.kcal) : '–'}</span>
          <span class="muted">kcal</span>
        </div>
        <dl class="macros">
          <div>
            <dt><span class="dot" style:background="var(--protein)"></span>{t('macro.protein')}</dt>
            <dd class="num">{macros ? fmtGrams(macros.protein) : '–'} g</dd>
          </div>
          <div>
            <dt><span class="dot" style:background="var(--carbs)"></span>{t('macro.carbs')}</dt>
            <dd class="num">{macros ? fmtGrams(macros.carbs) : '–'} g</dd>
          </div>
          <div>
            <dt><span class="dot" style:background="var(--fat)"></span>{t('macro.fat')}</dt>
            <dd class="num">{macros ? fmtGrams(macros.fat) : '–'} g</dd>
          </div>
        </dl>
      </div>
      <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
    </form>
  {/if}

  {#snippet footer()}
    {#if ondelete}
      <button class="btn btn-danger" type="button" onclick={remove} disabled={busy}>
        {t('common.delete')}
      </button>
    {/if}
    <button
      class="btn btn-primary btn-block"
      type="button"
      onclick={submit}
      disabled={!valid || busy}
    >
      {submitLabel}
    </button>
  {/snippet}
</Sheet>

<style>
  .preview {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--surface-2);
  }

  .kcal {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 72px;
  }

  .kcal .num {
    font-size: 1.75rem;
    font-weight: 680;
    line-height: 1.1;
  }

  .macros {
    flex: 1;
    display: grid;
    gap: 2px;
    margin: 0;
  }

  .macros div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  dt {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
    font-size: 0.875rem;
  }

  dd {
    margin: 0;
    font-weight: 560;
    font-size: 0.875rem;
  }
</style>
