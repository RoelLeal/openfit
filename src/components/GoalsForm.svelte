<script lang="ts">
  import type { GoalSuggestion } from '../core/goals.ts';
  import { kcalFromMacros } from '../core/nutrition.ts';
  import { fmtKcal, t } from '../i18n/index.svelte.ts';
  import type { GoalsDraft } from '../state/profile.ts';
  import Icon from './Icon.svelte';
  import NumberField from './NumberField.svelte';

  let {
    goals = $bindable(),
    suggestion,
    showSuggestButton = true,
  }: {
    goals: GoalsDraft;
    suggestion: GoalSuggestion | null;
    showSuggestButton?: boolean;
  } = $props();

  const macroKcal = $derived(
    kcalFromMacros({ protein: goals.protein ?? 0, carbs: goals.carbs ?? 0, fat: goals.fat ?? 0 }),
  );
  const mismatch = $derived(
    goals.kcal !== null && goals.kcal > 0 && Math.abs(macroKcal - goals.kcal) > goals.kcal * 0.05,
  );
  const nonNegative = (value: number | null) => (value === null ? t('common.required') : null);

  function applySuggestion() {
    if (suggestion) goals = { ...suggestion.goals };
  }
</script>

<div class="stack">
  {#if showSuggestButton}
    <button class="btn" type="button" onclick={applySuggestion} disabled={!suggestion}>
      <Icon name="target" size={18} />
      {t('goals.suggest')}
    </button>
    {#if !suggestion}
      <p class="subtle small">{t('goals.needProfile')}</p>
    {/if}
  {/if}
  {#if suggestion}
    <p class="notice small">
      {t('goals.suggestion', {
        bmr: fmtKcal(suggestion.bmr),
        tdee: fmtKcal(suggestion.tdee),
        direction: t(`goals.direction.${suggestion.direction}`),
      })}
    </p>
  {/if}

  <NumberField
    label={t('macro.calories')}
    bind:value={goals.kcal}
    suffix="kcal"
    required
    error={nonNegative(goals.kcal)}
  />
  <div class="grid-3">
    <NumberField
      label={t('macro.protein')}
      bind:value={goals.protein}
      suffix="g"
      required
      error={nonNegative(goals.protein)}
    />
    <NumberField
      label={t('macro.carbs')}
      bind:value={goals.carbs}
      suffix="g"
      required
      error={nonNegative(goals.carbs)}
    />
    <NumberField
      label={t('macro.fat')}
      bind:value={goals.fat}
      suffix="g"
      required
      error={nonNegative(goals.fat)}
    />
  </div>
  <p class="small" class:muted={!mismatch}>
    {t('goals.macroKcal', { kcal: fmtKcal(macroKcal) })}
  </p>
  <p class="subtle tiny">{t('goals.disclaimer')}</p>
</div>

<style>
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    align-items: end;
  }
</style>
