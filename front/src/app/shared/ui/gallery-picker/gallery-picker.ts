import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ParisDatePipe } from '../../format/paris-date.pipe';
import { CoverImage } from '../cover-image/cover-image';
import { Dialog } from '../dialog/dialog';
import { InfiniteList } from '../infinite-scroll/infinite-list';
import { InfiniteScroll } from '../infinite-scroll/infinite-scroll';
import { Segmented } from '../segmented/segmented';
import { Skeleton } from '../skeleton/skeleton';

const PAGE_SIZE = 12;

/**
 * Back-office: picks a photo already in the gallery, the most recent first, in a dialog. The
 * gallery is only loaded once the dialog is open. Open it with open(); the chosen image comes out
 * of (chosen). Landscape photos only, or vertical Pinterest photos only (portrait).
 */
@Component({
  selector: 'yona-gallery-picker',
  imports: [CoverImage, Dialog, InfiniteScroll, ParisDatePipe, Segmented, Skeleton],
  templateUrl: './gallery-picker.html',
  styleUrl: './gallery-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPicker {
  readonly chosen = output<string>();
  readonly portrait = input(false);

  private readonly api = inject(Api);

  protected readonly isOpen = signal(false);
  protected readonly onlyUnused = signal(true);
  protected readonly images = new InfiniteList({
    params: () =>
      this.isOpen()
        ? { used: this.onlyUnused() ? false : undefined, portrait: this.portrait(), size: PAGE_SIZE, sort: ['createdAt,desc'] }
        : undefined,
    load: (page, params) => this.api.invoke(listImages, { ...params, page }),
    key: (image) => image.id,
  });

  open(): void {
    this.isOpen.set(true);
  }

  protected choose(image: GalleryImage): void {
    this.chosen.emit(image.id);
    this.isOpen.set(false);
  }

  protected usage(image: GalleryImage): string {
    const usedBy = [
      ...image.recipes.map((recipe) => recipe.title),
      ...image.categories.map((category) => category.name),
      ...image.menus.map((menu) => menu.title),
      ...(image.aboutPage ? ['À propos'] : []),
    ];
    return usedBy.length ? usedBy.join(', ') : 'Non utilisée';
  }
}
