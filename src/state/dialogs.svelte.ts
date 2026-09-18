/** Promise-based confirmation dialogs, rendered by components/DialogHost.svelte. */

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** The user must type this word to enable the confirm button. */
  typeToConfirm?: string;
  /** Optional third button; resolves with 'alternate'. */
  alternateLabel?: string;
}

export type ConfirmResult = 'confirm' | 'cancel' | 'alternate';

interface Pending extends ConfirmRequest {
  resolve: (result: ConfirmResult) => void;
}

export const dialogs = $state<{ current: Pending | null }>({ current: null });

export function askChoice(request: ConfirmRequest): Promise<ConfirmResult> {
  dialogs.current?.resolve('cancel');
  return new Promise((resolve) => {
    dialogs.current = { ...request, resolve };
  });
}

export async function confirmAction(request: ConfirmRequest): Promise<boolean> {
  return (await askChoice(request)) === 'confirm';
}

export function settleDialog(result: ConfirmResult): void {
  const current = dialogs.current;
  dialogs.current = null;
  current?.resolve(result);
}
