<script lang="ts">
  import { onMount } from 'svelte';
  import BodyFigure from '../components/BodyFigure.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import ProfileForm from '../components/ProfileForm.svelte';
  import { DEFAULT_GOALS } from '../core/goals.ts';
  import type { Prefs, Profile } from '../core/types.ts';
  import { getPrefs, getProfile } from '../db/repos/settings.ts';
  import { latestWeight } from '../db/repos/weights.ts';
  import { t } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import { live } from '../state/live.svelte.ts';
  import {
    draftFromProfile,
    isDraftValid,
    saveDraft,
    type ProfileDraft,
  } from '../state/profile.ts';
  import { goBack } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  let profile: Profile | null = null;
  let previousWeight: number | null = null;
  let draft = $state<ProfileDraft | null>(null);
  let busy = $state(false);
  const prefs = live<Prefs | null>(getPrefs, null);
  const weightUnit = $derived(prefs.value?.weightUnit ?? 'kg');

  onMount(async () => {
    const [current, latest] = await Promise.all([getProfile(), latestWeight()]);
    profile = current;
    previousWeight = latest?.kg ?? null;
    draft = draftFromProfile(current, latest);
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft || !isDraftValid(draft, clock.today) || busy) return;
    busy = true;
    try {
      await saveDraft($state.snapshot(draft), profile?.goals ?? { ...DEFAULT_GOALS }, {
        today: clock.today,
        previousWeight,
      });
      showToast(t('profile.saved'));
      goBack('/settings');
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }
</script>

<PageHeader title={t('profile.title')} back="/settings" />

{#if draft}
  <form class="stack-lg" onsubmit={save}>
    <div class="card">
      <ProfileForm bind:draft {weightUnit} />
    </div>

    <section class="card stack">
      <h2>{t('body.title')}</h2>
      {#if draft.sex && draft.heightCm && draft.weightKg}
        <BodyFigure
          sex={draft.sex}
          heightCm={draft.heightCm}
          weightKg={draft.weightKg}
          targetWeightKg={draft.targetWeightKg}
          {weightUnit}
        />
      {:else}
        <p class="muted small">{t('body.missing')}</p>
      {/if}
    </section>

    <button
      class="btn btn-primary btn-block"
      type="submit"
      disabled={!isDraftValid(draft, clock.today) || busy}
    >
      {t('common.save')}
    </button>
  </form>
{/if}
