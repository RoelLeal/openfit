<script lang="ts">
  /**
   * Meter: value against a goal. The track is a lighter step of the fill's hue;
   * identity is always carried by the text label, never by color alone.
   */
  let {
    label,
    value,
    goal,
    valueText,
    color,
  }: { label: string; value: number; goal: number; valueText: string; color: string } = $props();

  const ratio = $derived(goal > 0 ? value / goal : 0);
  const over = $derived(goal > 0 && ratio > 1.05);
</script>

<div class="macro">
  <div class="row">
    <span class="dot" style:background={color} aria-hidden="true"></span>
    <span class="label">{label}</span>
    <span class="spacer"></span>
    <span class="value num" class:over>{valueText}</span>
  </div>
  <div
    class="track"
    style:--fill={color}
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={Math.round(goal)}
    aria-valuenow={Math.round(value)}
    aria-valuetext={valueText}
  >
    <div class="fill" style:width="{Math.min(ratio, 1) * 100}%"></div>
  </div>
</div>

<style>
  .macro {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 0.9375rem;
    font-weight: 540;
  }

  .value {
    font-size: 0.875rem;
    color: var(--text-2);
  }

  .value.over {
    color: var(--text);
    font-weight: 600;
  }

  .track {
    height: 8px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--fill) 18%, var(--surface));
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--fill);
    transition: width 0.25s ease-out;
  }
</style>
