<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte.ts';
  import { goBack } from '../state/router.svelte.ts';
  import Icon from './Icon.svelte';

  let {
    title,
    subtitle,
    back,
    actions,
  }: {
    title: string;
    subtitle?: string;
    /** Fallback route for the back button; omit to hide it. */
    back?: string;
    actions?: Snippet;
  } = $props();
</script>

<header class="page-header">
  {#if back !== undefined}
    <button
      class="icon-btn"
      type="button"
      onclick={() => goBack(back)}
      aria-label={t('common.back')}
    >
      <Icon name="back" />
    </button>
  {/if}
  <div class="titles">
    <h1>{title}</h1>
    {#if subtitle}<p class="muted small">{subtitle}</p>{/if}
  </div>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</header>

<style>
  .page-header {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 60px;
    margin: 0 calc(-1 * var(--space-4)) var(--space-2);
    padding: calc(var(--safe-top) + var(--space-2)) var(--space-2) var(--space-2) var(--space-4);
    background: var(--bg);
  }

  .page-header:has(> .icon-btn) {
    padding-left: var(--space-1);
  }

  .titles {
    flex: 1;
    min-width: 0;
  }

  h1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
</style>
