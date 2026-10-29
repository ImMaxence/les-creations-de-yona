import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { ImageUploads } from '../../../core/api/image-uploads';
import { chooseCategoryImage } from '../../../core/api/generated/fn/admin-categories/choose-category-image';
import { createCategory } from '../../../core/api/generated/fn/admin-categories/create-category';
import { deleteCategories } from '../../../core/api/generated/fn/admin-categories/delete-categories';
import { deleteCategory } from '../../../core/api/generated/fn/admin-categories/delete-category';
import { updateCategory } from '../../../core/api/generated/fn/admin-categories/update-category';
import { replaceCategoryImage } from '../../../core/api/generated/fn/admin-categories/replace-category-image';
import { CategoryResponse } from '../../../core/api/generated/models/category-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { THEMES, Theme, themeLabel } from '../../../shared/format/themes';
import { Button } from '../../../shared/ui/button/button';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { FilterChip } from '../filter-chip/filter-chip';
import { ADMIN_CATEGORIES_QUERY } from './admin-categories-query';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_NAME_LENGTH = 60;

/** A category's theme as chosen here: "BOTH" for a category holding sweet and savory recipes. */
type ThemeChoice = Theme | 'BOTH';

const THEME_OPTIONS: SelectOption<ThemeChoice>[] = [
  ...THEMES.map(({ value, label }) => ({
    value,
    label,
    hint: `Ses recettes sont ${label.toLowerCase()}es, sans rien à choisir`,
  })),
  { value: 'BOTH', label: 'Les deux', hint: 'Chaque recette choisit le sien (apéritifs, brunch…)' },
];

/**
 * Categories also feed the navbar and the home page: SiteData is reloaded after each change. Each
 * has a theme (sweet, savory, or both), given to the recipes whose main category it is: it sorts
 * the categories under "Sucré" and "Salé" in the navbar.
 */
@Component({
  selector: 'yona-admin-categories',
  imports: [Icon, RouterLink, BulkBar, Button, FilterChip, ImageUpload, Select],
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
  protected readonly newTheme = signal<ThemeChoice>('BOTH');
  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly themeChoice = (category: CategoryResponse): ThemeChoice => category.theme ?? 'BOTH';
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
      this.toaster.error('Donnez un nom à la catégorie');
      return;
    }
    const theme = this.newTheme() === 'BOTH' ? undefined : (this.newTheme() as Theme);
    if (!(await attempt(this.api.invoke(createCategory, { body: { name, theme } }))).ok) {
      return;
    }
    this.newName.set('');
    this.newTheme.set('BOTH');
    this.toaster.success(`Catégorie « ${name} » créée`);
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
    if (!(await attempt(this.api.invoke(updateCategory, { id: category.id, body: { name, theme: category.theme } }))).ok) {
      return;
    }
    this.editingId.set(null);
    this.toaster.success('Catégorie renommée');
    await this.siteData.load();
  }

  /**
   * Sweet, savory or both. A theme goes to the recipes whose main category it is, after
   * confirmation; back to "both", they keep the one they have.
   */
  protected async changeTheme(category: CategoryResponse, choice: ThemeChoice | undefined): Promise<void> {
    const theme = choice === 'BOTH' || choice === undefined ? undefined : choice;
    if (theme === (category.theme ?? undefined)) {
      return;
    }
    const confirmed =
      !theme ||
      (await this.confirm.ask({
        title: `Passer « ${category.name} » en ${themeLabel(theme)} ?`,
        message: `Les recettes dont c'est la catégorie principale deviennent ${themeLabel(theme).toLowerCase()}es`,
        confirmLabel: `Passer en ${themeLabel(theme)}`,
      }));
    if (!confirmed) {
      // The menu shows the theme kept
      await this.siteData.load();
      return;
    }
    if ((await attempt(this.api.invoke(updateCategory, { id: category.id, body: { name: category.name, theme } }))).ok) {
      this.toaster.success(theme ? `« ${category.name} » et ses recettes passent en ${themeLabel(theme)}` : `« ${category.name} » contient les deux`);
      await this.siteData.load();
    }
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
      this.toaster.success('Photo enregistrée');
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
      this.toaster.success(imageId ? 'Photo enregistrée' : 'Photo retirée, elle reste dans la galerie');
      await this.siteData.load();
    }
  }

  /** "Retoucher": already in place, the categories are read again to show it. */
  protected async onRetouched(): Promise<void> {
    await this.siteData.load();
  }

  protected async remove(category: CategoryResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Mettre la catégorie à la corbeille ?',
      message: `« ${category.name} » quitte le site et reste 30 jours dans la corbeille, sa photo reste dans la galerie. Impossible tant qu'elle contient des recettes`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed || !(await attempt(this.api.invoke(deleteCategory, { id: category.id }))).ok) {
      return;
    }
    this.toaster.success('Catégorie mise à la corbeille');
    if (this.selection.has(category.id)) {
      this.selection.toggle(category.id);
    }
    await this.siteData.load();
  }

  /** All or none: the API refuses if one of them still contains recipes, and names it. */
  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Mettre ${count} catégories à la corbeille ?` : 'Mettre la catégorie à la corbeille ?',
      message:
        "Elles restent 30 jours dans la corbeille, leurs photos dans la galerie. Impossible si l'une d'elles contient encore des recettes : rien n'est alors supprimé",
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteCategories, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} catégories mises à la corbeille` : 'Catégorie mise à la corbeille');
      this.selection.clear();
      await this.siteData.load();
    }
  }
}
