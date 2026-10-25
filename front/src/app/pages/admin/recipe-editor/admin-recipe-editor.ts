import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
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
  LucideLayers,
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
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { SiteData } from '../../../core/site/site-data';
import { recipeLink } from '../../../shared/routing/links';
import { Button } from '../../../shared/ui/button/button';
import { FieldError } from '../../../shared/ui/field-error/field-error';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { SuggestInput, Suggestion } from '../../../shared/ui/suggest-input/suggest-input';
import { hasParts } from '../../recipe/recipe-parts';
import { PartDraft, emptyIngredient, emptyPart, emptyStep, recipeSchema, toDraft, toRecipeForm } from './recipe-draft';
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
    NgTemplateOutlet,
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
    LucideLayers,
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
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly siteData = inject(SiteData);

  protected readonly isNew = computed(() => !this.recipe());
  protected readonly draft = linkedSignal(() => toDraft(this.recipe()));
  protected readonly recipeForm = form(this.draft, recipeSchema);
  /** Last saved state, to warn before leaving with unsaved changes. */
  private readonly savedSnapshot = linkedSignal(() => JSON.stringify(toDraft(this.recipe())));
  private readonly unsaved = computed(() => JSON.stringify(this.draft()) !== this.savedSnapshot());

  /**
   * Recipe in parts (the dough, the filling…), each with its title, ingredients and steps.
   * Otherwise its single part is edited as plain ingredients and steps.
   */
  protected readonly usesParts = linkedSignal(() => hasParts(this.recipe()?.parts ?? []));

  protected readonly statusOptions: SelectOption<'DRAFT' | 'PUBLISHED'>[] = [
    { value: 'DRAFT', label: 'Brouillon (invisible sur le site)' },
    { value: 'PUBLISHED', label: 'Publiée' },
  ];
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly categories = this.siteData.categories;
  /** Among the chosen ones: the main category, in the recipe URL. */
  protected readonly mainCategoryOptions = computed<SelectOption<number>[]>(() =>
    this.draft().categoryIds.map((id) => ({
      value: id,
      label: this.categories().find((category) => category.id === id)?.name ?? '',
    })),
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
  /** Already in a part: not suggested again there (a part lists an ingredient once). */
  protected readonly ingredientNames = computed(() =>
    this.draft().parts.map(
      (part) => new Set(part.ingredients.map((ingredient) => ingredient.name.trim()).filter(Boolean)),
    ),
  );
  /** Ingredients (or steps) can be dragged from one part to another. */
  protected readonly ingredientListIds = computed(() => this.draft().parts.map((_part, index) => `ingredients-${index}`));
  protected readonly stepListIds = computed(() => this.draft().parts.map((_part, index) => `steps-${index}`));
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

  // Categories

  protected isChosen(categoryId: number): boolean {
    return this.draft().categoryIds.includes(categoryId);
  }

  /** Added at the end; removing the main category makes the next one the main category. */
  protected toggleCategory(categoryId: number): void {
    this.draft.update((draft) => ({
      ...draft,
      categoryIds: draft.categoryIds.includes(categoryId)
        ? draft.categoryIds.filter((id) => id !== categoryId)
        : [...draft.categoryIds, categoryId],
    }));
  }

  protected chooseMainCategory(categoryId: number | undefined): void {
    if (categoryId === undefined) {
      return;
    }
    this.draft.update((draft) => ({
      ...draft,
      categoryIds: [categoryId, ...draft.categoryIds.filter((id) => id !== categoryId)],
    }));
  }

  /** Creates a category without leaving the recipe, and adds it to the recipe's. */
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
    this.draft.update((draft) => ({ ...draft, categoryIds: [...draft.categoryIds, created.value.id] }));
    this.creatingCategory.set(false);
    this.newCategoryName.set('');
    this.toaster.success(`Catégorie « ${created.value.name} » créée et ajoutée à la recette.`);
  }

  // Parts

  /** The current ingredients and steps become the first part, followed by an empty one. */
  protected splitIntoParts(): void {
    this.usesParts.set(true);
    this.draft.update((draft) => ({ ...draft, parts: [...draft.parts, emptyPart()] }));
  }

  /** Back to a recipe without parts, once a single part is left. */
  protected stopUsingParts(): void {
    this.usesParts.set(false);
    this.updatePart(0, (part) => ({ ...part, title: '' }));
  }

  protected addPart(): void {
    this.draft.update((draft) => ({ ...draft, parts: [...draft.parts, emptyPart()] }));
  }

  protected async removePart(index: number): Promise<void> {
    const part = this.draft().parts[index];
    const hasContent =
      part &&
      (part.title.trim() ||
        part.ingredients.some((line) => line.name.trim()) ||
        part.steps.some((step) => step.description.trim()));
    if (
      hasContent &&
      !(await this.confirm.ask({
        title: 'Supprimer cette partie ?',
        message: `« ${part.title.trim() || `Partie ${index + 1}`} » sera retirée avec ses ingrédients et ses étapes.`,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    this.draft.update((draft) => ({ ...draft, parts: draft.parts.filter((_part, position) => position !== index) }));
  }

  protected movePart(from: number, to: number): void {
    if (to < 0 || to >= this.draft().parts.length) {
      return;
    }
    this.draft.update((draft) => {
      const parts = [...draft.parts];
      moveItemInArray(parts, from, to);
      return { ...draft, parts };
    });
  }

  // Ingredients and steps of a part

  protected add(list: ListName, partIndex: number): void {
    this.updatePart(partIndex, (part) =>
      list === 'ingredients'
        ? { ...part, ingredients: [...part.ingredients, emptyIngredient()] }
        : { ...part, steps: [...part.steps, emptyStep()] },
    );
  }

  protected remove(list: ListName, partIndex: number, index: number): void {
    this.updatePart(partIndex, (part) => ({
      ...part,
      [list]: part[list].filter((_item: unknown, position: number) => position !== index),
    }));
  }

  /** Drag and drop, or the arrow buttons for keyboard users. */
  protected move(list: ListName, partIndex: number, from: number, to: number): void {
    const items = this.draft().parts[partIndex]?.[list] ?? [];
    if (to < 0 || to >= items.length || from === to) {
      return;
    }
    this.updatePart(partIndex, (part) => {
      const moved = [...part[list]];
      moveItemInArray(moved, from, to);
      return { ...part, [list]: moved };
    });
  }

  /** Within a part, or from one part to another (the list data is the part index). */
  protected drop(list: ListName, event: CdkDragDrop<number>): void {
    const from = event.previousContainer.data;
    const to = event.container.data;
    if (from === to) {
      this.move(list, to, event.previousIndex, event.currentIndex);
      return;
    }
    this.draft.update((draft) => {
      const parts = draft.parts.map((part) => ({ ...part, [list]: [...part[list]] }));
      transferArrayItem<unknown>(parts[from]![list], parts[to]![list], event.previousIndex, event.currentIndex);
      return { ...draft, parts };
    });
  }

  private updatePart(index: number, change: (part: PartDraft) => PartDraft): void {
    this.draft.update((draft) => ({
      ...draft,
      parts: draft.parts.map((part, position) => (position === index ? change(part) : part)),
    }));
  }

  // Photo

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
