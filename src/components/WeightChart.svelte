<script lang="ts">
  import { datePosition, nearestIndex, niceScale } from '../core/chart.ts';
  import type { DayKey, WeightEntry, WeightUnit } from '../core/types.ts';
  import { kgToUnit } from '../core/weight.ts';
  import { fmtDate, fmtNumber, fmtWeight, t } from '../i18n/index.svelte.ts';

  /**
   * Single-series line chart: 2 px line, 10 % area wash, end dot with a surface ring,
   * a plain target line with a direct label, and a crosshair + tooltip on hover/keyboard.
   * The weight history list on the same screen is the table view.
   */
  let {
    weights,
    target,
    from,
    to,
    unit = 'kg',
  }: {
    weights: WeightEntry[];
    target: number | null;
    from: DayKey;
    to: DayKey;
    unit?: WeightUnit;
  } = $props();

  const HEIGHT = 200;
  const PAD = { top: 20, right: 16, bottom: 28, left: 40 };

  let width = $state(320);
  let active = $state<number | null>(null);

  const plotWidth = $derived(Math.max(10, width - PAD.left - PAD.right));
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  // The chart works in the display unit; stored values are always kg.
  const value = (kg: number) => kgToUnit(kg, unit);
  const scale = $derived(
    niceScale([...weights.map((w) => value(w.kg)), ...(target ? [value(target)] : [])]),
  );
  const x = (date: DayKey) => PAD.left + datePosition(date, from, to) * plotWidth;
  const y = (kg: number) =>
    PAD.top + (1 - (kg - scale.min) / (scale.max - scale.min || 1)) * plotHeight;

  const points = $derived(weights.map((w) => ({ w, x: x(w.date), y: y(value(w.kg)) })));
  const line = $derived(
    points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(''),
  );
  const area = $derived(
    points.length > 1
      ? `${line}L${points.at(-1)!.x.toFixed(1)},${PAD.top + plotHeight}L${points[0]!.x.toFixed(1)},${PAD.top + plotHeight}Z`
      : '',
  );
  const last = $derived(points.at(-1));
  const current = $derived(active !== null ? points[active] : undefined);

  const kg = (weightKg: number) => fmtWeight(weightKg, unit);
  const shortDate = (date: DayKey) => fmtDate(date, { day: 'numeric', month: 'short' });
  const longDate = (date: DayKey) =>
    fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' });
  const focused = $derived(current ?? last);
  const valueText = $derived(focused ? `${longDate(focused.w.date)}: ${kg(focused.w.kg)}` : '');

  function onpointermove(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = event.clientX - rect.left;
    const index = nearestIndex(
      points.map((p) => p.x),
      position,
    );
    active = index >= 0 ? index : null;
  }

  function onkeydown(event: KeyboardEvent) {
    if (!points.length) return;
    const lastIndex = points.length - 1;
    const now = active ?? lastIndex;
    const next =
      event.key === 'ArrowLeft'
        ? Math.max(0, now - 1)
        : event.key === 'ArrowRight'
          ? Math.min(lastIndex, now + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastIndex
              : null;
    if (next === null) return;
    event.preventDefault();
    active = next;
  }
</script>

<!--
  Exposed as a slider over the data points: arrow keys move between weights and the
  value text is announced. The pointer handlers are the mouse/touch equivalent.
-->
<div
  class="chart"
  bind:clientWidth={width}
  role="slider"
  aria-label={t('weight.chart')}
  aria-orientation="horizontal"
  aria-valuemin={0}
  aria-valuemax={Math.max(0, points.length - 1)}
  aria-valuenow={active ?? Math.max(0, points.length - 1)}
  aria-valuetext={valueText}
  tabindex="0"
  {onkeydown}
  {onpointermove}
  onpointerdown={onpointermove}
  onpointerleave={() => (active = null)}
  onfocus={() => (active ??= points.length - 1)}
  onblur={() => (active = null)}
>
  <svg {width} height={HEIGHT} viewBox="0 0 {width} {HEIGHT}" aria-hidden="true">
    {#each scale.ticks as tick (tick)}
      <line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
      <text class="axis" x={PAD.left - 8} y={y(tick)} dy="0.32em" text-anchor="end">
        {fmtNumber(tick, 1)}
      </text>
    {/each}

    <text class="axis" x={PAD.left} y={HEIGHT - 8} text-anchor="start">{shortDate(from)}</text>
    <text class="axis" x={width - PAD.right} y={HEIGHT - 8} text-anchor="end">{shortDate(to)}</text>

    {#if target}
      <line
        class="target"
        x1={PAD.left}
        x2={width - PAD.right}
        y1={y(value(target))}
        y2={y(value(target))}
      />
      <text class="label" x={PAD.left + 6} y={y(value(target)) - 6}>
        {t('weight.targetLine', { value: kg(target) })}
      </text>
    {/if}

    {#if area}<path class="area" d={area} />{/if}
    {#if points.length > 1}<path class="line" d={line} />{/if}

    {#if last}
      <circle class="dot" cx={last.x} cy={last.y} r="4" />
      {#if !current}
        <text
          class="label strong"
          x={Math.min(last.x, width - PAD.right)}
          y={last.y - 12}
          text-anchor="end"
        >
          {kg(last.w.kg)}
        </text>
      {/if}
    {/if}

    {#if current}
      <line
        class="crosshair"
        x1={current.x}
        x2={current.x}
        y1={PAD.top}
        y2={PAD.top + plotHeight}
      />
      <circle class="dot" cx={current.x} cy={current.y} r="5" />
    {/if}
  </svg>

  {#if current}
    <div
      class="tooltip"
      style:left="{Math.min(Math.max(current.x, 70), width - 70)}px"
      style:top="{Math.max(current.y - 64, 0)}px"
    >
      <strong class="num">{kg(current.w.kg)}</strong>
      <span
        >{fmtDate(current.w.date, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}</span
      >
    </div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
    border-radius: var(--radius-sm);
    touch-action: pan-y;
    cursor: crosshair;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }

  .axis {
    fill: var(--text-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .label {
    fill: var(--text-2);
    font-size: 12px;
  }

  .label.strong {
    fill: var(--text);
    font-weight: 600;
  }

  .target {
    stroke: var(--text-3);
    stroke-width: 1;
  }

  .area {
    fill: var(--accent);
    opacity: 0.1;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--accent);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .crosshair {
    stroke: var(--text-3);
    stroke-width: 1;
  }

  .tooltip {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-float);
    font-size: 0.75rem;
    color: var(--text-2);
    white-space: nowrap;
    pointer-events: none;
  }

  .tooltip strong {
    font-size: 0.9375rem;
    color: var(--text);
  }
</style>
