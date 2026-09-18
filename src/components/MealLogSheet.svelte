<script lang="ts">
  import { entryMacros, sumMacros } from '../core/nutrition.ts';
  import { displayName } from '../core/search.ts';
  import { MEAL_SLOTS, type MealTemplate } from '../core/types.ts';
  import { fmtKcal, fmtQuantity, i18n, mealLabel, t, tp } from '../i18n/index.svelte.ts';
  import Segmented from './Segmented.svelte';
  import Sheet from './Sheet.svelte';

  let {
    open = $bindable(false),
    meal,
    slot: initialSlot,
    onlog,
  }: {
    open?: boolean;
    meal: MealTemplate | null;
    slot: string;
    onlog: (slot: string) => Promise<void>;
  } = $props();

  let slot = $state('breakfast');
  let busy = $state(false);

  $effect(() => {
    if (open) {
      slot = initialSlot;
      busy = false;
    }
  });

  const rows = $derived(meal?.items.map((item) => ({ item, kcal: entryMacros(item).kcal })) ?? []);
  const total = $derived(sumMacros(meal?.items.map(entryMacros) ?? []));
  const options = $derived(MEAL_SLOTS.map((value) => ({ value, label: mealLabel(value) })));

  async function log() {
    if (busy) return;
    busy = true;
    try {
      await onlog(slot);
      open = false;
    } finally {
      busy = false;
    }
  }
</script>

<Sheet bind:open title={meal?.name ?? ''} subtitle="{fmtKcal(total.kcal)} kcal">
  <div class="stack">
    <ul class="list">
      {#each rows as { item, kcal }, i (i)}
        <li class="list-item">
          <span class="main">
            <span class="title">{displayName(item.food, i18n.locale)}</span>
            <span class="meta">{fmtQuantity(item.amount, item.unit)}</span>
          </span>
          <span class="num">{fmtKcal(kcal)} kcal</span>
        </li>
      {/each}
    </ul>
    <Segmented label={t('add.meal')} {options} bind:value={slot} size="sm" />
  </div>
  {#snippet footer()}
    <button
      class="btn btn-primary btn-block"
      type="button"
      onclick={log}
      disabled={busy || rows.length === 0}
    >
      {tp('add.logMeal', rows.length)}
    </button>
  {/snippet}
</Sheet>
