import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LucideCheck, LucidePencil, LucideTrash2, LucideX } from '@lucide/angular';
import { debounceTime } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteIngredient } from '../../../core/api/generated/fn/admin-ingredients/delete-ingredient';
import { renameIngredient } from '../../../core/api/generated/fn/admin-ingredients/rename-ingredient';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { IngredientResponse } from '../../../core/api/generated/models/ingredient-response';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';

const MAX_NAME_LENGTH = 100;

/** Ingredients are created from the recipes; here they are only renamed or deleted. */
@Component({
  selector: 'yona-admin-ingredients',
  imports: [LucideCheck, LucidePencil, LucideTrash2, LucideX],
  templateUrl: './admin-ingredients.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminIngredients {
  private readonly api = inject(Api);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly search = signal('');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), {
    initialValue: '',
  });
  protected readonly ingredients = resource({
    params: () => ({ q: this.debouncedSearch().trim() || undefined }),
    loader: ({ params }) => this.api.invoke(searchIngredients, params),
  });
  protected readonly editingId = signal<number | null>(null);
  protected readonly editedName = signal('');

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected readEditedName(event: Event): void {
    this.editedName.set((event.target as HTMLInputElement).value);
  }

  protected startRename(ingredient: IngredientResponse): void {
    this.editingId.set(ingredient.id);
    this.editedName.set(ingredient.name);
  }

  protected async rename(ingredient: IngredientResponse): Promise<void> {
    const name = this.editedName().trim();
    if (!name || name === ingredient.name) {
      this.editingId.set(null);
      return;
    }
    if ((await attempt(this.api.invoke(renameIngredient, { id: ingredient.id, body: { name } }))).ok) {
      this.editingId.set(null);
      this.toaster.success('Ingrédient renommé dans toutes les recettes.');
      this.ingredients.reload();
    }
  }

  protected async remove(ingredient: IngredientResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "Supprimer l'ingrédient ?",
      message: `« ${ingredient.name} » sera supprimé. Impossible tant qu'une recette l'utilise.`,
      confirmLabel: 'Supprimer',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteIngredient, { id: ingredient.id }))).ok) {
      this.toaster.success('Ingrédient supprimé.');
      this.ingredients.reload();
    }
  }
}
