import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toaster } from './toaster';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'yona-toasts',
  imports: [Icon],
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
            <svg yonaIcon="circle-alert" [size]="20"></svg>
          } @else {
            <svg yonaIcon="circle-check" [size]="20"></svg>
          }
          <span class="toast__message">{{ toast.message }}</span>
          <button type="button" class="toast__close" aria-label="Fermer" (click)="toaster.dismiss(toast.id)">
            <svg yonaIcon="x" [size]="16"></svg>
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
