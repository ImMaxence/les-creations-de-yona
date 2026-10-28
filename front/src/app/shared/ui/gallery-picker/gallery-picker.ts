import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource, signal, viewChild } from '@angular/core';
import { Api } from '../../../core/api/generated/api';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { ParisDatePipe } from '../../format/paris-date.pipe';
import { CoverImage } from '../cover-image/cover-image';
import { Dialog } from '../dialog/dialog';
import { Pagination } from '../pagination/pagination';

const PAGE_SIZE = 12;

/**
 * Back-office: picks a photo already in the gallery, the most recent first, in a dialog. The
 * gallery is only loaded once the dialog is open. Open it with open(); the chosen image comes out
 * of (chosen). Landscape photos only, or vertical Pinterest photos only (portrait).
 */
@Component({
  selector: 'yona-gallery-picker',
  imports: [CoverImage, Dialog, Pagination, ParisDatePipe],
  templateUrl: './gallery-picker.html',
  styleUrl: './gallery-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPicker {
  readonly chosen = output<string>();
  readonly portrait = input(false);

  private readonly api = inject(Api);
  private readonly dialog = viewChild.required(Dialog);

  protected readonly isOpen = signal(false);
  protected readonly onlyUnused = signal(true);
  /** Starts at 1, as shown. */
  protected readonly page = linkedSignal({ source: this.onlyUnused, computation: () => 1 });
  protected readonly images = resource({
    params: () =>
      this.isOpen()
        ? {
            used: this.onlyUnused() ? false : undefined,
            portrait: this.portrait(),
            page: this.page() - 1,
            size: PAGE_SIZE,
            sort: ['createdAt,desc'],
          }
        : undefined,
    loader: ({ params }) => this.api.invoke(listImages, params),
  });
  protected readonly totalPages = computed(() => this.images.value()?.totalPages ?? 0);
  protected readonly totalElements = computed(() => this.images.value()?.totalElements ?? 0);

  open(): void {
    this.page.set(1);
    this.isOpen.set(true);
  }

  protected changePage(page: number): void {
    this.page.set(page);
    this.dialog().scrollToTop();
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
