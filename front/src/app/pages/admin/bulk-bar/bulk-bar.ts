import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * "Tout sélectionner" for the items shown, and the deletion of those ticked.
 */
@Component({
  selector: 'yona-bulk-bar',
  imports: [Icon],
  template: `
    <label class="checkbox-field">
      <input
        type="checkbox"
        [checked]="allShown()"
        [indeterminate]="count() > 0 && !allShown()"
        (change)="toggleAll.emit()"
      />
      Tout sélectionner{{ shownLabel() ? ' (' + shownLabel() + ')' : '' }}
    </label>
    @if (count()) {
      <span class="count" aria-live="polite">{{ count() }} sélectionné{{ count() > 1 ? 's' : '' }}</span>
      <button type="button" class="link-button" (click)="cleared.emit()">Désélectionner</button>
      <button type="button" class="delete" [disabled]="busy()" (click)="deleted.emit()">
        <svg yonaIcon="trash" [size]="16"></svg>
        {{ deleteLabel() }}
      </button>
    }
  `,
  styleUrl: './bulk-bar.scss',
  host: { role: 'group', 'aria-label': 'Sélection multiple' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkBar {
  /** Ticked items, on this page or not. */
  readonly count = input.required<number>();
  /** Every item shown is ticked. */
  readonly allShown = input.required<boolean>();
  /** What "Tout sélectionner" covers, e.g. "cette page". */
  readonly shownLabel = input('');
  readonly busy = input(false);
  readonly deleteLabel = input('Supprimer la sélection');

  readonly toggleAll = output();
  readonly cleared = output();
  readonly deleted = output();
}
