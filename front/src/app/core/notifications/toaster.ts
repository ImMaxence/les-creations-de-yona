import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DISPLAY_MS = 5000;

/** Short messages shown at the bottom of the screen, read out by screen readers. */
@Injectable({ providedIn: 'root' })
export class Toaster {
  private nextId = 0;
  private readonly toastsState = signal<Toast[]>([]);
  readonly toasts = this.toastsState.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string): void {
    const id = this.nextId++;
    this.toastsState.update((toasts) => [...toasts, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), DISPLAY_MS);
  }
}
