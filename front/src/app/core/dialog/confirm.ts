import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

/** Asks before a destructive action: const ok = await confirm.ask({ ... }). */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly pendingState = signal<PendingConfirm | null>(null);
  readonly pending = this.pendingState.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    this.pendingState()?.resolve(false);
    return new Promise((resolve) => this.pendingState.set({ ...request, resolve }));
  }

  answer(confirmed: boolean): void {
    this.pendingState()?.resolve(confirmed);
    this.pendingState.set(null);
  }
}
