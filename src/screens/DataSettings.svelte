<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { BackupError, summarizeBackup, type Backup, type BackupSummary } from '../core/backup.ts';
  import { listInstalledPacks } from '../db/repos/catalog.ts';
  import {
    buildCsv,
    CSV_KINDS,
    deleteAllData,
    getLastBackupAt,
    importBackup,
    type CsvKind,
    type RestoreMode,
  } from '../db/repos/data.ts';
  import { fmtBytes, fmtRelativeTime, i18n, t } from '../i18n/index.svelte.ts';
  import { clock } from '../state/app.svelte.ts';
  import { backupDateLabel, exportBackupFile, pickBackupFile } from '../state/backup.ts';
  import { askChoice, confirmAction } from '../state/dialogs.svelte.ts';
  import {
    canShareFiles,
    deleteDeviceCopy,
    exportFile,
    getStorageStatus,
    IS_NATIVE,
    requestPersistentStorage,
    type StorageStatus,
  } from '../platform/index.ts';
  import { live } from '../state/live.svelte.ts';
  import { navigate } from '../state/router.svelte.ts';
  import { showError, showToast } from '../state/toasts.svelte.ts';

  const lastBackup = live(getLastBackupAt, null);
  const shareAvailable = canShareFiles();
  let storage = $state<StorageStatus | null>(null);
  // Raw: the backup is written to IndexedDB as is, and proxies cannot be cloned.
  let pending = $state.raw<{ backup: Backup; summary: BackupSummary } | null>(null);
  let restoreOpen = $state(false);
  let mode = $state<RestoreMode>('replace');
  let busy = $state(false);

  onMount(() => {
    if (!IS_NATIVE) void refreshStorage();
  });

  async function refreshStorage() {
    storage = await getStorageStatus();
  }

  async function exportBackup(share: boolean) {
    try {
      if (await exportBackupFile({ share })) showToast(t('data.exported'));
    } catch (error) {
      showError(error, t('common.error'));
    }
  }

  async function chooseBackup() {
    try {
      const backup = await pickBackupFile();
      if (!backup) return;
      pending = { backup, summary: summarizeBackup(backup) };
      mode = 'replace';
      restoreOpen = true;
    } catch (error) {
      if (error instanceof BackupError) {
        showToast(t(`data.error.${error.code}`, { detail: error.detail }), {
          tone: 'error',
          duration: 8000,
        });
      } else {
        showError(error, t('common.error'));
      }
    }
  }

  async function restore() {
    if (!pending || busy) return;
    busy = true;
    try {
      await importBackup(pending.backup, mode);
      restoreOpen = false;
      const installed = new Set((await listInstalledPacks()).map((pack) => pack.id));
      const missing = pending.backup.data.packs.filter((id) => !installed.has(id));
      showToast(
        missing.length
          ? `${t('data.restored')}. ${t('data.packsNote', { packs: missing.join(', ') })}`
          : t('data.restored'),
        { duration: missing.length ? 9000 : 3000 },
      );
      pending = null;
    } catch (error) {
      showError(error, t('common.error'));
    } finally {
      busy = false;
    }
  }

  async function exportCsv(kind: CsvKind) {
    try {
      const csv = await buildCsv(kind, i18n.locale);
      // The BOM makes spreadsheet apps read UTF-8 (accents) correctly.
      await exportFile(
        `openfit-${kind}-${clock.today}.csv`,
        `\uFEFF${csv}`,
        'text/csv;charset=utf-8',
      );
    } catch (error) {
      showError(error, t('common.error'));
    }
  }

  async function persist() {
    const granted = await requestPersistentStorage();
    await refreshStorage();
    if (!granted) showToast(t('data.persistDenied'));
  }

  async function deleteEverything() {
    const choice = await askChoice({
      title: t('data.deleteAll'),
      message: t('data.deleteConfirm1'),
      confirmLabel: t('data.deleteConfirmContinue'),
      alternateLabel: t('data.deleteConfirmExport'),
      danger: true,
    });
    if (choice === 'cancel') return;
    if (choice === 'alternate') {
      const exported = await exportBackupFile().catch((error: unknown) => {
        showError(error, t('common.error'));
        return false;
      });
      if (!exported) return;
    }
    const confirmed = await confirmAction({
      title: t('data.deleteAll'),
      message: t('data.deleteAllHint'),
      confirmLabel: t('common.delete'),
      danger: true,
      typeToConfirm: t('data.deleteWord'),
    });
    if (!confirmed) return;
    try {
      await deleteAllData();
      await deleteDeviceCopy();
      showToast(t('data.deleted'));
      navigate('/welcome', { replace: true });
    } catch (error) {
      showError(error, t('common.error'));
    }
  }

  const summaryText = $derived(
    pending
      ? t('data.restoreSummary', {
          date: backupDateLabel(pending.backup),
          entries: pending.summary.entries,
          foods: pending.summary.foods,
          meals: pending.summary.meals,
          weights: pending.summary.weights,
        })
      : '',
  );
</script>

<PageHeader title={t('data.title')} back="/settings" />

<div class="stack-lg">
  <p class="muted">{t('data.intro')}</p>

  <section class="card stack">
    <h2>{t('data.backup')}</h2>
    <p class="small muted">
      {t('data.lastBackup', {
        when: lastBackup.value ? fmtRelativeTime(lastBackup.value) : t('common.never'),
      })}
    </p>
    <button class="btn btn-primary" type="button" onclick={() => exportBackup(false)}>
      <Icon name="download" size={18} />
      {t('data.export')}
    </button>
    {#if shareAvailable}
      <button class="btn" type="button" onclick={() => exportBackup(true)}>
        <Icon name="share" size={18} />
        {t('data.share')}
      </button>
    {/if}
    <button class="btn" type="button" onclick={chooseBackup}>
      <Icon name="upload" size={18} />
      {t('data.restore')}
    </button>
    <p class="subtle tiny">{t('data.restoreHint')}</p>
  </section>

  <section class="card stack">
    <div>
      <h2>{t('data.csv')}</h2>
      <p class="subtle small">{t('data.csvHint')}</p>
    </div>
    <ul class="list flat">
      {#each CSV_KINDS as kind (kind)}
        <li>
          <button class="list-item" type="button" onclick={() => exportCsv(kind)}>
            <span class="main"><span class="title">{t(`data.csv.${kind}`)}</span></span>
            <Icon name="download" size={18} />
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card stack">
    <h2>{t('data.storage')}</h2>
    {#if IS_NATIVE}
      <p class="small">{t('data.deviceCopy')}</p>
    {:else if storage}
      <p class="small">{storage.persisted ? t('data.persisted') : t('data.notPersisted')}</p>
      {#if storage.usage !== null && storage.quota !== null}
        <p class="subtle tiny">
          {t('data.usage', { used: fmtBytes(storage.usage), quota: fmtBytes(storage.quota) })}
        </p>
      {/if}
      {#if storage.persisted === false}
        <button class="btn" type="button" onclick={persist}>{t('data.persist')}</button>
      {/if}
    {/if}
  </section>

  <section class="card stack danger-zone">
    <h2>{t('data.danger')}</h2>
    <p class="small muted">{t('data.deleteAllHint')}</p>
    <button class="btn btn-danger" type="button" onclick={deleteEverything}>
      <Icon name="trash" size={18} />
      {t('data.deleteAll')}
    </button>
  </section>
</div>

<Sheet bind:open={restoreOpen} title={t('data.restore')} onclose={() => (pending = null)}>
  <div class="stack">
    <p>{summaryText}</p>
    <fieldset class="modes">
      <legend class="visually-hidden">{t('data.restore')}</legend>
      <label class="mode" class:selected={mode === 'replace'}>
        <input type="radio" name="restore-mode" value="replace" bind:group={mode} />
        <span>
          <strong>{t('data.mode.replace')}</strong>
          <span class="muted small">{t('data.mode.replaceHint')}</span>
        </span>
      </label>
      <label class="mode" class:selected={mode === 'merge'}>
        <input type="radio" name="restore-mode" value="merge" bind:group={mode} />
        <span>
          <strong>{t('data.mode.merge')}</strong>
          <span class="muted small">{t('data.mode.mergeHint')}</span>
        </span>
      </label>
    </fieldset>
  </div>
  {#snippet footer()}
    <button class="btn btn-primary btn-block" type="button" onclick={restore} disabled={busy}>
      {t('data.restoreConfirm')}
    </button>
  {/snippet}
</Sheet>

<style>
  .flat {
    box-shadow: none;
  }

  .danger-zone h2 {
    color: var(--danger);
  }

  .modes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .mode {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .mode.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .mode input {
    margin-top: 4px;
    accent-color: var(--accent);
  }

  .mode span {
    display: flex;
    flex-direction: column;
  }
</style>
