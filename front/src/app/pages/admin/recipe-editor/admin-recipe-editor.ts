import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { FieldTree, FormField, form, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideCheck,
  LucideExternalLink,
  LucideGripVertical,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { attempt } from '../../../core/api/attempt';
import { createCategory } from '../../../core/api/generated/fn/admin-categories/create-category';
import { createRecipe } from '../../../core/api/generated/fn/admin-recipes/create-recipe';
import { chooseRecipeImage } from '../../../core/api/generated/fn/admin-recipes/choose-recipe-image';
import { replaceRecipeImage } from '../../../core/api/generated/fn/admin-recipes/replace-recipe-image';
import { updateRecipe } from '../../../core/api/generated/fn/admin-recipes/update-recipe';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { RecipeDetail } from '../../../core/api/generated/models/recipe-detail';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { SuggestInput, Suggestion } from '../../../shared/ui/suggest-input/suggest-input';
import { emptyIngredient, emptyStep, recipeSchema, toDraft, toRecipeForm } from './recipe-draft';
import { UnsavedChanges } from './unsaved-changes.guard';

type ListName = 'ingredients' | 'steps';

type PendingImage = { file: File } | { imageId: string };

const DIFFICULTY_WORDS: Record<number, string> = {
  1: 'très facile',
  2: 'facile',
  3: 'moyenne',
  4: 'difficile',
  5: 'expert',
};

/** 1 to 5 by half points, shown as stars on the recipe page. */
const DIFFICULTY_OPTIONS: SelectOption<number | null>[] = [
  { value: null, label: 'Non précisée' },
  ...Array.from({ length: 9 }, (_option, index) => {
    const value = 1 + index / 2;
    const words = DIFFICULTY_WORDS[value];
    return { value, label: `${value.toLocaleString('fr-FR')} / 5${words ? ` (${words})` : ''}` };
  }),
];

@Component({
  selector: 'yona-admin-recipe-editor',
  imports: [
    RouterLink,
    FormField,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Button,
    FieldError,
    ImageUpload,
    Select,
    SuggestInput,
    LucideArrowDown,
    LucideArrowUp,
    LucideCheck,
    LucideExternalLink,
    LucideGripVertical,
    LucidePlus,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './admin-recipe-editor.html',
  styleUrl: './admin-recipe-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminRecipeEditor implements UnsavedChanges {
  /** From adminRecipeResolver; absent for a new recipe. */
  readonly recipe = input<RecipeDetail>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly isNew = computed(() => !this.recipe());
  protected readonly draft = linkedSignal(() => toDraft(this.recipe()));
  protected readonly recipeForm = form(this.draft, recipeSchema);
  /** Last saved state, to warn before leaving with unsaved changes. */
  private readonly savedSnapshot = linkedSignal(() => JSON.stringify(toDraft(this.recipe())));
  private readonly unsaved = computed(() => JSON.stringify(this.draft()) !== this.savedSnapshot());

  protected readonly statusOptions: SelectOption<'DRAFT' | 'PUBLISHED'>[] = [
    { value: 'DRAFT', label: 'Brouillon (invisible sur le site)' },
    { value: 'PUBLISHED', label: 'Publiée' },
  ];
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly categoryOptions = computed<SelectOption<number | null>[]>(() =>
    this.siteData.categories().map((category) => ({ value: category.id, label: category.name })),
  );
  /** Ingredients already known, the most used first, so that the same one is not created twice. */
  private readonly knownIngredients = resource({
    loader: () => this.api.invoke(searchIngredients, {}),
  });
  protected readonly ingredientSuggestions = computed<Suggestion[]>(() =>
    [...(this.knownIngredients.value() ?? [])]
      .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name, 'fr'))
      .map((ingredient) => ({
        value: ingredient.name,
        hint: ingredient.recipeCount
          ? `${ingredient.recipeCount} recette${ingredient.recipeCount > 1 ? 's' : ''}`
          : undefined,
      })),
  );
  /** Already in this recipe: not suggested again (a recipe lists an ingredient once). */
  protected readonly ingredientNames = computed(
    () => new Set(this.draft().ingredients.map((ingredient) => ingredient.name.trim()).filter(Boolean)),
  );
  protected readonly publicLink = computed(() => {
    const recipe = this.recipe();
    return recipe?.status === 'PUBLISHED' ? recipeLink(recipe) : null;
  });

  protected readonly imageId = linkedSignal(() => this.recipe()?.imageId ?? null);
  /** New recipe: the photo (a file, or an image of the gallery) is set right after the recipe is created. */
  private readonly pendingImage = signal<PendingImage | null>(null);
  protected readonly pendingPreview = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly saving = signal(false);
  protected readonly creatingCategory = signal(false);
  protected readonly newCategoryName = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  hasUnsavedChanges(): boolean {
    return this.unsaved();
  }

  protected isInvalid(field: FieldTree<unknown>): boolean {
    return field().touched() && field().invalid();
  }

  protected add(list: ListName): void {
    this.draft.update((draft) =>
      list === 'ingredients'
        ? { ...draft, ingredients: [...draft.ingredients, emptyIngredient()] }
        : { ...draft, steps: [...draft.steps, emptyStep()] },
    );
  }

  protected remove(list: ListName, index: number): void {
    this.draft.update((draft) => ({
      ...draft,
      [list]: draft[list].filter((_item: unknown, position: number) => position !== index),
    }));
  }

  /** Drag and drop, or the arrow buttons for keyboard users. */
  protected move(list: ListName, from: number, to: number): void {
    if (to < 0 || to >= this.draft()[list].length || from === to) {
      return;
    }
    this.draft.update((draft) => {
      const items = [...draft[list]];
      moveItemInArray(items, from, to);
      return { ...draft, [list]: items };
    });
  }

  protected drop(list: ListName, event: CdkDragDrop<unknown>): void {
    this.move(list, event.previousIndex, event.currentIndex);
  }

  /** Creates a category without leaving the recipe, and chooses it. */
  protected async addCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) {
      this.toaster.error('Donnez un nom à la catégorie.');
      return;
    }
    const created = await attempt(this.api.invoke(createCategory, { body: { name } }));
    if (!created.ok) {
      return;
    }
    await this.siteData.load();
    this.draft.update((draft) => ({ ...draft, categoryId: created.value.id }));
    this.creatingCategory.set(false);
    this.newCategoryName.set('');
    this.toaster.success(`Catégorie « ${created.value.name} » créée et choisie.`);
  }

  protected async onImageChosen(file: File): Promise<void> {
    const recipe = this.recipe();
    if (recipe) {
      await this.uploadImage(recipe.id, file);
      return;
    }
    this.revokePreview();
    this.imageId.set(null);
    this.pendingImage.set({ file });
    this.pendingPreview.set(URL.createObjectURL(file));
  }

  /** An image of the gallery, or none (null). The previous photo stays in the gallery. */
  protected async onImageSelected(imageId: string | null): Promise<void> {
    const recipe = this.recipe();
    if (recipe) {
      await this.chooseImage(recipe.id, imageId);
      return;
    }
    this.revokePreview();
    this.imageId.set(imageId);
    this.pendingImage.set(imageId ? { imageId } : null);
  }

  protected async save(): Promise<void> {
    await submit(this.recipeForm, async () => {
      this.saving.set(true);
      try {
        const body = toRecipeForm(this.draft());
        const existing = this.recipe();
        if (existing) {
          const updated = await this.api.invoke(updateRecipe, { id: existing.id, body });
          this.draft.set(toDraft(updated));
          this.savedSnapshot.set(JSON.stringify(this.draft()));
          this.toaster.success('Recette enregistrée.');
        } else {
          const created = await this.api.invoke(createRecipe, { body });
          this.savedSnapshot.set(JSON.stringify(this.draft()));
          const image = this.pendingImage();
          if (image && 'file' in image) {
            await this.uploadImage(created.id, image.file);
          } else if (image) {
            await this.chooseImage(created.id, image.imageId);
          }
          this.toaster.success('Recette créée.');
          await this.router.navigate(['/admin/recettes', created.id], { replaceUrl: true });
        }
      } catch {
        // The API error is already shown as a toast
      } finally {
        this.saving.set(false);
      }
      return undefined;
    });
  }

  private async uploadImage(recipeId: number, file: File): Promise<void> {
    await this.changeImage(() => this.api.invoke(replaceRecipeImage, { id: recipeId, body: { file } }), 'Photo enregistrée.');
  }

  private async chooseImage(recipeId: number, imageId: string | null): Promise<void> {
    await this.changeImage(
      () => this.api.invoke(chooseRecipeImage, { id: recipeId, body: { imageId: imageId ?? undefined } }),
      imageId ? 'Photo enregistrée.' : 'Photo retirée, elle reste dans la galerie.',
    );
  }

  private async changeImage(call: () => Promise<RecipeDetail>, successMessage: string): Promise<void> {
    this.uploading.set(true);
    try {
      const updated = await call();
      this.imageId.set(updated.imageId ?? null);
      this.toaster.success(successMessage);
    } catch {
      // The API error is already shown as a toast
    } finally {
      this.uploading.set(false);
    }
  }

  private revokePreview(): void {
    const preview = this.pendingPreview();
    if (preview) {
      URL.revokeObjectURL(preview);
      this.pendingPreview.set(null);
    }
  }
}
