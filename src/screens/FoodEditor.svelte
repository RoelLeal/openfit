<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import NumberField from '../components/NumberField.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { kcalFromMacros } from '../core/nutrition.ts';
  import type { BaseUnit } from '../core/types.ts';
  import {
    deleteCustomFood,
    getCustomFood,
    restoreCustomFood,
    saveCustomFood,
  } from '../db/repos/foods.ts';
  import { fmtKcal, t, unitLabel } from '../i18n/index.svelte.ts';
  import type { ScreenProps } from '../routes.ts';
  import { confirmAction } from '../state/dialogs.svelte.ts';
  import { handOffFood } from '../state/handoff.ts';
  import { goBack, href } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let { params, query }: ScreenProps = $props();

  const id = $derived(params.id);
  // The screen is re-created when the path changes, so reading the initial params is enough.
  let loaded = $state(untrack(() => !params.id));

  let name = $state(untrack(() => query.get('name') ?? ''));
  let brand = $state('');
  let baseAmount = $state<number | null>(100);
  let baseUnit = $state<BaseUnit>('g');
  let kcal = $state<number | null>(null);
  let protein = $state<number | null>(null);
  let carbs = $state<number | null>(null);
  let fat = $state<number | null>(null);
  let unitSize = $state<number | null>(null);
  let servingSize = $state<number | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!params.id) return;
    const food = await getCustomFood(params.id);
    if (!food) {
      goBack('/library');
      return;
    }
    name = food.name;
    brand = food.brand ?? '';
    baseAmount = food.baseAmount;
    baseUnit = food.baseUnit;
    kcal = food.macros.kcal;
    protein = food.macros.protein;
    carbs = food.macros.carbs;
    fat = food.macros.fat;
    unitSize = food.unitSize ?? null;
    servingSize = food.servingSize ?? null;
    loaded = true;
  });

  const units = $derived([
    { value: 'g' as const, label: t('unit.g') },
    { value: 'ml' as const, label: t('unit.ml') },
    { value: 'unit' as const, label: unitLabel('unit', 1) },
  ]);

  const macroKcal = $derived(
    kcalFromMacros({ protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 }),
  );
  const sizeUnit = $derived(baseUnit === 'unit' ? unitLabel('unit', 2) : t(`unit.${baseUnit}`));
  const positiveOrEmpty = (value: number | null) => value === null || value > 0;
  const valid = $derived(
    name.trim() !== '' &&
      baseAmount !== null &&
      baseAmount > 0 &&
      kcal !== null &&
      positiveOrEmpty(unitSize) &&
      positiveOrEmpty(servingSize),
  );

  function changeBaseUnit(next: BaseUnit) {
    if (next === baseUnit) return;
    if (next === 'unit') {
      baseAmount = 1;
      unitSize = null;
    } else if (baseUnit === 'unit') {
      baseAmount = 100;
      servingSize = null;
    }
    baseUnit = next;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || busy || baseAmount === null || kcal === null) return;
    busy = true;
    try {
      const food = await saveCustomFood({
        id,
        name,
        brand,
        baseAmount,
        baseUnit,
        macros: { kcal, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 },
        unitSize: baseUnit === 'unit' ? undefined : (unitSize ?? undefined),
        servingSize: servingSize ?? undefined,
      });
      showToast(t('food.saved'));
      const then = query.get('then');
      if (then) {
        // Return to the screen that asked for the food, which picks it up from the handoff.
        handOffFood(food.id);
        goBack(
          then === 'add'
            ? href('/add', {
                date: query.get('date') ?? undefined,
                meal: query.get('meal') ?? undefined,
              })
            : '/meals/new',
        );
      } else {
        goBack('/library');
      }
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
      message: t('food.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    await deleteCustomFood(id);
    const foodId = id;
    showToast(t('food.deleted'), {
      action: { label: t('common.undo'), run: () => restoreCustomFood(foodId) },
    });
    goBack('/library');
  }
</script>

<PageHeader title={id ? t('food.edit') : t('food.new')} back="/library">
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
    <div class="card stack">
      <label class="field">
        <span class="label">{t('food.name')}</span>
        <input class="input" bind:value={name} required maxlength="200" autocomplete="off" />
      </label>
      <label class="field">
        <span class="label"
          >{t('food.brand')} <span class="subtle">({t('common.optional')})</span></span
        >
        <input class="input" bind:value={brand} maxlength="200" autocomplete="off" />
      </label>
    </div>

    <div class="card stack">
      <h2 class="h">{t('food.nutritionPer')}</h2>
      <div class="grid-2">
        <NumberField
          label={t('food.baseAmount')}
          bind:value={baseAmount}
          required
          error={baseAmount !== null && baseAmount <= 0 ? t('common.mustBePositive') : null}
        />
        <div class="field">
          <span class="label">{t('food.baseUnit')}</span>
          <Segmented
            label={t('food.baseUnit')}
            options={units}
            bind:value={() => baseUnit, changeBaseUnit}
          />
        </div>
      </div>
      <NumberField label={t('food.kcal')} bind:value={kcal} required suffix="kcal" />
      <div class="grid-3">
        <NumberField label={t('food.protein')} bind:value={protein} placeholder="0" />
        <NumberField label={t('food.carbs')} bind:value={carbs} placeholder="0" />
        <NumberField label={t('food.fat')} bind:value={fat} placeholder="0" />
      </div>
      {#if macroKcal > 0}
        <p class="subtle small">{t('food.kcalFromMacros', { kcal: fmtKcal(macroKcal) })}</p>
      {/if}
    </div>

    <div class="card stack">
      <div>
        <h2 class="h">{t('food.sizes')}</h2>
        <p class="subtle small">{t('food.sizesHint')}</p>
      </div>
      <div class="grid-2">
        {#if baseUnit !== 'unit'}
          <NumberField
            label={t('food.unitSize', { unit: sizeUnit })}
            bind:value={unitSize}
            suffix={sizeUnit}
            error={positiveOrEmpty(unitSize) ? null : t('common.mustBePositive')}
          />
        {/if}
        <NumberField
          label={t('food.servingSize', { unit: sizeUnit })}
          bind:value={servingSize}
          suffix={baseUnit === 'unit' ? undefined : sizeUnit}
          error={positiveOrEmpty(servingSize) ? null : t('common.mustBePositive')}
        />
      </div>
    </div>

    <button class="btn btn-primary btn-block" type="submit" disabled={!valid || busy}>
      {t('common.save')}
    </button>
  </form>
{/if}

<style>
  .h {
    font-size: 1rem;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    align-items: end;
  }
</style>
