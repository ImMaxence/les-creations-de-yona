import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatKcal } from '../../../shared/format/nutrition';
import { CiqualTable } from './ciqual-table';
import { IngredientNutritionEditor } from './ingredient-nutrition-editor';
import { NutritionSuggestions } from './nutrition-suggestions';
import { debounceTime } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { deleteIngredient } from '../../../core/api/generated/fn/admin-ingredients/delete-ingredient';
import { deleteIngredients } from '../../../core/api/generated/fn/admin-ingredients/delete-ingredients';
import { findSimilarIngredients } from '../../../core/api/generated/fn/admin-ingredients/find-similar-ingredients';
import { mergeIngredients } from '../../../core/api/generated/fn/admin-ingredients/merge-ingredients';
import { renameIngredient } from '../../../core/api/generated/fn/admin-ingredients/rename-ingredient';
import { setIngredientPiece } from '../../../core/api/generated/fn/admin-ingredients/set-ingredient-piece';
import { IngredientPieceForm } from '../../../core/api/generated/models/ingredient-piece-form';
import { formatQuantity } from '../../../shared/format/units';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { setIngredientAisle } from '../../../core/api/generated/fn/admin-ingredients/set-ingredient-aisle';
import { IngredientResponse } from '../../../core/api/generated/models/ingredient-response';
import { SimilarIngredients } from '../../../core/api/generated/models/similar-ingredients';
import { Confirm } from '../../../core/dialog/confirm';
import { Toaster } from '../../../core/notifications/toaster';
import { AISLES, Aisle } from '../../../shared/format/aisles';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Select, SelectOption } from '../../../shared/ui/select/select';
import { BulkBar } from '../bulk-bar/bulk-bar';
import { ADMIN_RECIPES_QUERY } from '../recipes/admin-recipes-query';
import { Selection } from '../selection';
import { Icon } from '../../../shared/ui/icon/icon';

const MAX_NAME_LENGTH = 100;

type UsageFilter = 'ALL' | 'USED' | 'UNUSED';

/** An aisle, or none (''): the ingredients still to shelve. */
type AisleFilter = Aisle | '' | 'ALL';

/** With nutrition facts or not: MISSING, those of the recipes still without. */
type NutritionFilter = 'ALL' | 'MISSING' | 'SET';

/** For a group of similar ingredients: keep one of them, or replace them all by a new name. */
type MergeChoice = { keptId: number } | { newName: string };

/**
 * Ingredients are created from the recipes; here they are renamed, merged when written several
 * ways, put in a shop aisle (which sorts the shopping list), or deleted.
 */
@Component({
  selector: 'yona-admin-ingredients',
  imports: [Icon, RouterLink, BulkBar, Button, CiqualTable, Dialog, IngredientNutritionEditor, NutritionSuggestions, Select, Skeleton],
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
  /** ?q=Beurre, from the nutrition facts of the recipe editor: that ingredient found at once. */
  protected readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '');
  private readonly debouncedSearch = toSignal(toObservable(this.search).pipe(debounceTime(300)), {
    initialValue: this.search(),
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
  protected readonly nutritionFilterOptions: SelectOption<NutritionFilter>[] = [
    { value: 'ALL', label: 'Toutes les valeurs' },
    { value: 'MISSING', label: 'À compléter' },
    { value: 'SET', label: 'Renseignées' },
  ];
  protected readonly nutritionFilter = signal<NutritionFilter>('ALL');
  protected readonly shown = computed(() => {
    const usage = this.usage();
    const aisle = this.aisleFilter();
    const nutrition = this.nutritionFilter();
    return (this.ingredients.value() ?? []).filter(
      (ingredient) =>
        (usage === 'ALL' || (usage === 'USED') === ingredient.recipeCount > 0) &&
        (aisle === 'ALL' || (ingredient.aisle ?? '') === aisle) &&
        (nutrition === 'ALL' ||
          (nutrition === 'SET' ? !!ingredient.nutrition : !ingredient.nutrition && ingredient.recipeCount > 0)),
    );
  });
  /** Used in a recipe but without nutrition facts: those recipes leave it out of theirs. */
  protected readonly withoutNutritionCount = computed(
    () => (this.ingredients.value() ?? []).filter((ingredient) => ingredient.recipeCount > 0 && !ingredient.nutrition).length,
  );
  /** The ingredient whose nutrition facts are being set, in the dialog. */
  protected readonly nutritionId = signal<number | null>(null);
  protected readonly nutritionIngredient = computed(
    () => (this.ingredients.value() ?? []).find((ingredient) => ingredient.id === this.nutritionId()) ?? null,
  );

  /** Saved: the dialog closes, the list shows its new values. */
  protected nutritionSaved(): void {
    this.nutritionId.set(null);
    this.ingredients.reload();
  }
  protected readonly showSuggestions = signal(false);
  protected readonly showCiqual = signal(false);

  /** "Ciqual · 753 kcal", "Étiquette · 380 kcal", per 100 g. */
  protected nutritionLabel(ingredient: IngredientResponse): string | null {
    const nutrition = ingredient.nutrition;
    if (!nutrition) {
      return null;
    }
    return `${nutrition.ciqualCode ? 'Ciqual' : 'Étiquette'} · ${formatKcal(nutrition.per100g.kcal)}`;
  }
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
      this.toaster.success('Ingrédient renommé dans toutes les recettes');
      this.ingredients.reload();
    }
  }

  /** The ingredient whose weight of one piece is being typed. */
  protected readonly pieceId = signal<number | null>(null);
  protected readonly pieceGrams = signal('');
  protected readonly pieceSingular = signal('');
  protected readonly piecePlural = signal('');
  protected readonly savingPiece = signal(false);
  /** The form opened with the usual weight of such an ingredient, to check. */
  protected readonly pieceOffered = signal(false);

  /** "1 œuf = 50 g". */
  protected pieceLabel(ingredient: IngredientResponse): string | null {
    const piece = ingredient.piece;
    return piece ? `1 ${piece.singular} = ${formatQuantity(piece.grams)} g` : null;
  }

  protected startPiece(ingredient: IngredientResponse): void {
    this.pieceId.set(ingredient.id);
    // Its own weight, or else the usual one of such an ingredient ("1 rouleau = 230 g"), or else the name as a first idea
    const piece = ingredient.piece ?? ingredient.usual?.piece;
    this.pieceOffered.set(!ingredient.piece && !!piece);
    this.pieceGrams.set(piece ? String(piece.grams) : '');
    const name = ingredient.name.toLocaleLowerCase('fr');
    this.pieceSingular.set(piece?.singular ?? name);
    this.piecePlural.set(piece?.plural ?? `${name}s`);
  }

  protected async savePiece(ingredient: IngredientResponse): Promise<void> {
    const grams = Number(this.pieceGrams());
    const singular = this.pieceSingular().trim();
    const plural = this.piecePlural().trim();
    if (!Number.isFinite(grams) || grams <= 0 || !singular || !plural) {
      this.toaster.error('Indiquez le poids en grammes, et le nom au singulier et au pluriel');
      return;
    }
    await this.storePiece(ingredient, { piece: { grams, singular, plural } }, 'Équivalent enregistré');
  }

  protected removePiece(ingredient: IngredientResponse): Promise<void> {
    return this.storePiece(ingredient, {}, 'Équivalent retiré');
  }

  private async storePiece(ingredient: IngredientResponse, body: IngredientPieceForm, message: string): Promise<void> {
    this.savingPiece.set(true);
    const saved = await attempt(this.api.invoke(setIngredientPiece, { id: ingredient.id, body }));
    this.savingPiece.set(false);
    if (saved.ok) {
      this.pieceId.set(null);
      this.toaster.success(message);
      this.ingredients.reload();
    }
  }

  protected async remove(ingredient: IngredientResponse): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: "Mettre l'ingrédient à la corbeille ?",
      message: `« ${ingredient.name} » reste 30 jours dans la corbeille, d'où il peut être restauré. Impossible tant qu'une recette l'utilise`,
      confirmLabel: 'Mettre à la corbeille',
    });
    if (confirmed && (await attempt(this.api.invoke(deleteIngredient, { id: ingredient.id }))).ok) {
      this.toaster.success('Ingrédient mis à la corbeille');
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
        this.toaster.success(`${ids.length} ingrédients rangés`);
        this.selection.clear();
      }
      this.ingredients.reload();
    }
  }

  /** All or none: the API refuses if one of them is still in a recipe, and names it. */
  protected async removeSelected(): Promise<void> {
    const count = this.selection.size();
    const confirmed = await this.confirm.ask({
      title: count > 1 ? `Mettre ${count} ingrédients à la corbeille ?` : "Mettre l'ingrédient à la corbeille ?",
      message: "Ils restent 30 jours dans la corbeille. Impossible si l'un d'eux est encore dans une recette : rien n'est alors supprimé",
      confirmLabel: 'Mettre à la corbeille',
    });
    if (!confirmed) {
      return;
    }
    this.deleting.set(true);
    const deletion = await attempt(this.api.invoke(deleteIngredients, { ids: this.selection.ids() }));
    this.deleting.set(false);
    if (deletion.ok) {
      this.toaster.success(count > 1 ? `${count} ingrédients mis à la corbeille` : 'Ingrédient mis à la corbeille');
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
        this.toaster.success("Aucun doublon trouvé : chaque ingrédient n'est écrit que d'une façon");
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
      this.toaster.error('Donnez le nom du nouvel ingrédient');
      return;
    }
    const target = 'keptId' in choice
      ? group.ingredients.find((ingredient) => ingredient.id === choice.keptId)!.name
      : choice.newName.trim();
    const others = group.ingredients.filter((ingredient) => !('keptId' in choice) || ingredient.id !== choice.keptId);
    const confirmed = await this.confirm.ask({
      title: 'Fusionner ces ingrédients ?',
      message: `Les recettes utilisant ${others.map((ingredient) => `« ${ingredient.name} »`).join(', ')} utiliseront « ${target} ». ${others.length > 1 ? 'Ces ingrédients seront supprimés' : 'Cet ingrédient sera supprimé'}`,
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
      this.toaster.success(`Ingrédients fusionnés en « ${merged.value.name} »`);
      this.ignore(group);
      this.selection.clear();
      this.ingredients.reload();
    }
  }

  private choose(group: SimilarIngredients, choice: MergeChoice): void {
    this.choices.update((current) => new Map(current).set(this.groupKey(group), choice));
  }
}
