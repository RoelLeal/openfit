<script lang="ts">
  import BodyFigure from '../components/BodyFigure.svelte';
  import GoalsForm from '../components/GoalsForm.svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import ProfileForm from '../components/ProfileForm.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { BackupError, summarizeBackup, type Backup } from '../core/backup.ts';
  import { DEFAULT_GOALS } from '../core/goals.ts';
  import { WEIGHT_UNITS, type Locale, type WeightUnit } from '../core/types.ts';
  import { importBackup } from '../db/repos/data.ts';
  import { savePrefs } from '../db/repos/settings.ts';
  import { i18n, setLocale, t, type MessageKey } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import { backupDateLabel, markFirstUse, pickBackupFile } from '../state/backup.ts';
  import { requestPersistentStorage } from '../platform/index.ts';
  import {
    emptyDraft,
    goalsDraft,
    isDraftValid,
    isGoalsValid,
    saveDraft,
    suggestionFor,
    type GoalsDraft,
    type ProfileDraft,
  } from '../state/profile.ts';
  import { navigate } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let step = $state(0);
  let draft = $state<ProfileDraft>(emptyDraft());
  let goals = $state<GoalsDraft>(goalsDraft(DEFAULT_GOALS));
  let busy = $state(false);
  // Raw: the backup is written to IndexedDB as is, and proxies cannot be cloned.
  let restoreCandidate = $state.raw<Backup | null>(null);
  let restoreOpen = $state(false);
  let weightUnit = $state<WeightUnit>('kg');

  const suggestion = $derived(suggestionFor(draft, clock.today));
  const unitOptions = $derived(
    WEIGHT_UNITS.map((value) => ({ value, label: t(`weightUnit.${value}`) })),
  );
  const points: { icon: IconName; text: MessageKey }[] = [
    { icon: 'shield', text: 'welcome.point1' },
    { icon: 'phone', text: 'welcome.point2' },
    { icon: 'download', text: 'welcome.point3' },
  ];
  const languages = [
    { value: 'es' as const, label: 'Español' },
    { value: 'en' as const, label: 'English' },
  ];

  function changeLanguage(locale: Locale) {
    void setLocale(locale);
    savePrefs({ locale }).catch((error: unknown) => showError(error, t('common.error')));
  }

  function changeWeightUnit(unit: WeightUnit) {
    weightUnit = unit;
    savePrefs({ weightUnit: unit }).catch((error: unknown) => showError(error, t('common.error')));
  }

  function toGoals() {
    goals = goalsDraft(suggestionFor(draft, clock.today)?.goals ?? DEFAULT_GOALS);
    step = 2;
  }

  async function finish() {
    if (!isGoalsValid(goals) || busy) return;
    busy = true;
    try {
      await markFirstUse();
      await saveDraft(
        $state.snapshot(draft),
        { ...goals },
        { today: clock.today, previousWeight: null },
      );
      // Ask the browser to protect local data; installing the app usually grants it.
      void requestPersistentStorage();
      navigate('/', { replace: true });
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }

  async function chooseBackup() {
    try {
      const backup = await pickBackupFile();
      if (!backup) return;
      restoreCandidate = backup;
      restoreOpen = true;
    } catch (error) {
      if (error instanceof BackupError) {
        showToast(t(`data.error.${error.code}`, { detail: error.detail }), {
          tone: 'error',
          duration: 8000,
        });
      } else {
        showError(error, t('common.error'));
      }
    }
  }

  async function restore() {
    if (!restoreCandidate || busy) return;
    busy = true;
    try {
      await importBackup(restoreCandidate, 'replace');
      await markFirstUse();
      void requestPersistentStorage();
      restoreOpen = false;
      showToast(t('data.restored'));
      navigate('/', { replace: true });
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }

  const summary = $derived(restoreCandidate ? summarizeBackup(restoreCandidate) : null);
</script>

<div class="welcome">
  {#if step === 0}
    <section class="stack-lg intro">
      <img src="./favicon.svg" alt="" width="72" height="72" />
      <div class="stack">
        <h1>{t('welcome.title')}</h1>
        <p class="muted lead">{t('welcome.subtitle')}</p>
      </div>
      <ul class="points">
        {#each points as point (point.text)}
          <li><Icon name={point.icon} /> {t(point.text)}</li>
        {/each}
      </ul>
      <Segmented
        label="Idioma / Language"
        options={languages}
        bind:value={() => i18n.locale, changeLanguage}
      />
      <div class="stack">
        <button class="btn btn-primary btn-block" type="button" onclick={() => (step = 1)}>
          {t('welcome.start')}
        </button>
        <button class="btn btn-ghost btn-block" type="button" onclick={chooseBackup}>
          <Icon name="upload" size={18} />
          {t('welcome.restore')}
        </button>
      </div>
    </section>
  {:else if step === 1}
    <form
      class="stack-lg"
      onsubmit={(event) => {
        event.preventDefault();
        if (isDraftValid(draft, clock.today)) toGoals();
      }}
    >
      <header class="stack">
        <p class="subtle small">{t('welcome.step', { step: 1, total: 2 })}</p>
        <h1>{t('welcome.profileTitle')}</h1>
        <p class="muted">{t('welcome.profileHint')}</p>
      </header>
      <div class="card stack">
        <div class="field">
          <span class="label">{t('settings.weightUnit')}</span>
          <Segmented
            label={t('settings.weightUnit')}
            options={unitOptions}
            bind:value={() => weightUnit, changeWeightUnit}
            size="sm"
          />
        </div>
        <ProfileForm bind:draft {weightUnit} />
      </div>
      {#if draft.sex && draft.heightCm && draft.weightKg}
        <div class="card">
          <BodyFigure
            sex={draft.sex}
            heightCm={draft.heightCm}
            weightKg={draft.weightKg}
            targetWeightKg={draft.targetWeightKg}
            {weightUnit}
            compact
          />
        </div>
      {/if}
      <div class="actions">
        <button class="btn btn-ghost" type="button" onclick={() => (step = 0)}
          >{t('common.back')}</button
        >
        <span class="spacer"></span>
        <button class="btn btn-primary" type="submit" disabled={!isDraftValid(draft, clock.today)}
          >{t('common.continue')}</button
        >
      </div>
    </form>
  {:else}
    <form
      class="stack-lg"
      onsubmit={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <header class="stack">
        <p class="subtle small">{t('welcome.step', { step: 2, total: 2 })}</p>
        <h1>{t('welcome.goalsTitle')}</h1>
        <p class="muted">{t('welcome.goalsHint')}</p>
      </header>
      <div class="card"><GoalsForm bind:goals {suggestion} showSuggestButton={false} /></div>
      <div class="actions">
        <button class="btn btn-ghost" type="button" onclick={() => (step = 1)}
          >{t('common.back')}</button
        >
        <span class="spacer"></span>
        <button class="btn btn-primary" type="submit" disabled={!isGoalsValid(goals) || busy}>
          {t('welcome.finish')}
        </button>
      </div>
    </form>
  {/if}
</div>

<Sheet bind:open={restoreOpen} title={t('data.restore')}>
  {#if summary && restoreCandidate}
    <p>
      {t('data.restoreSummary', {
        date: backupDateLabel(restoreCandidate),
        entries: summary.entries,
        foods: summary.foods,
        meals: summary.meals,
        weights: summary.weights,
      })}
    </p>
  {/if}
  {#snippet footer()}
    <button class="btn btn-primary btn-block" type="button" onclick={restore} disabled={busy}>
      {t('data.restoreConfirm')}
    </button>
  {/snippet}
</Sheet>

<style>
  .welcome {
    max-width: 480px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--space-6)) 0 var(--space-6);
  }

  .intro img {
    border-radius: 18px;
  }

  h1 {
    font-size: 1.75rem;
    line-height: 1.2;
  }

  .lead {
    font-size: 1.125rem;
  }

  .points {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .points li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .points :global(svg) {
    flex: none;
    color: var(--accent);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
</style>
