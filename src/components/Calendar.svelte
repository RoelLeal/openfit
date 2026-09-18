<script lang="ts">
  import { untrack } from 'svelte';
  import { addMonths, isSameMonth, monthGrid, startOfMonth } from '../core/dates.ts';
  import type { DayKey } from '../core/types.ts';
  import { datesWithEntries } from '../db/repos/entries.ts';
  import { fmtDate, intlLocale, t } from '../i18n/index.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import Icon from './Icon.svelte';

  let {
    selected,
    today,
    onselect,
  }: { selected: DayKey; today: DayKey; onselect: (date: DayKey) => void } = $props();

  // The visible month starts at the selected date and is then navigated freely.
  let month = $state(untrack(() => startOfMonth(selected)));

  const weekStart = $derived.by((): 0 | 1 => {
    try {
      const locale = new Intl.Locale(intlLocale()) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
      };
      const info = locale.getWeekInfo?.() ?? locale.weekInfo;
      return info?.firstDay === 7 ? 0 : 1;
    } catch {
      return 1;
    }
  });

  const days = $derived(monthGrid(month, weekStart));
  const logged = live(() => {
    const grid = days;
    return datesWithEntries(grid[0]!, grid.at(-1)!);
  }, new Set<string>());
  const weekdays = $derived(days.slice(0, 7).map((day) => fmtDate(day, { weekday: 'narrow' })));
  const weekdayNames = $derived(days.slice(0, 7).map((day) => fmtDate(day, { weekday: 'long' })));

  function onkeydown(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const move = moves[event.key];
    const target = event.target as HTMLElement;
    const date = target.dataset.date;
    if (move === undefined || !date) return;
    event.preventDefault();
    const index = days.indexOf(date) + move;
    const next = days[index];
    if (!next) {
      month = addMonths(month, move > 0 ? 1 : -1);
      return;
    }
    const button = target.closest('.grid')?.querySelector<HTMLElement>(`[data-date="${next}"]`);
    button?.focus();
  }
</script>

<div class="calendar">
  <div class="header">
    <button
      class="icon-btn"
      type="button"
      onclick={() => (month = addMonths(month, -1))}
      aria-label={t('date.previousMonth')}
    >
      <Icon name="back" />
    </button>
    <h3 aria-live="polite">{fmtDate(month, { month: 'long', year: 'numeric' })}</h3>
    <button
      class="icon-btn"
      type="button"
      onclick={() => (month = addMonths(month, 1))}
      aria-label={t('date.nextMonth')}
    >
      <Icon name="forward" />
    </button>
  </div>

  <div
    class="grid"
    role="grid"
    tabindex="-1"
    aria-label={fmtDate(month, { month: 'long', year: 'numeric' })}
    {onkeydown}
  >
    <div class="week" role="row">
      {#each weekdays as weekday, i (i)}
        <span class="weekday" role="columnheader"
          ><abbr title={weekdayNames[i]}>{weekday}</abbr></span
        >
      {/each}
    </div>
    {#each [0, 1, 2, 3, 4, 5] as week (week)}
      <div class="week" role="row">
        {#each days.slice(week * 7, week * 7 + 7) as day (day)}
          <span role="gridcell">
            <button
              type="button"
              class="day"
              class:outside={!isSameMonth(day, month)}
              class:today={day === today}
              class:selected={day === selected}
              data-date={day}
              tabindex={day === selected ||
              (!isSameMonth(selected, month) && day === startOfMonth(month))
                ? 0
                : -1}
              aria-pressed={day === selected}
              aria-label={fmtDate(day, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              onclick={() => onselect(day)}
            >
              {Number(day.slice(8))}
              {#if logged.value.has(day)}<span class="mark" aria-hidden="true"></span>{/if}
            </button>
          </span>
        {/each}
      </div>
    {/each}
  </div>
  <p class="legend subtle tiny">
    <span class="mark static" aria-hidden="true"></span>
    {t('date.hasEntries')}
  </p>
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  h3::first-letter {
    text-transform: uppercase;
  }

  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .weekday {
    display: grid;
    place-items: center;
    height: 32px;
    font-size: 0.8125rem;
    color: var(--text-3);
    text-transform: uppercase;
  }

  abbr {
    text-decoration: none;
  }

  [role='gridcell'] {
    display: grid;
    place-items: center;
  }

  .day {
    position: relative;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: none;
    font-variant-numeric: tabular-nums;
  }

  .day:hover {
    background: var(--surface-2);
  }

  .day.outside {
    color: var(--text-3);
  }

  .day.today {
    font-weight: 700;
    color: var(--accent);
  }

  .day.selected {
    background: var(--accent);
    color: var(--on-accent);
  }

  .mark {
    position: absolute;
    left: 50%;
    bottom: 6px;
    width: 5px;
    height: 5px;
    margin-left: -2.5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .selected .mark {
    background: var(--on-accent);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .mark.static {
    position: static;
    margin: 0;
  }
</style>
