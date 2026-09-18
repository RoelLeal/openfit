<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte.ts';
  import Icon from './Icon.svelte';

  /**
   * Modal built on the native <dialog>: focus trap, Escape and inert background for free.
   * Bottom sheet on phones, centered panel on larger screens.
   */
  let {
    open = $bindable(false),
    title,
    subtitle,
    children,
    footer,
    onclose,
  }: {
    open?: boolean;
    title: string;
    subtitle?: string;
    children: Snippet;
    footer?: Snippet;
    onclose?: () => void;
  } = $props();

  const id = `sheet-${Math.random().toString(36).slice(2)}`;
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function handleClose() {
    if (!open) return;
    open = false;
    onclose?.();
  }

  function handleBackdrop(event: MouseEvent) {
    // Clicks on the dialog element itself can only come from the backdrop.
    if (event.target === dialog) dialog?.close();
  }
</script>

<!-- Escape is handled natively by <dialog>; the click only closes on the backdrop. -->
<dialog bind:this={dialog} aria-labelledby={id} onclose={handleClose} onclick={handleBackdrop}>
  {#if open}
    <div class="sheet">
      <header>
        <div class="titles">
          <h2 {id}>{title}</h2>
          {#if subtitle}<p class="muted small">{subtitle}</p>{/if}
        </div>
        <button
          class="icon-btn"
          type="button"
          onclick={() => dialog?.close()}
          aria-label={t('common.close')}
        >
          <Icon name="close" />
        </button>
      </header>
      <div class="body">
        {@render children()}
      </div>
      {#if footer}
        <footer>{@render footer()}</footer>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: 100%;
    max-width: var(--content-width);
    max-height: min(92dvh, 760px);
    margin: auto auto 0;
    padding: 0;
    border: 0;
    border-radius: 20px 20px 0 0;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-float);
    overflow: hidden;
  }

  dialog::backdrop {
    background: var(--backdrop);
  }

  dialog[open] {
    animation: rise 0.18s ease-out;
  }

  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0.6;
    }
  }

  .sheet {
    display: flex;
    flex-direction: column;
    max-height: inherit;
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-2) var(--space-2) var(--space-5);
  }

  .titles {
    flex: 1;
    min-width: 0;
    padding-top: 10px;
  }

  h2 {
    overflow-wrap: anywhere;
  }

  .body {
    overflow-y: auto;
    padding: var(--space-2) var(--space-5) var(--space-4);
    overscroll-behavior: contain;
  }

  footer {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5) calc(var(--space-4) + var(--safe-bottom));
    border-top: 1px solid var(--border);
  }

  @media (min-width: 640px) {
    dialog {
      margin: auto;
      border-radius: 20px;
    }

    footer {
      padding-bottom: var(--space-4);
    }
  }
</style>
