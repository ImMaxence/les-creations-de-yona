import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { ImageUploads } from '../../../core/api/image-uploads';
import { chooseMenuImage } from '../../../core/api/generated/fn/admin-menus/choose-menu-image';
import { createMenu } from '../../../core/api/generated/fn/admin-menus/create-menu';
import { deleteMenu } from '../../../core/api/generated/fn/admin-menus/delete-menu';
import { getAdminMenu } from '../../../core/api/generated/fn/admin-menus/get-admin-menu';
import { listAdminMenus } from '../../../core/api/generated/fn/admin-menus/list-admin-menus';
import { replaceMenuImage } from '../../../core/api/generated/fn/admin-menus/replace-menu-image';
import { updateMenu } from '../../../core/api/generated/fn/admin-menus/update-menu';
import { searchRecipes } from '../../../core/api/generated/fn/admin-recipes/search-recipes';
import { AdminMenu } from '../../../core/api/generated/models/admin-menu';
import { MenuRecipe } from '../../../core/api/generated/models/menu-recipe';
import { MenuSummary } from '../../../core/api/generated/models/menu-summary';
import { RecipeAdminSummary } from '../../../core/api/generated/models/recipe-admin-summary';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { menuLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';

const MAX_RECIPES = 12;
/** Largest page of the API: the recipes to choose from are read page after page. */
const PAGE_SIZE = 50;

/** The menu being written: a new one (id null) or one opened from the list. */
interface MenuDraft {
  id: number | null;
  title: string;
  intro: string;
  published: boolean;
  recipes: MenuRecipe[];
  /** Chosen for it; null: the photo of its first recipe. Saved at once, apart from the form. */
  imageId: string | null;
}

/**
 * "Menus": a few recipes put together for an occasion ("Menu de Noël"), shown on the site once
 * published, with its published recipes only. Its photo is the one chosen for it, or else the one
 * of its first recipe; chosen once the menu exists.
 */
@Component({
  selector: 'yona-admin-menus',
  imports: [Button, Icon, ImageUpload, RouterLink, Select],
  templateUrl: './admin-menus.html',
  styleUrl: './admin-menus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminMenus {
  private readonly api = inject(Api);
  private readonly imageUploads = inject(ImageUploads);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly maxRecipes = MAX_RECIPES;
  protected readonly menuLink = menuLink;
  protected readonly menus = resource({ loader: () => this.api.invoke(listAdminMenus) });
  /** Every recipe, drafts included, to choose from. */
  protected readonly allRecipes = resource({ loader: () => this.loadRecipes() });

  protected readonly draft = signal<MenuDraft | null>(null);
  protected readonly saving = signal(false);
  protected readonly savingImage = signal(false);
  /** Share of a new photo sent (0 to 1) while it uploads. */
  protected readonly uploadProgress = signal<number | null>(null);
  /** Those not in the menu yet; drafts marked as such. */
  protected readonly recipeOptions = computed<SelectOption<number>[]>(() => {
    const chosen = new Set(this.draft()?.recipes.map((recipe) => recipe.id));
    return (this.allRecipes.value() ?? [])
      .filter((recipe) => !chosen.has(recipe.id))
      .map((recipe) => ({ value: recipe.id, label: recipe.status === 'DRAFT' ? `${recipe.title} (brouillon)` : recipe.title }));
  });

  protected startNew(): void {
    this.draft.set({ id: null, title: '', intro: '', published: false, recipes: [], imageId: null });
  }

  protected async edit(menu: MenuSummary): Promise<void> {
    const found = await attempt(this.api.invoke(getAdminMenu, { id: menu.id }));
    if (found.ok) {
      this.open(found.value);
    }
  }

  protected update(change: Partial<MenuDraft>): void {
    this.draft.update((draft) => (draft ? { ...draft, ...change } : draft));
  }

  protected addRecipe(id: number): void {
    const recipe = this.allRecipes.value()?.find((candidate) => candidate.id === id);
    const draft = this.draft();
    if (recipe && draft && draft.recipes.length < MAX_RECIPES) {
      this.update({ recipes: [...draft.recipes, { id: recipe.id, title: recipe.title, status: recipe.status }] });
    }
  }

  protected removeRecipe(index: number): void {
    this.update({ recipes: this.draft()!.recipes.filter((_recipe, position) => position !== index) });
  }

  /** Up (-1) or down (+1) by one. */
  protected moveRecipe(index: number, direction: -1 | 1): void {
    const recipes = [...this.draft()!.recipes];
    const target = index + direction;
    [recipes[index], recipes[target]] = [recipes[target]!, recipes[index]!];
    this.update({ recipes });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const draft = this.draft();
    if (!draft) {
      return;
    }
    if (!draft.title.trim() || !draft.recipes.length) {
      this.toaster.error('Donnez un titre au menu et choisissez au moins une recette');
      return;
    }
    const body = {
      title: draft.title.trim(),
      intro: draft.intro.trim() || undefined,
      published: draft.published,
      recipeIds: draft.recipes.map((recipe) => recipe.id),
    };
    this.saving.set(true);
    const saved = await attempt(
      draft.id === null
        ? this.api.invoke(createMenu, { body })
        : this.api.invoke(updateMenu, { id: draft.id, body }),
    );
    this.saving.set(false);
    if (!saved.ok) {
      return;
    }
    if (draft.id === null) {
      // Left open: its photo can now be chosen
      this.toaster.success('Menu créé : vous pouvez maintenant lui choisir une photo');
      this.open(saved.value);
    } else {
      this.toaster.success(draft.published ? 'Menu enregistré et visible sur le site' : 'Menu enregistré, pas encore publié');
      this.draft.set(null);
    }
    this.reload();
  }

  protected async uploadImage(file: File): Promise<void> {
    const id = this.draft()?.id;
    if (id == null) {
      return;
    }
    this.uploadProgress.set(0);
    const upload = await attempt(
      this.imageUploads.send<AdminMenu>(replaceMenuImage.PATH.replace('{id}', String(id)), file, (sent) =>
        this.uploadProgress.set(sent),
      ),
    );
    this.uploadProgress.set(null);
    if (upload.ok) {
      this.photoSaved(upload.value, 'Photo enregistrée');
    }
  }

  /** A photo of the gallery, or none (null): the previous one stays in the gallery. */
  protected async chooseImage(imageId: string | null): Promise<void> {
    const id = this.draft()?.id;
    if (id == null) {
      return;
    }
    this.savingImage.set(true);
    const choice = await attempt(this.api.invoke(chooseMenuImage, { id, body: { imageId: imageId ?? undefined } }));
    this.savingImage.set(false);
    if (choice.ok) {
      this.photoSaved(choice.value, imageId ? 'Photo enregistrée' : 'Photo retirée, elle reste dans la galerie');
    }
  }

  /** The form keeps what is being typed: only the photo changes. */
  private photoSaved(menu: AdminMenu, message: string): void {
    this.toaster.success(message);
    this.update({ imageId: menu.imageId ?? null });
    this.reload();
  }

  private open(menu: AdminMenu): void {
    const { id, title, intro, published, recipes, imageId } = menu;
    this.draft.set({ id, title, intro: intro ?? '', published, recipes, imageId: imageId ?? null });
  }

  protected async remove(menu: MenuSummary): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Mettre le menu à la corbeille ?',
      message: `« ${menu.title} » disparaît du site et reste 30 jours dans la corbeille, d'où il peut être restauré. Ses recettes restent`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteMenu, { id: menu.id }))).ok) {
      this.toaster.success('Menu mis à la corbeille');
      if (this.draft()?.id === menu.id) {
        this.draft.set(null);
      }
      this.reload();
    }
  }

  /** The list, and the site's navigation (the "Menus" link shows once one is published). */
  private reload(): void {
    this.menus.reload();
    void this.siteData.load();
  }

  private async loadRecipes(): Promise<RecipeAdminSummary[]> {
    const recipes: RecipeAdminSummary[] = [];
    for (let page = 0, totalPages = 1; page < totalPages; page++) {
      const result = await this.api.invoke(searchRecipes, { page, size: PAGE_SIZE, sort: ['title,asc'] });
      recipes.push(...result.content);
      totalPages = result.totalPages;
    }
    return recipes;
  }
}
