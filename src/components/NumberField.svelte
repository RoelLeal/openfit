<script lang="ts">
  import { parseDecimal, toInputValue } from '../core/format.ts';
  import { intlLocale, t } from '../i18n/index.svelte.ts';

  /** Decimal input that accepts "1,5" and "1.5" and never shows the spinner of type=number. */
  let {
    label,
    value = $bindable(null),
    suffix,
    hint,
    error,
    required = false,
    autofocus = false,
    placeholder,
    large = false,
    onenter,
  }: {
    label: string;
    value?: number | null;
    suffix?: string;
    hint?: string;
    /** External validation message, shown after the field is touched. */
    error?: string | null;
    required?: boolean;
    autofocus?: boolean;
    placeholder?: string;
    large?: boolean;
    onenter?: () => void;
  } = $props();

  const id = `num-${Math.random().toString(36).slice(2)}`;
  let text = $state(toInputValue(value, intlLocale()));
  let touched = $state(false);
  let input: HTMLInputElement | undefined = $state();

  // Reflect external changes (e.g. a unit switch) without fighting the user's typing.
  $effect(() => {
    if (parseDecimal(text) !== value) text = toInputValue(value, intlLocale());
  });

  $effect(() => {
    if (autofocus && input) {
      input.focus();
      input.select();
    }
  });

  const invalid = $derived(text.trim() !== '' && parseDecimal(text) === null);
  const message = $derived(
    invalid
      ? t('common.invalidNumber')
      : touched && required && text.trim() === ''
        ? t('common.required')
        : touched
          ? (error ?? null)
          : null,
  );

  // Text and value are updated together (no bind:value) so the sync effect never sees a stale pair.
  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    text = event.currentTarget.value;
    value = parseDecimal(text);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && onenter) {
      event.preventDefault();
      touched = true;
      onenter();
    }
  }
</script>

<div class="field">
  <label class="label" for={id}>{label}</label>
  <div class="wrap" class:large>
    <input
      bind:this={input}
      {id}
      class="input num"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      enterkeyhint="done"
      {placeholder}
      {required}
      value={text}
      oninput={handleInput}
      onblur={() => (touched = true)}
      onkeydown={handleKeydown}
      onfocus={(event) => event.currentTarget.select()}
      aria-invalid={message ? 'true' : undefined}
      aria-describedby={message || hint ? `${id}-desc` : undefined}
    />
    {#if suffix}<span class="suffix" aria-hidden="true">{suffix}</span>{/if}
  </div>
  {#if message}
    <p id="{id}-desc" class="error-text">{message}</p>
  {:else if hint}
    <p id="{id}-desc" class="subtle tiny">{hint}</p>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }

  .suffix {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-3);
    pointer-events: none;
  }

  .wrap:has(.suffix) .input {
    padding-right: 52px;
  }

  .large .input {
    min-height: 56px;
    font-size: 1.5rem;
    font-weight: 600;
  }
</style>
