<script lang="ts">
  import BodyFigure from '../components/BodyFigure.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Icon from '../components/Icon.svelte';
  import NumberField from '../components/NumberField.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import Segmented from '../components/Segmented.svelte';
  import WeightChart from '../components/WeightChart.svelte';
  import { CHART_RANGES, rangeStart, type ChartRange } from '../core/chart.ts';
  import { isDayKey } from '../core/dates.ts';
  import type { Prefs, WeightEntry } from '../core/types.ts';
  import { kgToInput, unitToKg } from '../core/weight.ts';
  import { getPrefs, getProfile } from '../db/repos/settings.ts';
  import { deleteWeight, listWeights, restoreWeight, setWeight } from '../db/repos/weights.ts';
  import { fmtDate, fmtWeight, t } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  const weights = live(listWeights, [] as WeightEntry[]);
  const profile = live(getProfile, null);
  const prefs = live<Prefs | null>(getPrefs, null);
  const unit = $derived(prefs.value?.weightUnit ?? 'kg');

  let range = $state<ChartRange>('3m');
  let date = $state(clock.today);
  let kg = $state<number | null>(null);
  let busy = $state(false);

  const from = $derived(rangeStart(range, clock.today, weights.value[0]?.date ?? null));
  const visible = $derived(weights.value.filter((w) => w.date >= from && w.date <= clock.today));
  const latest = $derived(weights.value.at(-1) ?? null);
  const change = $derived(visible.length > 1 ? visible.at(-1)!.kg - visible[0]!.kg : null);
  const target = $derived(profile.value?.targetWeightKg ?? null);
  const history = $derived([...weights.value].reverse());
  const ranges = $derived(
    CHART_RANGES.map((value) => ({ value, label: t(`weight.range.${value}`) })),
  );
  const valid = $derived(kg !== null && kg > 0 && isDayKey(date) && date <= clock.today);

  // Prefill with the last weight once it is known (only once, so clearing the field works).
  let prefilled = false;
  $effect(() => {
    if (!prefilled && latest) {
      prefilled = true;
      kg = latest.kg;
    }
  });

  const fmtKg = (value: number) => fmtWeight(value, unit);
  const signed = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmtKg(Math.abs(value))}`;

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || kg === null || busy) return;
    busy = true;
    try {
      await setWeight(date, kg);
      showToast(t('weight.saved'));
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }

  async function remove(entry: WeightEntry) {
    await deleteWeight(entry.id);
    showToast(t('common.deleted'), {
      action: { label: t('common.undo'), run: () => restoreWeight(entry.id) },
    });
  }
</script>

<PageHeader title={t('weight.title')} />

<div class="stack-lg">
  {#if weights.value.length > 0}
    <section class="card stack">
      <dl class="stats">
        <div>
          <dt>{t('weight.current')}</dt>
          <dd class="num">{latest ? fmtKg(latest.kg) : '–'}</dd>
        </div>
        <div>
          <dt>{t('weight.change')}</dt>
          <dd class="num">{change === null ? '–' : signed(change)}</dd>
        </div>
        <div>
          <dt>{t('weight.target')}</dt>
          <dd class="num">{target ? fmtKg(target) : '–'}</dd>
        </div>
      </dl>
      <Segmented label={t('weight.rangeLabel')} options={ranges} bind:value={range} size="sm" />
      {#if visible.length > 0}
        <WeightChart weights={visible} {target} {from} to={clock.today} {unit} />
      {:else}
        <p class="subtle small">{t('weight.empty')}</p>
      {/if}
    </section>
  {:else if !weights.loading}
    <EmptyState icon="weight" message={t('weight.empty')} />
  {/if}

  {#if latest && profile.value?.heightCm}
    <section class="card stack">
      <h2>{t('body.title')}</h2>
      <BodyFigure
        sex={profile.value.sex}
        heightCm={profile.value.heightCm}
        weightKg={latest.kg}
        targetWeightKg={target}
        weightUnit={unit}
      />
    </section>
  {/if}

  <form class="card stack" onsubmit={save}>
    <div class="grid-2">
      <label class="field">
        <span class="label">{t('weight.date')}</span>
        <input class="input" type="date" bind:value={date} max={clock.today} required />
      </label>
      <NumberField
        label={t('weight.input', { unit: t(`unit.${unit}`) })}
        bind:value={
          () => kgToInput(kg, unit), (value) => (kg = value === null ? null : unitToKg(value, unit))
        }
        suffix={t(`unit.${unit}`)}
        required
      />
    </div>
    <button class="btn btn-primary" type="submit" disabled={!valid || busy}>
      <Icon name="check" size={18} />
      {t('weight.save')}
    </button>
  </form>

  {#if history.length > 0}
    <section class="stack">
      <h2 class="section-title">{t('weight.history')}</h2>
      <ul class="list">
        {#each history as entry (entry.id)}
          <li class="list-item">
            <span class="main">
              <span class="title"
                >{fmtDate(entry.date, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}</span
              >
            </span>
            <span class="num strong">{fmtKg(entry.kg)}</span>
            <button
              class="icon-btn"
              type="button"
              onclick={() => remove(entry)}
              aria-label={t('weight.delete', {
                date: fmtDate(entry.date, { day: 'numeric', month: 'long', year: 'numeric' }),
              })}
            >
              <Icon name="trash" size={18} />
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    margin: 0;
  }

  dt {
    font-size: 0.8125rem;
    color: var(--text-2);
  }

  dd {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 650;
  }

  .strong {
    font-weight: 600;
  }
</style>
