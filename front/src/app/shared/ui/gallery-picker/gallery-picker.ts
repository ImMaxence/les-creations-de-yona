import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  linkedSignal,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { CoverImage } from '../cover-image/cover-image';

const PAGE_SIZE = 12;

/**
 * Back-office: picks a photo already in the gallery, in a modal <dialog>. The gallery is only
 * loaded once the dialog is open. Open it with open(); the chosen image comes out of (chosen).
 */
@Component({
  selector: 'yona-gallery-picker',
  imports: [CoverImage, LucideChevronLeft, LucideChevronRight, LucideX],
  templateUrl: './gallery-picker.html',
  styleUrl: './gallery-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPicker {
  readonly chosen = output<string>();

  private readonly api = inject(Api);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly isOpen = signal(false);
  protected readonly onlyUnused = signal(true);
  protected readonly page = linkedSignal({ source: this.onlyUnused, computation: () => 0 });
  protected readonly images = resource({
    params: () =>
      this.isOpen()
        ? { used: this.onlyUnused() ? false : undefined, page: this.page(), size: PAGE_SIZE }
        : undefined,
    loader: ({ params }) => this.api.invoke(listImages, params),
  });
  protected readonly totalPages = computed(() => this.images.value()?.totalPages ?? 0);

  open(): void {
    this.dialog().nativeElement.showModal();
    this.isOpen.set(true);
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onClosed(): void {
    this.isOpen.set(false);
  }

  protected choose(image: GalleryImage): void {
    this.chosen.emit(image.id);
    this.close();
  }

  protected usage(image: GalleryImage): string {
    const usedBy = [...image.recipes.map((recipe) => recipe.title), ...image.categories.map((category) => category.name)];
    return usedBy.length ? usedBy.join(', ') : 'Non utilisée';
  }
}
