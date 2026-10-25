import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideTrash2 } from '@lucide/angular';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteImage } from '../../../core/api/generated/fn/admin-images/delete-image';
import { deleteImages } from '../../../core/api/generated/fn/admin-images/delete-images';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { Selection } from '../selection';

type KindFilter = 'ALL' | GalleryImage['kind'];
type UsageFilter = 'ALL' | 'USED' | 'UNUSED';

const PAGE_SIZE = 24;

/**
 * Every uploaded photo is kept, even once replaced or removed from its recipe: here the admin
 * sees which ones are unused and deletes them, or shows them again from a recipe or category.
 */
@Component({
  selector: 'yona-admin-gallery',
  imports: [BulkBar, CoverImage, Select, ParisDatePipe, LucideChevronLeft, LucideChevronRight, LucideTrash2],
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
    { value: 'ALL', label: 'Recettes et catégories' },
    { value: 'RECIPE', label: 'Envoyées pour une recette' },
    { value: 'CATEGORY', label: 'Envoyées pour une catégorie' },
  ];
  protected readonly usageOptions: SelectOption<UsageFilter>[] = [
    { value: 'ALL', label: 'Toutes les images' },
    { value: 'USED', label: 'Utilisées' },
    { value: 'UNUSED', label: 'Non utilisées' },
  ];
  protected readonly kind = signal<KindFilter>('ALL');
  protected readonly usage = signal<UsageFilter>('ALL');
  protected readonly page = linkedSignal({ source: () => [this.kind(), this.usage()], computation: () => 0 });
  protected readonly images = resource({
    params: () => ({
      kind: this.kind() === 'ALL' ? undefined : (this.kind() as GalleryImage['kind']),
      used: this.usage() === 'ALL' ? undefined : this.usage() === 'USED',
      page: this.page(),
      size: PAGE_SIZE,
    }),
    loader: ({ params }) => this.api.invoke(listImages, params),
  });
  protected readonly totalPages = computed(() => this.images.value()?.totalPages ?? 0);

  /** Kept from one page to another. */
  protected readonly selection = new Selection<string>();
  protected readonly shownIds = computed(() => this.images.value()?.content.map((image) => image.id) ?? []);
  protected readonly deleting = signal(false);

  protected async remove(image: GalleryImage): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "Supprimer l'image ?",
      message: image.usedBy.length
        ? `Elle disparaîtra de ${image.usedBy.map((name) => `« ${name} »`).join(', ')}, qui afficheront le visuel par défaut.`
        : "Elle n'est utilisée nulle part. Elle sera supprimée définitivement.",
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteImage, { id: image.id }))).ok) {
      this.toaster.success('Image supprimée.');
      if (this.selection.has(image.id)) {
        this.selection.toggle(image.id);
      }
      this.images.reload();
      // A category may have shown it: the navbar and the home page follow
      await this.siteData.load();
    }
  }

  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Supprimer ${count} images ?` : "Supprimer l'image ?",
      message:
        'Elles seront supprimées définitivement. Les recettes et catégories qui en affichent une passeront au visuel par défaut.',
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteImages, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} images supprimées.` : 'Image supprimée.');
      this.selection.clear();
      this.images.reload();
      await this.siteData.load();
    }
  }
}
