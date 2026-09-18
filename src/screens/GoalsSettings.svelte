<script lang="ts">
  import { onMount } from 'svelte';
  import GoalsForm from '../components/GoalsForm.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import { DEFAULT_GOALS } from '../core/goals.ts';
  import type { Profile } from '../core/types.ts';
  import { getProfile, saveProfile } from '../db/repos/settings.ts';
  import { latestWeight } from '../db/repos/weights.ts';
  import { t } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import {
    draftFromProfile,
    goalsDraft,
    isGoalsValid,
    suggestionFor,
    type GoalsDraft,
  } from '../state/profile.ts';
  import { goBack } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';
  import type { GoalSuggestion } from '../core/goals.ts';

  let profile: Profile | null = null;
  let goals = $state<GoalsDraft | null>(null);
  let suggestion = $state<GoalSuggestion | null>(null);
  let busy = $state(false);

  onMount(async () => {
    const [current, latest] = await Promise.all([getProfile(), latestWeight()]);
    profile = current;
    suggestion = suggestionFor(draftFromProfile(current, latest), clock.today);
    goals = goalsDraft(current?.goals ?? DEFAULT_GOALS);
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!goals || !isGoalsValid(goals) || busy) return;
    busy = true;
    try {
      await saveProfile({
        birthDate: profile?.birthDate ?? null,
        heightCm: profile?.heightCm ?? null,
        sex: profile?.sex ?? 'female',
        activity: profile?.activity ?? 'light',
        targetWeightKg: profile?.targetWeightKg ?? null,
        goals: { ...goals },
      });
      showToast(t('goals.saved'));
      goBack('/settings');
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }
</script>

<PageHeader title={t('goals.title')} back="/settings" />

{#if goals}
  <form class="stack-lg" onsubmit={save}>
    <div class="card">
      <GoalsForm bind:goals {suggestion} />
    </div>
    <button class="btn btn-primary btn-block" type="submit" disabled={!isGoalsValid(goals) || busy}>
      {t('common.save')}
    </button>
  </form>
{/if}
