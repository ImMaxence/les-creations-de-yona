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
  LucideExternalLink,
  LucideGripVertical,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { Api } from '../../../core/api/generated/api';
import { createRecipe } from '../../../core/api/generated/fn/admin-recipes/create-recipe';
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
import { emptyIngredient, emptyStep, recipeSchema, toDraft, toRecipeForm } from './recipe-draft';
import { UnsavedChanges } from './unsaved-changes.guard';

type ListName = 'ingredients' | 'steps';

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
    LucideArrowDown,
    LucideArrowUp,
    LucideExternalLink,
    LucideGripVertical,
    LucidePlus,
    LucideTrash2,
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
  protected readonly categoryOptions = computed<SelectOption<number | null>[]>(() =>
    this.siteData.categories().map((category) => ({ value: category.id, label: category.name })),
  );
  /** Suggestions for ingredient names, so that the same ingredient is not created twice. */
  protected readonly knownIngredients = resource({
    loader: () => this.api.invoke(searchIngredients, {}),
  });
  protected readonly publicLink = computed(() => {
    const recipe = this.recipe();
    return recipe?.status === 'PUBLISHED' ? recipeLink(recipe) : null;
  });

  protected readonly imageId = linkedSignal(() => this.recipe()?.imageId ?? null);
  /** New recipe: the photo is sent right after the recipe is created. */
  private readonly pendingImage = signal<File | null>(null);
  protected readonly pendingPreview = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly saving = signal(false);

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

  protected async onImageChosen(file: File): Promise<void> {
    const recipe = this.recipe();
    if (recipe) {
      await this.uploadImage(recipe.id, file);
      return;
    }
    this.revokePreview();
    this.pendingImage.set(file);
    this.pendingPreview.set(URL.createObjectURL(file));
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
          if (image) {
            await this.uploadImage(created.id, image);
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
    this.uploading.set(true);
    try {
      const updated = await this.api.invoke(replaceRecipeImage, { id: recipeId, body: { file } });
      this.imageId.set(updated.imageId ?? null);
      this.toaster.success('Photo enregistrée.');
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
