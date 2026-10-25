import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Button } from '../../shared/ui/button/button';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { Confirm, ConfirmRequest } from './confirm';

/** The question asked by Confirm, before a destructive action. Closing it in any way cancels. */
@Component({
  selector: 'yona-confirm-dialog',
  imports: [Button, Dialog],
  template: `
    <yona-dialog
      size="sm"
      role="alertdialog"
      [title]="request()?.title ?? ''"
      [open]="isOpen()"
      (closed)="confirm.answer(false)"
    >
      <p class="message">{{ request()?.message }}</p>
      <ng-container dialogActions>
        <button yonaButton variant="secondary" type="button" (click)="confirm.answer(false)">Annuler</button>
        <button yonaButton type="button" class="danger" (click)="confirm.answer(true)">
          {{ request()?.confirmLabel }}
        </button>
      </ng-container>
    </yona-dialog>
  `,
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly confirm = inject(Confirm);
  protected readonly isOpen = computed(() => this.confirm.pending() !== null);
  /** The last question, still shown while the dialog fades out. */
  protected readonly request = linkedSignal<ConfirmRequest | null, ConfirmRequest | null>({
    source: this.confirm.pending,
    computation: (pending, previous) => pending ?? previous?.value ?? null,
  });
}
