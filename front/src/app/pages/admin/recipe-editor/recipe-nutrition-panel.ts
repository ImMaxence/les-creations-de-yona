import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { linkIngredientsToCiqual } from '../../../core/api/generated/fn/admin-ingredients/link-ingredients-to-ciqual';
import { suggestIngredientNutrition } from '../../../core/api/generated/fn/admin-ingredients/suggest-ingredient-nutrition';
import { estimateRecipeNutrition } from '../../../core/api/generated/fn/admin-recipes/estimate-recipe-nutrition';
import { NutritionEstimateForm } from '../../../core/api/generated/models/nutrition-estimate-form';
import { NutritionSuggestion } from '../../../core/api/generated/models/nutrition-suggestion';
import { Toaster } from '../../../core/notifications/toaster';
import { formatGrams, formatKcal, missingReason } from '../../../shared/format/nutrition';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { PartDraft } from './recipe-draft';

const ESTIMATE_DELAY_MS = 600;
const MAX_NAME = 100;

/**
 * What the API accepts of the form being typed: lines without a name left out, a quantity it would refuse
 * (zero, too many decimals) sent without quantity, so that typing never shows an error. Null without any line.
 */
export function estimateForm(parts: PartDraft[], servings: number | null): NutritionEstimateForm | null {
  const sent = parts.slice(0, 10).map((part) => ({
    linkedRecipeId: part.linkedRecipeId ?? undefined,
    linkedRatio:
      part.linkedRecipeId && part.linkedRatio && part.linkedRatio >= 0.05 && part.linkedRatio <= 99
        ? Math.round(part.linkedRatio * 100) / 100
        : undefined,
    ingredients: part.linkedRecipeId
      ? []
      : part.ingredients
          .filter((line) => line.name.trim())
          .slice(0, 100)
          .map((line) => ({
            name: line.name.trim().slice(0, MAX_NAME),
            quantity:
              line.quantity && line.quantity > 0 && line.quantity < 1_000_000 ? Math.round(line.quantity * 100) / 100 || undefined : undefined,
            unit: line.unit.trim().slice(0, 30) || undefined,
          })),
  }));
  if (!sent.some((part) => part.linkedRecipeId || part.ingredients.length)) {
    return null;
  }
  return { servings: servings && servings > 0 && Number.isInteger(servings) ? servings : undefined, parts: sent };
}

/**
 * Under "Valeurs nutritionnelles" of the editor: the facts of the recipe as typed, what they leave out and why,
 * and a Ciqual food offered for each ingredient without values, linked in one click.
 */
@Component({
  selector: 'yona-recipe-nutrition-panel',
  imports: [Button, Icon, RouterLink],
  template: `
    @if (estimate.value(); as nutrition) {
      <div class="summary" aria-live="polite">
        <div class="summary__main">
          <strong class="summary__kcal">{{ formatKcal((nutrition.perServing ?? nutrition.total).kcal) }}</strong>
          <span class="field__hint">{{ nutrition.perServing ? 'par portion' : 'pour la recette (indiquez les portions)' }}</span>
        </div>
        @if (nutrition.nutriScore; as score) {
          <span class="summary__grade" [attr.data-grade]="score.grade">Nutri-Score estimé {{ score.grade }}</span>
        }
        <span class="admin-row__meta">
          Protéines {{ formatGrams((nutrition.perServing ?? nutrition.total).proteins) }} · Glucides
          {{ formatGrams((nutrition.perServing ?? nutrition.total).carbohydrates) }} · Lipides
          {{ formatGrams((nutrition.perServing ?? nutrition.total).fat) }}
        </span>
        <span class="admin-row__meta">
          {{ nutrition.countedLines }} ingrédient{{ nutrition.countedLines > 1 ? 's' : '' }} compté{{ nutrition.countedLines > 1 ? 's' : '' }},
          {{ formatGrams(nutrition.grams) }} en tout · {{ nutrition.ciqualVersion }}
        </span>
      </div>
      @if (nutrition.complete) {
        <p class="state state--complete">
          <svg yonaIcon="circle-check" [size]="16"></svg>
          Complètes : chaque ingrédient a ses valeurs{{ shown() ? ', affichées sur la recette' : '' }}
        </p>
      } @else {
        <p class="state state--incomplete" role="status">
          <svg yonaIcon="triangle-alert" [size]="16"></svg>
          Incomplètes : {{ shown() ? "la recette ne les affichera" : "elles ne s'afficheront" }} qu'une fois chaque ingrédient
          renseigné{{ shown() ? ' (Statistiques la liste parmi les recettes à compléter)' : '' }}
        </p>
      }
      @if (nutrition.missing.length) {
        <div class="missing">
          <p class="missing__title">Non comptés</p>
          <ul role="list" class="missing__list">
            @for (item of nutrition.missing; track item.name + item.reason) {
              <li class="missing__item">
                <span><strong>{{ item.name }}</strong> <span class="admin-row__meta">{{ reason(item) }}</span></span>
                @if (item.reason === 'NO_VALUES') {
                  @if (suggestionOf(item.name); as suggestion) {
                    @if (suggestion.foods[0]; as food) {
                      <button yonaButton variant="secondary" type="button" [disabled]="linking()" (click)="link(suggestion, food.code)">
                        <svg yonaIcon="link"></svg>Lier à « {{ food.name }} »
                      </button>
                    }
                    <a class="link-button" routerLink="/admin/ingredients" [queryParams]="{ q: item.name }">Autre choix</a>
                  } @else {
                    <span class="admin-row__meta">Nouvel ingrédient : enregistrez la recette pour lui donner ses valeurs</span>
                  }
                } @else if (item.reason === 'NO_WEIGHT') {
                  <a class="link-button" routerLink="/admin/ingredients" [queryParams]="{ q: item.name }">Indiquer le poids d'une pièce</a>
                }
              </li>
            }
          </ul>
        </div>
      }
    } @else if (!form()) {
      <p class="field__hint">Ajoutez des ingrédients pour voir l'estimation</p>
    } @else if (estimate.isLoading()) {
      <p class="field__hint">Calcul…</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-5);
    }

    .summary__main {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .summary__kcal {
      font-size: var(--text-xl);
    }

    .summary__grade {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      box-shadow: inset 0 0 0 1px var(--color-line);
      font-size: var(--text-sm);
      font-weight: 700;
    }

    .state {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 600;

      svg {
        flex: none;
        margin-top: 2px;
      }
    }

    .state--incomplete {
      color: var(--color-danger);
    }

    .missing {
      display: grid;
      gap: var(--space-2);
    }

    .missing__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }

    .missing__list {
      display: grid;
      gap: var(--space-2);
    }

    .missing__item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNutritionPanel {
  readonly parts = input.required<PartDraft[]>();
  readonly servings = input<number | null>(null);
  /** "Afficher les valeurs nutritionnelles" ticked. */
  readonly shown = input(false);

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly formatKcal = formatKcal;
  protected readonly formatGrams = formatGrams;
  protected readonly reason = missingReason;

  /** Asked again once the typing pauses, and only when what is sent changes. */
  protected readonly form = toSignal(
    toObservable(computed(() => estimateForm(this.parts(), this.servings()))).pipe(
      map((form) => ({ form, key: JSON.stringify(form) })),
      debounceTime(ESTIMATE_DELAY_MS),
      distinctUntilChanged((before, after) => before.key === after.key),
      map(({ form }) => form),
    ),
    { initialValue: null },
  );
  private readonly reloads = signal(0);
  protected readonly estimate = resource({
    params: () => {
      const form = this.form();
      return form ? { body: form, reload: this.reloads() } : undefined;
    },
    loader: ({ params }) => this.api.invoke(estimateRecipeNutrition, { body: params.body }),
  });

  /** The ingredients without values that the site has: a Ciqual food offered for each. */
  private readonly withoutValues = computed(() =>
    (this.estimate.value()?.missing ?? []).filter((item) => item.reason === 'NO_VALUES').map((item) => item.name),
  );
  protected readonly suggestions = resource({
    params: () => {
      const names = this.withoutValues();
      return names.length ? { name: names, reload: this.reloads() } : undefined;
    },
    loader: ({ params }) => this.api.invoke(suggestIngredientNutrition, { name: params.name }),
  });
  protected readonly linking = signal(false);

  protected suggestionOf(name: string): NutritionSuggestion | null {
    const folded = fold(name);
    return (this.suggestions.value() ?? []).find((suggestion) => fold(suggestion.ingredient.name) === folded) ?? null;
  }

  protected async link(suggestion: NutritionSuggestion, ciqualCode: number): Promise<void> {
    this.linking.set(true);
    const linked = await attempt(
      this.api.invoke(linkIngredientsToCiqual, { body: { links: [{ ingredientId: suggestion.ingredient.id, ciqualCode }] } }),
    );
    this.linking.set(false);
    if (linked.ok) {
      this.toaster.success(`« ${suggestion.ingredient.name} » compte désormais dans toutes ses recettes`);
      this.reloads.update((count) => count + 1);
    }
  }
}

function fold(name: string): string {
  return name.toLocaleLowerCase('fr').replace(/œ/g, 'oe').normalize('NFD').replace(/\p{M}/gu, '').trim();
}
