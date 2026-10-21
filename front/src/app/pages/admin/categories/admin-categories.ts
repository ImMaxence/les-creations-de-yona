import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideCheck, LucidePencil, LucidePlus, LucideTrash2, LucideX } from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createCategory } from '../../../core/api/generated/fn/admin-categories/create-category';
import { deleteCategory } from '../../../core/api/generated/fn/admin-categories/delete-category';
import { renameCategory } from '../../../core/api/generated/fn/admin-categories/rename-category';
import { replaceCategoryImage } from '../../../core/api/generated/fn/admin-categories/replace-category-image';
import { CategoryResponse } from '../../../core/api/generated/models/category-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { Button } from '../../../shared/ui/button/button';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';

const MAX_NAME_LENGTH = 60;

/** Categories also feed the navbar and the home page: SiteData is reloaded after each change. */
@Component({
  selector: 'yona-admin-categories',
  imports: [Button, ImageUpload, LucideCheck, LucidePencil, LucidePlus, LucideTrash2, LucideX],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminCategories {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly categories = this.siteData.categories;
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly newName = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly editedName = signal('');
  protected readonly uploadingId = signal<number | null>(null);

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
    const upload = await attempt(this.api.invoke(replaceCategoryImage, { id: category.id, body: { file } }));
    this.uploadingId.set(null);
    if (upload.ok) {
      this.toaster.success('Photo enregistrée.');
      await this.siteData.load();
    }
  }

  protected async remove(category: CategoryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Supprimer la catégorie ?',
      message: `« ${category.name} » sera supprimée. Impossible tant qu'elle contient des recettes.`,
      confirmLabel: 'Supprimer',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteCategory, { id: category.id }))).ok) {
      return;
    }
    this.toaster.success('Catégorie supprimée.');
    await this.siteData.load();
  }
}
