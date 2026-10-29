import { Injectable, signal } from '@angular/core';
import { IconName } from '../../shared/ui/icon/icons';

export type ToastKind = 'success' | 'error' | 'info';

/** A button in the toast: "Mettre à jour". */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Instead of the icon of its kind. */
  icon?: IconName;
  action?: ToastAction;
}

export interface InfoOptions {
  icon?: IconName;
  action?: ToastAction;
  /** Shown until closed or dismissed by the code (connection lost), not for a few seconds. */
  persistent?: boolean;
}

const DISPLAY_MS = 5000;

/** Short messages shown at the bottom of the screen, read out by screen readers. */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private nextId = 0;
  private readonly toastsState = signal<Toast[]>([]);
  readonly toasts = this.toastsState.asReadonly();

  success(message: string): void {
    this.show({ kind: 'success', message }, false);
  }

  error(message: string): void {
    this.show({ kind: 'error', message }, false);
  }

  /** A piece of news rather than the outcome of an action; returns its id, to dismiss it later. */
  info(message: string, options: InfoOptions = {}): number {
    return this.show({ kind: 'info', message, icon: options.icon, action: options.action }, !!options.persistent);
  }

  dismiss(id: number): void {
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(toast: Omit<Toast, 'id'>, persistent: boolean): number {
    const id = this.nextId++;
    this.toastsState.update((toasts) => [...toasts, { ...toast, id }]);
    if (!persistent) {
      setTimeout(() => this.dismiss(id), DISPLAY_MS);
    }
    return id;
  }
}
