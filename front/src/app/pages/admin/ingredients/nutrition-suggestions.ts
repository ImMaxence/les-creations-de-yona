import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, output, resource, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { linkIngredientsToCiqual } from '../../../core/api/generated/fn/admin-ingredients/link-ingredients-to-ciqual';
import { suggestIngredientNutrition } from '../../../core/api/generated/fn/admin-ingredients/suggest-ingredient-nutrition';
import { NutritionSuggestion } from '../../../core/api/generated/models/nutrition-suggestion';
import { Toaster } from '../../../core/notifications/toaster';
import { formatKcal } from '../../../shared/format/nutrition';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

/** None of the foods offered: the ingredient is left as it is. */
const NONE = 0;

/**
 * "Proposer les correspondances": for each ingredient of the recipes without nutrition facts, the most used
 * first, the Ciqual foods it most probably is; the admin checks, picks another one or none, and links them all.
 */
@Component({
  selector: 'yona-nutrition-suggestions',
  imports: [Button, Icon],
  template: `
    <section class="admin-panel suggestions" aria-labelledby="suggestions-title">
      <div class="suggestions__head">
        <h3 id="suggestions-title">Correspondances proposées</h3>
        <button type="button" class="icon-button" aria-label="Fermer les correspondances" (click)="closed.emit()"><svg yonaIcon="x" [size]="18"></svg></button>
      </div>
      @if (suggestions.value(); as suggestions) {
        @if (suggestions.length) {
          <p class="field__hint">
            Pour chaque ingrédient des recettes sans valeurs nutritionnelles, les aliments de la table Ciqual les plus proches, le plus
            probable choisi. Vérifiez, choisissez-en un autre ou « Aucun », puis liez-les. Un produit du commerce se règle dans la ligne
            de l'ingrédient
          </p>
          <ul role="list" class="suggestions__list">
            @for (suggestion of suggestions; track suggestion.ingredient.id) {
              <li class="suggestion">
                <p class="suggestion__name">
                  <strong>{{ suggestion.ingredient.name }}</strong>
                  <span class="admin-row__meta">{{ suggestion.ingredient.recipeCount }} recette{{ suggestion.ingredient.recipeCount > 1 ? 's' : '' }}</span>
                </p>
                <fieldset class="suggestion__choices">
                  <legend class="visually-hidden">Aliment de {{ suggestion.ingredient.name }}</legend>
                  @for (food of suggestion.foods; track food.code) {
                    <label class="suggestion__choice">
                      <input type="radio" [name]="'food-' + suggestion.ingredient.id" [checked]="choiceOf(suggestion) === food.code" (change)="choose(suggestion, food.code)" />
                      <span>{{ food.name }} <span class="admin-row__meta">{{ formatKcal(food.per100g.kcal) }} pour 100 g</span></span>
                    </label>
                  }
                  <label class="suggestion__choice">
                    <input type="radio" [name]="'food-' + suggestion.ingredient.id" [checked]="choiceOf(suggestion) === none" (change)="choose(suggestion, none)" />
                    <span>Aucun{{ suggestion.foods.length ? '' : ' aliment proche : à régler dans sa ligne' }}</span>
                  </label>
                </fieldset>
              </li>
            }
          </ul>
          <div class="admin-toolbar">
            <button yonaButton type="button" [disabled]="linking() || !chosenCount()" (click)="linkAll()">
              <svg yonaIcon="link"></svg>Lier {{ chosenCount() }} ingrédient{{ chosenCount() > 1 ? 's' : '' }}
            </button>
          </div>
        } @else {
          <p class="field__hint">Chaque ingrédient des recettes a ses valeurs nutritionnelles</p>
        }
      } @else if (suggestions.isLoading()) {
        <p class="field__hint">Recherche des correspondances…</p>
      }
    </section>
  `,
  styles: `
    .suggestions {
      display: grid;
      gap: var(--space-3);
    }

    .suggestions__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .suggestions__list {
      display: grid;
      gap: var(--space-4);
    }

    .suggestion {
      display: grid;
      gap: var(--space-2);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-line);
    }

    .suggestion__name {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
    }

    .suggestion__choices {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      border: 0;
    }

    .suggestion__choice {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NutritionSuggestions {
  readonly linked = output<void>();
  readonly closed = output<void>();

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly none = NONE;
  protected readonly formatKcal = formatKcal;
  protected readonly suggestions = resource({ loader: () => this.api.invoke(suggestIngredientNutrition, {}) });
  /** By ingredient: the food chosen; the likeliest one until the admin picks. */
  private readonly choices = linkedSignal<NutritionSuggestion[] | undefined, ReadonlyMap<number, number>>({
    source: () => this.suggestions.value(),
    computation: (suggestions) =>
      new Map((suggestions ?? []).map((suggestion) => [suggestion.ingredient.id, suggestion.foods[0]?.code ?? NONE])),
  });
  protected readonly chosenCount = computed(() => [...this.choices().values()].filter((code) => code !== NONE).length);
  protected readonly linking = signal(false);

  protected choiceOf(suggestion: NutritionSuggestion): number {
    return this.choices().get(suggestion.ingredient.id) ?? NONE;
  }

  protected choose(suggestion: NutritionSuggestion, code: number): void {
    this.choices.update((choices) => new Map(choices).set(suggestion.ingredient.id, code));
  }

  protected async linkAll(): Promise<void> {
    const links = [...this.choices().entries()]
      .filter(([, code]) => code !== NONE)
      .map(([ingredientId, ciqualCode]) => ({ ingredientId, ciqualCode }));
    this.linking.set(true);
    const done = await attempt(this.api.invoke(linkIngredientsToCiqual, { body: { links } }));
    this.linking.set(false);
    if (done.ok) {
      this.toaster.success(links.length > 1 ? `${links.length} ingrédients liés à la table Ciqual` : 'Ingrédient lié à la table Ciqual');
      this.linked.emit();
      this.suggestions.reload();
    }
  }
}
