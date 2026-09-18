<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { icon, message, children }: { icon?: IconName; message: string; children?: Snippet } =
    $props();
</script>

<div class="empty">
  {#if icon}<span class="icon"><Icon name={icon} size={28} /></span>{/if}
  <p class="muted">{message}</p>
  {#if children}{@render children()}{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-3);
  }

  p {
    max-width: 32ch;
  }
</style>
