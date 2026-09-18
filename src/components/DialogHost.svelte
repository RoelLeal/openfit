<script lang="ts">
  import { t } from '../i18n/index.svelte.ts';
  import { dialogs, settleDialog, type ConfirmResult } from '../state/dialogs.svelte.ts';

  let dialog: HTMLDialogElement | undefined = $state();
  let typed = $state('');
  let result: ConfirmResult = 'cancel';
  const current = $derived(dialogs.current);
  const canConfirm = $derived(!current?.typeToConfirm || typed.trim() === current.typeToConfirm);

  $effect(() => {
    if (!dialog) return;
    if (current && !dialog.open) {
      typed = '';
      result = 'cancel';
      dialog.showModal();
    } else if (!current && dialog.open) {
      dialog.close();
    }
  });

  function close(value: ConfirmResult) {
    result = value;
    dialog?.close();
  }
</script>

<dialog bind:this={dialog} onclose={() => settleDialog(result)} aria-labelledby="confirm-title">
  {#if current}
    <form
      method="dialog"
      onsubmit={(event) => {
        event.preventDefault();
        if (canConfirm) close('confirm');
      }}
    >
      <h2 id="confirm-title">{current.title}</h2>
      {#if current.message}<p class="muted">{current.message}</p>{/if}
      {#if current.typeToConfirm}
        <label class="field">
          <span class="label">{t('data.deleteConfirm2', { word: current.typeToConfirm })}</span>
          <input class="input" bind:value={typed} autocomplete="off" autocapitalize="characters" />
        </label>
      {/if}
      <div class="buttons">
        {#if current.alternateLabel}
          <button class="btn btn-primary" type="button" onclick={() => close('alternate')}>
            {current.alternateLabel}
          </button>
        {/if}
        <button
          class="btn"
          class:btn-primary={!current.danger && !current.alternateLabel}
          class:btn-danger={current.danger}
          class:solid={current.danger && !current.alternateLabel}
          type="submit"
          disabled={!canConfirm}
        >
          {current.confirmLabel}
        </button>
        <button class="btn btn-ghost" type="button" onclick={() => close('cancel')}>
          {current.cancelLabel ?? t('common.cancel')}
        </button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  dialog {
    width: calc(100% - 32px);
    max-width: 400px;
    padding: 0;
    border: 0;
    border-radius: 20px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-float);
  }

  dialog::backdrop {
    background: var(--backdrop);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
