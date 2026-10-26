import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { chooseCategoryImage } from '../../../core/api/generated/fn/admin-categories/choose-category-image';
import { createCategory } from '../../../core/api/generated/fn/admin-categories/create-category';
import { deleteCategories } from '../../../core/api/generated/fn/admin-categories/delete-categories';
import { deleteCategory } from '../../../core/api/generated/fn/admin-categories/delete-category';
import { renameCategory } from '../../../core/api/generated/fn/admin-categories/rename-category';
import { replaceCategoryImage } from '../../../core/api/generated/fn/admin-categories/replace-category-image';
import { CategoryResponse } from '../../../core/api/generated/models/category-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { Button } from '../../../shared/ui/button/button';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { FilterChip } from '../filter-chip/filter-chip';
import { ADMIN_CATEGORIES_QUERY } from './admin-categories-query';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_NAME_LENGTH = 60;

/** Categories also feed the navbar and the home page: SiteData is reloaded after each change. */
@Component({
  selector: 'yona-admin-categories',
  imports: [Icon, RouterLink, BulkBar, Button, FilterChip, ImageUpload],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminCategories {
  /** ?photo=: from the gallery, only the categories showing this photo. */
  readonly photo = input<string>();

  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = computed(() => {
    const imageId = this.photo();
    const all = this.siteData.categories();
    return imageId ? all.filter((category) => category.imageId === imageId) : all;
  });
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly newName = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly editedName = signal('');
  protected readonly uploadingId = signal<number | null>(null);
  /** Share of a new photo sent (0 to 1) while it uploads, for the category uploadingId. */
  protected readonly uploadProgress = signal<number | null>(null);

  protected readonly selection = new Selection<number>();
  protected readonly categoryIds = computed(() => this.categories().map((category) => category.id));
  protected readonly deleting = signal(false);

  protected clearImage(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [ADMIN_CATEGORIES_QUERY.image]: null },
      queryParamsHandling: 'merge',
    });
  }

  /** The back-office recipe list, filtered on this category. */
  protected recipesLink(category: CategoryResponse): Record<string, string> {
    return { [ADMIN_RECIPES_QUERY.category]: category.slug };
  }

  protected readNewName(event: Event): void {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  protected readEditedName(event: Event): void {
    this.editedName.set((event.target as HTMLInputElement).value);
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom à la catégorie.');
      return;
    }
    if (!(await attempt(this.api.invoke(createCategory, { body: { name } }))).ok) {
      return;
    }
    this.newName.set('');
    this.toaster.success(`Catégorie « ${name} » créée.`);
    await this.siteData.load();
  }

  protected startRename(category: CategoryResponse): void {
    this.editingId.set(category.id);
    this.editedName.set(category.name);
  }

  protected async rename(category: CategoryResponse): Promise<void> {
    const name = this.editedName().trim();
    if (!name || name === category.name) {
      this.editingId.set(null);
      return;
    }
    if (!(await attempt(this.api.invoke(renameCategory, { id: category.id, body: { name } }))).ok) {
      return;
    }
    this.editingId.set(null);
    this.toaster.success('Catégorie renommée.');
    await this.siteData.load();
  }

  protected async uploadImage(category: CategoryResponse, file: File): Promise<void> {
    this.uploadingId.set(category.id);
    this.uploadProgress.set(0);
    const upload = await attempt(
      this.imageUploads.send(replaceCategoryImage.PATH.replace('{id}', String(category.id)), file, (sent) =>
        this.uploadProgress.set(sent),
      ),
    );
    this.uploadingId.set(null);
    this.uploadProgress.set(null);
    if (upload.ok) {
      this.toaster.success('Photo enregistrée.');
      await this.siteData.load();
    }
  }

  /** A photo of the gallery, or none (null): the previous one stays in the gallery. */
  protected async chooseImage(category: CategoryResponse, imageId: string | null): Promise<void> {
    this.uploadingId.set(category.id);
    const choice = await attempt(
      this.api.invoke(chooseCategoryImage, { id: category.id, body: { imageId: imageId ?? undefined } }),
    );
    this.uploadingId.set(null);
    if (choice.ok) {
      this.toaster.success(imageId ? 'Photo enregistrée.' : 'Photo retirée, elle reste dans la galerie.');
      await this.siteData.load();
    }
  }

  protected async remove(category: CategoryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer la catégorie ?',
      message: `« ${category.name} » sera supprimée, sa photo restera dans la galerie. Impossible tant qu'elle contient des recettes.`,
      confirmLabel: 'Supprimer',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteCategory, { id: category.id }))).ok) {
      return;
    }
    this.toaster.success('Catégorie supprimée.');
    if (this.selection.has(category.id)) {
      this.selection.toggle(category.id);
    }
    await this.siteData.load();
  }

  /** All or none: the API refuses if one of them still contains recipes, and names it. */
  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Supprimer ${count} catégories ?` : 'Supprimer la catégorie ?',
      message:
        "Leurs photos resteront dans la galerie. Impossible si l'une d'elles contient encore des recettes : rien n'est alors supprimé.",
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteCategories, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} catégories supprimées.` : 'Catégorie supprimée.');
      this.selection.clear();
      await this.siteData.load();
    }
  }
}
