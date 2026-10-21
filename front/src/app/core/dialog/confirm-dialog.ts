import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { Button } from '../../shared/ui/button/button';
import { Confirm } from './confirm';

/** Native modal <dialog>: focus trap, Escape and inert page come with showModal(). */
@Component({
  selector: 'yona-confirm-dialog',
  imports: [Button],
  template: `
    <dialog #dialog class="confirm" aria-labelledby="confirm-title" (close)="confirm.answer(false)">
      @if (confirm.pending(); as request) {
        <h2 id="confirm-title">{{ request.title }}</h2>
        <p>{{ request.message }}</p>
        <div class="confirm__actions">
          <button yonaButton variant="secondary" type="button" (click)="confirm.answer(false)">Annuler</button>
          <button yonaButton type="button" class="confirm__danger" (click)="confirm.answer(true)">
            {{ request.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly confirm = inject(Confirm);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.confirm.pending() && !dialog.open) {
        dialog.showModal();
      } else if (!this.confirm.pending() && dialog.open) {
        dialog.close();
      }
    });
  }
}
