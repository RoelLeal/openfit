<script lang="ts" generics="T extends string">
  /** Radio group styled as a segmented control. Arrow keys work natively. */
  let {
    options,
    value = $bindable(),
    label,
    size = 'md',
  }: {
    options: readonly { value: T; label: string }[];
    value: T;
    label: string;
    size?: 'sm' | 'md';
  } = $props();

  const name = `seg-${Math.random().toString(36).slice(2)}`;
</script>

<div class="segmented {size}" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label class:active={option.value === value}>
      <input type="radio" {name} value={option.value} bind:group={value} />
      <span>{option.label}</span>
    </label>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow-x: auto;
    scrollbar-width: none;
  }

  label {
    position: relative;
    flex: 1 0 auto;
    display: grid;
    place-items: center;
    min-height: 38px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    color: var(--text-2);
    font-weight: 540;
    font-size: 0.9375rem;
    white-space: nowrap;
    cursor: pointer;
  }

  .sm label {
    min-height: 32px;
    font-size: 0.875rem;
  }

  label.active {
    background: var(--raised);
    color: var(--text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  }

  input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
</style>
