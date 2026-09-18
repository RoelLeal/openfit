<script lang="ts">
  import { t } from '../i18n/index.svelte.ts';
  import { dismissToast, toasts } from '../state/toasts.svelte.ts';
  import Icon from './Icon.svelte';

  async function runAction(id: number, run: () => void | Promise<void>) {
    dismissToast(id);
    await run();
  }
</script>

<div class="toasts" aria-live="polite" aria-atomic="true">
  {#each toasts as toast (toast.id)}
    <div
      class="toast"
      class:error={toast.tone === 'error'}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      {#if toast.tone === 'error'}<Icon name="alert" size={18} />{/if}
      <span class="message">{toast.message}</span>
      {#if toast.action}
        {@const action = toast.action}
        <button class="action" type="button" onclick={() => runAction(toast.id, action.run)}>
          {action.label}
        </button>
      {/if}
      <button
        class="close"
        type="button"
        onclick={() => dismissToast(toast.id)}
        aria-label={t('common.close')}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    z-index: 30;
    left: 0;
    right: 0;
    /* Above the floating "Add food" button so it never hides it. */
    bottom: calc(var(--nav-height) + var(--safe-bottom) + 84px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    max-width: 480px;
    min-height: 48px;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--text);
    color: var(--bg);
    box-shadow: var(--shadow-float);
    pointer-events: auto;
    animation: appear 0.15s ease-out;
  }

  .toast.error {
    background: var(--danger);
    color: #fff;
  }

  @keyframes appear {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }

  .message {
    flex: 1;
    font-size: 0.9375rem;
  }

  button {
    border: 0;
    background: none;
    color: inherit;
  }

  .action {
    min-height: 36px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    font-weight: 650;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .close {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    opacity: 0.7;
  }

  @media (min-width: 900px) {
    .toasts {
      bottom: 96px;
      left: 232px;
    }
  }
</style>
