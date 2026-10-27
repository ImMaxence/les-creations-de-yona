import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { uploadImage } from '../../../core/api/generated/fn/admin-images/upload-image';
import { Api } from '../../../core/api/generated/api';
import { deleteImage } from '../../../core/api/generated/fn/admin-images/delete-image';
import { deleteImages } from '../../../core/api/generated/fn/admin-images/delete-images';
import { listImages } from '../../../core/api/generated/fn/admin-images/list-images';
import { GalleryImage } from '../../../core/api/generated/models/gallery-image';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { ParisDatePipe } from '../../../shared/format/paris-date.pipe';
import { Button } from '../../../shared/ui/button/button';
import { CoverImage } from '../../../shared/ui/cover-image/cover-image';
import { PHOTO_ACCEPT, photoFileError } from '../../../shared/ui/image-upload/photo-file';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { ADMIN_CATEGORIES_QUERY } from '../categories/admin-categories-query';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

type KindFilter = 'ALL' | GalleryImage['kind'];
type UsageFilter = 'ALL' | 'USED' | 'UNUSED';

const PAGE_SIZE = 24;

/**
 * Every uploaded photo is kept, even once replaced or removed from its recipe: here the admin
 * sees which ones are unused and deletes them, or shows them again from a recipe or category.
 */
@Component({
  selector: 'yona-admin-gallery',
  imports: [
    Icon,
    RouterLink,
    BulkBar,
    Button,
    CoverImage,
    Pagination,
    Select,
    ParisDatePipe,
  ],
  templateUrl: './admin-gallery.html',
  styleUrl: './admin-gallery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminGallery {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);
  private readonly imageUploads = inject(ImageUploads);

  protected readonly kindOptions: SelectOption<KindFilter>[] = [
    { value: 'ALL', label: 'Recettes et catégories' },
    { value: 'RECIPE', label: 'Envoyées pour une recette' },
    { value: 'CATEGORY', label: 'Envoyées pour une catégorie' },
    { value: 'GALLERY', label: 'Envoyées dans la galerie' },
    { value: 'SITE', label: 'Envoyées pour « À propos »' },
    { value: 'PINTEREST', label: 'Photos Pinterest (verticales)' },
  ];
  protected readonly usageOptions: SelectOption<UsageFilter>[] = [
    { value: 'ALL', label: 'Toutes les images' },
    { value: 'USED', label: 'Utilisées' },
    { value: 'UNUSED', label: 'Non utilisées' },
  ];
  protected readonly accept = PHOTO_ACCEPT;
  /** Share of the new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly uploadPercent = computed(() => Math.round((this.uploadProgress() ?? 0) * 100));
  /** Once sent, the server still makes its 800 and 1600 px versions. */
  protected readonly uploadLabel = computed(() =>
    this.uploadPercent() < 100 ? `Envoi de la photo… ${this.uploadPercent()} %` : 'Préparation de la photo…',
  );
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

  /** "Ajouter une photo": shown first once uploaded (unused, the most recent). */
  protected async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset, so that choosing the same file again still triggers a change
    input.value = '';
    if (!file) {
      return;
    }
    const error = photoFileError(file);
    if (error) {
      this.toaster.error(error);
      return;
    }
    this.uploadProgress.set(0);
    const upload = await attempt(
      this.imageUploads.send(uploadImage.PATH, file, (sent) => this.uploadProgress.set(sent), 'POST'),
    );
    this.uploadProgress.set(null);
    if (upload.ok) {
      this.toaster.success('Photo ajoutée à la galerie.');
      if (this.kind() !== 'ALL' && this.kind() !== 'GALLERY') {
        this.kind.set('ALL');
      }
      if (this.usage() === 'USED') {
        this.usage.set('ALL');
      }
      this.page.set(0);
      this.images.reload();
    }
  }

  /** Titles of the recipes, names of the categories, and the "À propos" section showing it. */
  protected usedBy(image: GalleryImage): string[] {
    return [
      ...image.recipes.map((recipe) => recipe.title),
      ...image.categories.map((category) => category.name),
      ...(image.aboutPage ? ['À propos'] : []),
    ];
  }

  /** The back-office lists, filtered on this photo. */
  protected recipesLink(image: GalleryImage): Record<string, string> {
    return { [ADMIN_RECIPES_QUERY.image]: image.id };
  }

  protected categoriesLink(image: GalleryImage): Record<string, string> {
    return { [ADMIN_CATEGORIES_QUERY.image]: image.id };
  }

  protected async remove(image: GalleryImage): Promise<void> {
    const usedBy = this.usedBy(image);
    const confirmed = await this.confirm.ask({
      title: "Mettre l'image à la corbeille ?",
      message: usedBy.length
        ? `Elle disparaîtra de ${usedBy.map((name) => `« ${name} »`).join(', ')}, qui afficheront le visuel par défaut. Elle reste 30 jours dans la corbeille : restaurée, elle y revient.`
        : "Elle n'est utilisée nulle part. Elle reste 30 jours dans la corbeille, d'où elle peut être restaurée.",
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteImage, { id: image.id }))).ok) {
      this.toaster.success('Image mise à la corbeille.');
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
      title: count > 1 ? `Mettre ${count} images à la corbeille ?` : "Mettre l'image à la corbeille ?",
      message:
        'Les recettes et catégories qui en affichent une passeront au visuel par défaut. Elles restent 30 jours dans la corbeille, d\'où elles peuvent être restaurées.',
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteImages, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} images mises à la corbeille.` : 'Image mise à la corbeille.');
      this.selection.clear();
      this.images.reload();
      await this.siteData.load();
    }
  }
}
