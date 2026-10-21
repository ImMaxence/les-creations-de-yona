import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideTrash2 } from '@lucide/angular';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteImage } from '../../../core/api/generated/fn/admin-images/delete-image';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Select, SelectOption } from '../../../shared/ui/select/select';

type KindFilter = 'ALL' | GalleryImage['kind'];

const PAGE_SIZE = 24;

@Component({
  selector: 'yona-admin-gallery',
  imports: [CoverImage, Select, ParisDatePipe, LucideChevronLeft, LucideChevronRight, LucideTrash2],
  templateUrl: './admin-gallery.html',
  styleUrl: './admin-gallery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminGallery {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly kindOptions: SelectOption<KindFilter>[] = [
    { value: 'ALL', label: 'Toutes les images' },
    { value: 'RECIPE', label: 'Recettes' },
    { value: 'CATEGORY', label: 'Catégories' },
  ];
  protected readonly kind = signal<KindFilter>('ALL');
  protected readonly page = linkedSignal({ source: this.kind, computation: () => 0 });
  protected readonly images = resource({
    params: () => ({
      kind: this.kind() === 'ALL' ? undefined : (this.kind() as GalleryImage['kind']),
      page: this.page(),
      size: PAGE_SIZE,
    }),
    loader: ({ params }) => this.api.invoke(listImages, params),
  });
  protected readonly totalPages = computed(() => this.images.value()?.totalPages ?? 0);

  protected async remove(image: GalleryImage): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "Supprimer l'image ?",
      message: image.usedBy
        ? `Elle disparaîtra de « ${image.usedBy} », qui affichera le visuel par défaut.`
        : "Elle n'est utilisée nulle part.",
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteImage, { id: image.id }))).ok) {
      this.toaster.success('Image supprimée.');
      this.images.reload();
      if (image.kind === 'CATEGORY') {
        await this.siteData.load();
      }
    }
  }
}
