<script lang="ts">
  import { addDays } from '../core/dates.ts';
  import type { DayKey } from '../core/types.ts';
  import { fmtDate, fmtDayLabel, t } from '../i18n/index.svelte.ts';
  import Calendar from './Calendar.svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  let { date, today, onchange }: { date: DayKey; today: DayKey; onchange: (date: DayKey) => void } =
    $props();

  let calendarOpen = $state(false);

  function select(day: DayKey) {
    calendarOpen = false;
    onchange(day);
  }
</script>

<div class="date-nav">
  <button
    class="icon-btn"
    type="button"
    onclick={() => onchange(addDays(date, -1))}
    aria-label={t('date.previousDay')}
  >
    <Icon name="back" />
  </button>
  <button
    class="current"
    type="button"
    onclick={() => (calendarOpen = true)}
    aria-haspopup="dialog"
  >
    <span class="day">{fmtDayLabel(date, today)}</span>
    <span class="full">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    <span class="visually-hidden">{t('date.openCalendar')}</span>
  </button>
  <button
    class="icon-btn"
    type="button"
    onclick={() => onchange(addDays(date, 1))}
    aria-label={t('date.nextDay')}
  >
    <Icon name="forward" />
  </button>
  {#if date !== today}
    <button class="btn btn-sm today" type="button" onclick={() => onchange(today)}>
      {t('date.today')}
    </button>
  {/if}
</div>

<Sheet bind:open={calendarOpen} title={t('date.openCalendar')}>
  <Calendar selected={date} {today} onselect={select} />
</Sheet>

<style>
  .date-nav {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .current {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 48px;
    padding: 2px var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
  }

  .current:hover {
    background: var(--surface-2);
  }

  .day {
    font-weight: 650;
    font-size: 1.0625rem;
    text-transform: capitalize;
  }

  .full {
    font-size: 0.8125rem;
    color: var(--text-2);
  }

  .full::first-letter {
    text-transform: uppercase;
  }

  .today {
    margin-left: var(--space-1);
  }
</style>
