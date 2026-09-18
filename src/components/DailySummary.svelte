<script lang="ts">
  import type { Macros } from '../core/types.ts';
  import { fmtGrams, fmtKcal, t } from '../i18n/index.svelte.ts';
  import MacroBar from './MacroBar.svelte';

  let { total, goals }: { total: Macros; goals: Macros | null } = $props();

  const kcalGoal = $derived(goals?.kcal ?? 0);
  const left = $derived(kcalGoal - total.kcal);
  const ratio = $derived(kcalGoal > 0 ? total.kcal / kcalGoal : 0);
  const over = $derived(kcalGoal > 0 && Math.round(left) < 0);

  const macros = $derived([
    { key: 'protein', label: t('macro.protein'), color: 'var(--protein)' },
    { key: 'carbs', label: t('macro.carbs'), color: 'var(--carbs)' },
    { key: 'fat', label: t('macro.fat'), color: 'var(--fat)' },
  ] as const);
</script>

<section class="card summary" aria-label={t('macro.calories')}>
  <div class="calories">
    <div>
      <h2 class="label">{t('macro.calories')}</h2>
      <p class="hero">
        <span class="value">{fmtKcal(total.kcal)}</span>
        {#if kcalGoal > 0}
          <span class="goal">/ {fmtKcal(kcalGoal)} kcal</span>
        {:else}
          <span class="goal">kcal</span>
        {/if}
      </p>
    </div>
    <p class="status" class:over>
      {#if kcalGoal <= 0}
        {t('diary.noGoal')}
      {:else if over}
        {t('diary.over', { value: fmtKcal(-left) })}
      {:else}
        {t('diary.remaining', { value: fmtKcal(left) })}
      {/if}
    </p>
  </div>
  <div
    class="meter"
    class:over
    role="progressbar"
    aria-label={t('macro.calories')}
    aria-valuemin={0}
    aria-valuemax={Math.round(kcalGoal)}
    aria-valuenow={Math.round(total.kcal)}
    aria-valuetext={t('diary.consumed', { value: fmtKcal(total.kcal), goal: fmtKcal(kcalGoal) })}
  >
    <div class="fill" style:width="{Math.min(ratio, 1) * 100}%"></div>
  </div>

  <div class="macros">
    {#each macros as macro (macro.key)}
      <MacroBar
        label={macro.label}
        color={macro.color}
        value={total[macro.key]}
        goal={goals?.[macro.key] ?? 0}
        valueText={t('diary.macroValue', {
          value: fmtGrams(total[macro.key]),
          goal: fmtGrams(goals?.[macro.key] ?? 0),
        })}
      />
    {/each}
  </div>
</section>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .calories {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 560;
    color: var(--text-2);
  }

  .hero {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .value {
    font-size: 2.5rem;
    font-weight: 680;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .goal {
    color: var(--text-2);
    font-weight: 520;
  }

  .status {
    font-size: 0.9375rem;
    color: var(--text-2);
    padding-bottom: 4px;
  }

  .status.over {
    color: var(--text);
    font-weight: 600;
  }

  .meter {
    height: 12px;
    border-radius: 999px;
    background: var(--accent-soft);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 0.25s ease-out;
  }

  .meter.over {
    background: color-mix(in oklab, var(--over) 20%, var(--surface));
  }

  .meter.over .fill {
    background: var(--over);
  }

  .macros {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  @media (min-width: 480px) {
    .macros {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
