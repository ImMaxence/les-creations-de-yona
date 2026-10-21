import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCircleAlert, LucideCircleCheck, LucideX } from '@lucide/angular';
import { Toaster } from './toaster';

@Component({
  selector: 'yona-toasts',
  imports: [LucideCircleAlert, LucideCircleCheck, LucideX],
  template: `
    <ul role="list" class="toasts" aria-live="polite">
      @for (toast of toaster.toasts(); track toast.id) {
        <li
          class="toast"
          [class.toast--error]="toast.kind === 'error'"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
          animate.enter="toast--enter"
          animate.leave="toast--leave"
        >
          @if (toast.kind === 'error') {
            <svg lucideCircleAlert [size]="20"></svg>
          } @else {
            <svg lucideCircleCheck [size]="20"></svg>
          }
          <span class="toast__message">{{ toast.message }}</span>
          <button type="button" class="toast__close" aria-label="Fermer" (click)="toaster.dismiss(toast.id)">
            <svg lucideX [size]="16"></svg>
          </button>
        </li>
      }
    </ul>
  `,
  styleUrl: './toasts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  protected readonly toaster = inject(Toaster);
}
