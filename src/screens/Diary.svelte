<script lang="ts">
  import DailySummary from '../components/DailySummary.svelte';
  import DateNav from '../components/DateNav.svelte';
  import Icon from '../components/Icon.svelte';
  import MealSection from '../components/MealSection.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import QuantitySheet, { type QuantityResult } from '../components/QuantitySheet.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { isDayKey } from '../core/dates.ts';
  import { mealForHour } from '../core/meals.ts';
  import { entryMacros, groupByMeal, sumMacros } from '../core/nutrition.ts';
  import { MEAL_SLOTS, type Entry } from '../core/types.ts';
  import { getLastBackupAt } from '../db/repos/data.ts';
  import { deleteEntry, listEntries, restoreEntry, updateEntry } from '../db/repos/entries.ts';
  import { mealFromEntries } from '../db/repos/meals.ts';
  import { getProfile } from '../db/repos/settings.ts';
  import { fmtRelativeTime, t } from '../i18n/index.svelte.ts';
  import type { ScreenProps } from '../routes.ts';
  import { clock } from '../state/app.svelte.ts';
  import {
    dismissBackupReminder,
    exportBackupFile,
    shouldShowBackupReminder,
  } from '../state/backup.ts';
  import { live } from '../state/live.svelte.ts';
  import { href, navigate } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let { params }: ScreenProps = $props();

  const date = $derived(params.date && isDayKey(params.date) ? params.date : clock.today);
  const entries = live(() => listEntries(date), [] as Entry[]);
  const profile = live(getProfile, null);
  const reminder = live(shouldShowBackupReminder, false);
  const lastBackup = live(getLastBackupAt, null);

  const groups = $derived(groupByMeal(entries.value));
  const total = $derived(sumMacros(entries.value.map(entryMacros)));
  const slots = $derived([
    ...MEAL_SLOTS,
    ...[...groups.keys()].filter((meal) => !(MEAL_SLOTS as readonly string[]).includes(meal)),
  ]);

  let editing = $state.raw<Entry | null>(null);
  let editOpen = $state(false);
  let saveMealEntries = $state.raw<Entry[]>([]);
  let saveMealOpen = $state(false);
  let mealName = $state('');

  function changeDate(next: string) {
    navigate(next === clock.today ? '/' : `/day/${next}`, { replace: true });
  }

  function addTo(meal: string) {
    navigate(href('/add', { date, meal }));
  }

  function edit(entry: Entry) {
    editing = entry;
    editOpen = true;
  }

  async function saveEdit({ amount, unit, meal }: QuantityResult) {
    if (!editing) return;
    try {
      await updateEntry(editing.id, { amount, unit, meal });
    } catch (error) {
      showError(error, t('common.error'));
      throw error;
    }
  }

  async function removeEditing() {
    if (!editing) return;
    const id = editing.id;
    await deleteEntry(id);
    showToast(t('common.deleted'), {
      action: { label: t('common.undo'), run: () => restoreEntry(id) },
    });
  }

  function askMealName(list: Entry[]) {
    saveMealEntries = list;
    mealName = '';
    saveMealOpen = true;
  }

  async function saveMeal(event: SubmitEvent) {
    event.preventDefault();
    if (!mealName.trim()) return;
    try {
      await mealFromEntries(mealName, saveMealEntries);
      saveMealOpen = false;
      showToast(t('diary.mealSaved'));
    } catch (error) {
      showError(error, t('common.error'));
    }
  }

  async function backupNow() {
    try {
      await exportBackupFile();
      showToast(t('data.exported'));
    } catch (error) {
      showError(error, t('common.error'));
    }
  }
</script>

<PageHeader title={t('diary.title')} />

<div class="stack-lg">
  <DateNav {date} today={clock.today} onchange={changeDate} />

  <DailySummary {total} goals={profile.value?.goals ?? null} />

  {#if reminder.value}
    <div class="notice reminder" role="note">
      <Icon name="shield" />
      <div class="stack">
        <p>
          {t('diary.backupReminder')}
          {#if lastBackup.value}{t('diary.backupReminderLast', {
              when: fmtRelativeTime(lastBackup.value),
            })}{/if}
        </p>
        <div class="row">
          <button class="btn btn-sm btn-primary" type="button" onclick={backupNow}>
            <Icon name="download" size={16} />
            {t('diary.backupNow')}
          </button>
          <button
            class="btn btn-sm btn-ghost"
            type="button"
            onclick={() => dismissBackupReminder()}
          >
            {t('diary.notNow')}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if !entries.loading}
    {#each slots as meal (meal)}
      <MealSection
        {meal}
        entries={groups.get(meal) ?? []}
        onadd={() => addTo(meal)}
        onedit={edit}
        onsaveasmeal={() => askMealName(groups.get(meal) ?? [])}
      />
    {/each}
  {/if}
</div>

<button
  class="fab btn btn-primary"
  type="button"
  onclick={() => addTo(mealForHour(new Date().getHours()))}
>
  <Icon name="plus" />
  {t('diary.addFood')}
</button>

<QuantitySheet
  bind:open={editOpen}
  food={editing?.food ?? null}
  amount={editing?.amount ?? 1}
  unit={editing?.unit ?? 'g'}
  meal={editing?.meal}
  submitLabel={t('common.save')}
  onsubmit={saveEdit}
  ondelete={removeEditing}
/>

<Sheet bind:open={saveMealOpen} title={t('diary.saveAsMeal')}>
  <form id="save-meal" class="stack" onsubmit={saveMeal}>
    <label class="field">
      <span class="label">{t('diary.mealName')}</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="input"
        bind:value={mealName}
        placeholder={t('mealEditor.namePlaceholder')}
        required
        autofocus
        maxlength="200"
      />
    </label>
  </form>
  {#snippet footer()}
    <button
      class="btn btn-primary btn-block"
      type="submit"
      form="save-meal"
      disabled={!mealName.trim()}
    >
      {t('common.save')}
    </button>
  {/snippet}
</Sheet>

<style>
  .fab {
    position: fixed;
    z-index: 8;
    right: max(var(--space-4), calc((100vw - var(--content-width)) / 2 + var(--space-4)));
    bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-4));
    min-height: 52px;
    padding: 0 var(--space-5) 0 var(--space-4);
    box-shadow: var(--shadow-float);
    font-size: 1rem;
  }

  .reminder :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--accent);
  }

  @media (min-width: 900px) {
    .fab {
      right: max(var(--space-5), calc((100vw - 232px - var(--content-width)) / 2 + var(--space-4)));
      bottom: var(--space-5);
    }
  }
</style>
