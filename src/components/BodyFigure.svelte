<script lang="ts">
  import { buildFigure, FIGURE_HEIGHT, FIGURE_WIDTH } from '../core/figure.ts';
  import type { Sex, WeightUnit } from '../core/types.ts';
  import { bmi } from '../core/weight.ts';
  import { fmtNumber, fmtWeight, t } from '../i18n/index.svelte.ts';

  /**
   * Silhouette of the person, sized by height and body mass. When a target weight is
   * given, its outline is drawn behind the current figure for comparison.
   */
  let {
    sex,
    heightCm,
    weightKg,
    targetWeightKg = null,
    weightUnit,
    compact = false,
  }: {
    sex: Sex;
    heightCm: number;
    weightKg: number;
    targetWeightKg?: number | null;
    weightUnit: WeightUnit;
    compact?: boolean;
  } = $props();

  const current = $derived(buildFigure({ sex, heightCm, weightKg }));
  const target = $derived(
    targetWeightKg && Math.abs(targetWeightKg - weightKg) >= 0.5
      ? buildFigure({ sex, heightCm, weightKg: targetWeightKg })
      : null,
  );
  const index = $derived(bmi(weightKg, heightCm));
  const label = $derived(
    t('body.figure', {
      sex: t(`profile.sex.${sex}`),
      height: fmtNumber(heightCm),
      weight: fmtWeight(weightKg, weightUnit),
    }),
  );
</script>

<figure class="body" class:compact>
  <svg viewBox="0 0 {FIGURE_WIDTH} {FIGURE_HEIGHT}" role="img" aria-label={label}>
    {#each [target, current] as figure, i (i)}
      {#if figure}
        <g class={i === 1 ? 'current' : 'target'}>
          {#each figure.legs as leg, j (j)}
            <line
              x1={leg.x1}
              y1={leg.y1}
              x2={leg.x2}
              y2={leg.y2}
              stroke-width={leg.width}
              stroke-linecap="round"
            />
          {/each}
          {#each figure.arms as arm, j (j)}
            <line
              x1={arm.x1}
              y1={arm.y1}
              x2={arm.x2}
              y2={arm.y2}
              stroke-width={arm.width}
              stroke-linecap="round"
            />
          {/each}
          <rect
            x={figure.neck.x}
            y={figure.neck.y}
            width={figure.neck.width}
            height={figure.neck.height}
            rx="4"
          />
          <path d={figure.torso} stroke-linejoin="round" />
          <circle cx={figure.head.cx} cy={figure.head.cy} r={figure.head.r} />
        </g>
      {/if}
    {/each}
  </svg>
  <figcaption class="stack">
    <span class="num strong">{fmtWeight(weightKg, weightUnit)}</span>
    <span class="subtle small">{t('body.height', { value: fmtNumber(heightCm) })}</span>
    {#if index}
      <span class="subtle small">{t('body.bmi', { value: fmtNumber(index, 1) })}</span>
    {/if}
    {#if target && targetWeightKg}
      <span class="subtle small target-note">
        <span class="swatch" aria-hidden="true"></span>
        {t('weight.target')}: {fmtWeight(targetWeightKg, weightUnit)}
      </span>
    {/if}
  </figcaption>
</figure>

<style>
  .body {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin: 0;
  }

  svg {
    flex: none;
    width: 120px;
    height: 240px;
  }

  .compact svg {
    width: 90px;
    height: 180px;
  }

  figcaption {
    gap: 2px;
  }

  .strong {
    font-size: 1.25rem;
    font-weight: 650;
  }

  .current {
    fill: var(--accent-soft);
    stroke: var(--accent);
    stroke-width: 3;
  }

  .current line {
    stroke: var(--accent);
    fill: none;
  }

  .target {
    fill: none;
    stroke: var(--text-3);
    stroke-width: 2;
    stroke-dasharray: 5 5;
  }

  .target-note {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 14px;
    height: 0;
    border-top: 2px dashed var(--text-3);
  }
</style>
