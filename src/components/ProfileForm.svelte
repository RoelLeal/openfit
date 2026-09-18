<script lang="ts">
  import { ACTIVITY_LEVELS, ageAt } from '../core/goals.ts';
  import { SEXES, type WeightUnit } from '../core/types.ts';
  import { kgToInput, unitToKg } from '../core/weight.ts';
  import { t } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import {
    birthDateBounds,
    isBirthDateValid,
    isPositiveOrEmpty,
    type ProfileDraft,
  } from '../state/profile.ts';
  import NumberField from './NumberField.svelte';

  let { draft = $bindable(), weightUnit }: { draft: ProfileDraft; weightUnit: WeightUnit } =
    $props();

  const bounds = $derived(birthDateBounds(clock.today));
  const birthValid = $derived(isBirthDateValid(draft.birthDate, clock.today));
  const unit = $derived(t(`unit.${weightUnit}`));
  let birthTouched = $state(false);

  const positive = (value: number | null) =>
    isPositiveOrEmpty(value) ? null : t('common.mustBePositive');
  const required = (value: number | null) =>
    value === null ? t('common.required') : positive(value);

  // Weights are stored in kg; the fields show and accept the preferred unit.
  function toKg(value: number | null): number | null {
    return value === null ? null : unitToKg(value, weightUnit);
  }
</script>

<div class="stack">
  <fieldset class="sex">
    <legend class="label">{t('profile.sex')}</legend>
    <div class="options">
      {#each SEXES as sex (sex)}
        <label class="option" class:selected={draft.sex === sex}>
          <input type="radio" name="sex" value={sex} bind:group={draft.sex} required />
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            {#if sex === 'female'}
              <circle cx="12" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" />
              <path
                d="M12 13v8M9 18h6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            {:else}
              <circle cx="10" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="2" />
              <path
                d="M14 10l6-6M15 4h5v5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {/if}
          </svg>
          <span>{t(`profile.sex.${sex}`)}</span>
        </label>
      {/each}
    </div>
    {#if draft.sex === null}<p class="subtle tiny">{t('profile.chooseSex')}</p>{/if}
  </fieldset>

  <div class="field">
    <label class="label" for="birth-date">{t('profile.birthDate')}</label>
    <input
      id="birth-date"
      class="input"
      type="date"
      bind:value={draft.birthDate}
      min={bounds.min}
      max={bounds.max}
      required
      onblur={() => (birthTouched = true)}
      aria-invalid={birthTouched && !birthValid ? 'true' : undefined}
      aria-describedby="birth-date-hint"
    />
    <p id="birth-date-hint" class:error-text={birthTouched && !birthValid} class="subtle tiny">
      {#if birthValid}
        {t('profile.age', { age: ageAt(draft.birthDate, clock.today) })}
      {:else}
        {t('profile.invalidBirthDate')}
      {/if}
    </p>
  </div>

  <div class="grid-2">
    <NumberField
      label={t('profile.height')}
      bind:value={draft.heightCm}
      required
      error={required(draft.heightCm)}
      suffix="cm"
    />
    <NumberField
      label={t('profile.weight', { unit })}
      bind:value={
        () => kgToInput(draft.weightKg, weightUnit), (value) => (draft.weightKg = toKg(value))
      }
      required
      error={required(draft.weightKg)}
      suffix={unit}
    />
    <NumberField
      label={t('profile.targetWeight', { unit })}
      bind:value={
        () => kgToInput(draft.targetWeightKg, weightUnit),
        (value) => (draft.targetWeightKg = toKg(value))
      }
      error={positive(draft.targetWeightKg)}
      suffix={unit}
    />
  </div>
  <p class="subtle tiny">{t('profile.weightHint')}</p>

  <label class="field">
    <span class="label">{t('profile.activity')}</span>
    <select class="select" bind:value={draft.activity}>
      {#each ACTIVITY_LEVELS as level (level)}
        <option value={level}>{t(`profile.activity.${level}`)}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .sex {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .option {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 56px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-2);
    font-weight: 560;
    cursor: pointer;
  }

  .option.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }

  .option.selected svg {
    color: var(--accent);
  }

  .option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .option:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
