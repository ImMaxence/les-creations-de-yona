import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';

/** An active filter without a field of its own (a photo, from the gallery), with its removal. */
@Component({
  selector: 'yona-filter-chip',
  imports: [CoverImage, LucideX],
  template: `
    @if (imageId(); as image) {
      <yona-cover-image class="thumb" [imageId]="image" [alt]="''" sizes="3rem" />
    }
    {{ label() }}
    <button type="button" class="clear" aria-label="Retirer ce filtre" (click)="cleared.emit()">
      <svg lucideX [size]="14"></svg>
    </button>
  `,
  styleUrl: './filter-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChip {
  readonly label = input.required<string>();
  readonly imageId = input<string>();
  readonly cleared = output();
}
