import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteIngredient } from '../../../core/api/generated/fn/admin-ingredients/delete-ingredient';
import { deleteIngredients } from '../../../core/api/generated/fn/admin-ingredients/delete-ingredients';
import { findSimilarIngredients } from '../../../core/api/generated/fn/admin-ingredients/find-similar-ingredients';
import { mergeIngredients } from '../../../core/api/generated/fn/admin-ingredients/merge-ingredients';
import { renameIngredient } from '../../../core/api/generated/fn/admin-ingredients/rename-ingredient';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { setIngredientAisle } from '../../../core/api/generated/fn/admin-ingredients/set-ingredient-aisle';
import { IngredientResponse } from '../../../core/api/generated/models/ingredient-response';
import { SimilarIngredients } from '../../../core/api/generated/models/similar-ingredients';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { AISLES, Aisle } from '../../../shared/format/aisles';
import { Button } from '../../../shared/ui/button/button';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_NAME_LENGTH = 100;

type UsageFilter = 'ALL' | 'USED' | 'UNUSED';

/** An aisle, or none (''): the ingredients still to shelve. */
type AisleFilter = Aisle | '' | 'ALL';

/** For a group of similar ingredients: keep one of them, or replace them all by a new name. */
type MergeChoice = { keptId: number } | { newName: string };

/**
 * Ingredients are created from the recipes; here they are renamed, merged when written several
 * ways, put in a shop aisle (which sorts the shopping list), or deleted.
 */
@Component({
  selector: 'yona-admin-ingredients',
  imports: [Icon, RouterLink, BulkBar, Button, Select],
  templateUrl: './admin-ingredients.html',
  styleUrl: './admin-ingredients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeHelpOutside($event)',
    '(document:keydown.escape)': 'helpOpen.set(false)',
  },
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

  protected readonly usageOptions: SelectOption<UsageFilter>[] = [
    { value: 'ALL', label: 'Tous les ingrédients' },
    { value: 'USED', label: 'Utilisés' },
    { value: 'UNUSED', label: 'Non utilisés' },
  ];
  protected readonly usage = signal<UsageFilter>('ALL');
  /** The aisle of a row; '' for none. */
  protected readonly aisleOptions: SelectOption<Aisle | ''>[] = [{ value: '', label: 'Sans rayon' }, ...AISLES];
  protected readonly aisleFilterOptions: SelectOption<AisleFilter>[] = [
    { value: 'ALL', label: 'Tous les rayons' },
    { value: '', label: 'Sans rayon' },
    ...AISLES,
  ];
  protected readonly aisleFilter = signal<AisleFilter>('ALL');
  protected readonly shown = computed(() => {
    const usage = this.usage();
    const aisle = this.aisleFilter();
    return (this.ingredients.value() ?? []).filter(
      (ingredient) =>
        (usage === 'ALL' || (usage === 'USED') === ingredient.recipeCount > 0) &&
        (aisle === 'ALL' || (ingredient.aisle ?? '') === aisle),
    );
  });
  /** Used in a recipe but not shelved yet: they fall in "Autres" in the shopping lists. */
  protected readonly withoutAisleCount = computed(
    () => (this.ingredients.value() ?? []).filter((ingredient) => ingredient.recipeCount > 0 && !ingredient.aisle).length,
  );
  protected readonly shelving = signal(false);
  protected readonly unusedCount = computed(
    () => (this.ingredients.value() ?? []).filter((ingredient) => ingredient.recipeCount === 0).length,
  );

  protected readonly editingId = signal<number | null>(null);
  protected readonly editedName = signal('');

  protected readonly selection = new Selection<number>();
  protected readonly shownIds = computed(() => this.shown().map((ingredient) => ingredient.id));
  protected readonly deleting = signal(false);

  /** Null until "Détecter les doublons"; then the groups found, without those merged or ignored. */
  protected readonly similarGroups = signal<SimilarIngredients[] | null>(null);
  protected readonly detecting = signal(false);
  /** Tooltip of "Détecter les doublons", opened by a tap on phones. */
  protected readonly helpOpen = signal(false);
  protected readonly merging = signal<string | null>(null);
  private readonly choices = signal<ReadonlyMap<string, MergeChoice>>(new Map());

  /** A tap anywhere else closes the tooltip. */
  protected closeHelpOutside(event: MouseEvent): void {
    if (this.helpOpen() && !(event.target as Element).closest('.detect')) {
      this.helpOpen.set(false);
    }
  }

  protected recipesLink(ingredient: IngredientResponse): Record<string, number> {
    return { [ADMIN_RECIPES_QUERY.ingredientId]: ingredient.id };
  }

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
      if (this.selection.has(ingredient.id)) {
        this.selection.toggle(ingredient.id);
      }
      this.ingredients.reload();
    }
  }

  protected aisleOf(ingredient: IngredientResponse): Aisle | '' {
    return ingredient.aisle ?? '';
  }

  /** One row, or the selection: saved at once, the list read again. */
  protected async setAisle(ids: number[], aisle: Aisle | '' | undefined): Promise<void> {
    if (!ids.length || aisle === undefined) {
      return;
    }
    this.shelving.set(true);
    const saved = await attempt(
      this.api.invoke(setIngredientAisle, { body: { ingredientIds: ids, aisle: aisle || undefined } }),
    );
    this.shelving.set(false);
    if (saved.ok) {
      if (ids.length > 1) {
        this.toaster.success(`${ids.length} ingrédients rangés.`);
        this.selection.clear();
      }
      this.ingredients.reload();
    }
  }

  /** All or none: the API refuses if one of them is still in a recipe, and names it. */
  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Supprimer ${count} ingrédients ?` : "Supprimer l'ingrédient ?",
      message: "Impossible si l'un d'eux est encore dans une recette : rien n'est alors supprimé.",
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteIngredients, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} ingrédients supprimés.` : 'Ingrédient supprimé.');
      this.selection.clear();
      this.ingredients.reload();
    }
  }

  // Similar ingredients

  protected async detectSimilar(): Promise<void> {
    this.detecting.set(true);
    const found = await attempt(this.api.invoke(findSimilarIngredients, {}));
    this.detecting.set(false);
    if (found.ok) {
      this.similarGroups.set(found.value);
      this.choices.set(new Map());
      if (!found.value.length) {
        this.toaster.success("Aucun doublon trouvé : chaque ingrédient n'est écrit que d'une façon.");
      }
    }
  }

  protected groupKey(group: SimilarIngredients): string {
    return group.ingredients.map((ingredient) => ingredient.id).join('-');
  }

  /** By default, the most used one (first of its group) is kept. */
  protected choiceOf(group: SimilarIngredients): MergeChoice {
    return this.choices().get(this.groupKey(group)) ?? { keptId: group.ingredients[0]!.id };
  }

  protected isKept(group: SimilarIngredients, ingredient: IngredientResponse): boolean {
    const choice = this.choiceOf(group);
    return 'keptId' in choice && choice.keptId === ingredient.id;
  }

  protected newNameOf(group: SimilarIngredients): string | null {
    const choice = this.choiceOf(group);
    return 'newName' in choice ? choice.newName : null;
  }

  protected keep(group: SimilarIngredients, ingredient: IngredientResponse): void {
    this.choose(group, { keptId: ingredient.id });
  }

  /** "Replace all": a new name, prefilled with the most used spelling. */
  protected renameAll(group: SimilarIngredients, event?: Event): void {
    const name = event ? (event.target as HTMLInputElement).value : (this.newNameOf(group) ?? group.ingredients[0]!.name);
    this.choose(group, { newName: name });
  }

  protected ignore(group: SimilarIngredients): void {
    this.similarGroups.update((groups) => groups?.filter((other) => other !== group) ?? null);
  }

  protected async merge(group: SimilarIngredients): Promise<void> {
    const choice = this.choiceOf(group);
    if ('newName' in choice && !choice.newName.trim()) {
      this.toaster.error('Donnez le nom du nouvel ingrédient.');
      return;
    }
    const target = 'keptId' in choice
      ? group.ingredients.find((ingredient) => ingredient.id === choice.keptId)!.name
      : choice.newName.trim();
    const others = group.ingredients.filter((ingredient) => !('keptId' in choice) || ingredient.id !== choice.keptId);
    const confirmed = await this.confirm.ask({
      title: 'Fusionner ces ingrédients ?',
      message: `Les recettes utilisant ${others.map((ingredient) => `« ${ingredient.name} »`).join(', ')} utiliseront « ${target} ». ${others.length > 1 ? 'Ces ingrédients seront supprimés' : 'Cet ingrédient sera supprimé'}.`,
      confirmLabel: 'Fusionner',
    });
    if (!confirmed) {
      return;
    }
    this.merging.set(this.groupKey(group));
    const merged = await attempt(
      this.api.invoke(mergeIngredients, {
        body: {
          ingredientIds: group.ingredients.map((ingredient) => ingredient.id),
          ...('keptId' in choice ? { keptId: choice.keptId } : { newName: choice.newName.trim() }),
        },
      }),
    );
    this.merging.set(null);
    if (merged.ok) {
      this.toaster.success(`Ingrédients fusionnés en « ${merged.value.name} ».`);
      this.ignore(group);
      this.selection.clear();
      this.ingredients.reload();
    }
  }

  private choose(group: SimilarIngredients, choice: MergeChoice): void {
    this.choices.update((current) => new Map(current).set(this.groupKey(group), choice));
  }
}
