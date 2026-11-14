import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { linkIngredientsToCiqual } from '../../../core/api/generated/fn/admin-ingredients/link-ingredients-to-ciqual';
import { searchIngredients } from '../../../core/api/generated/fn/admin-ingredients/search-ingredients';
import { setIngredientPiece } from '../../../core/api/generated/fn/admin-ingredients/set-ingredient-piece';
import { suggestIngredientNutrition } from '../../../core/api/generated/fn/admin-ingredients/suggest-ingredient-nutrition';
import { estimateRecipeNutrition } from '../../../core/api/generated/fn/admin-recipes/estimate-recipe-nutrition';
import { IngredientResponse } from '../../../core/api/generated/models/ingredient-response';
import { NutritionEstimateForm } from '../../../core/api/generated/models/nutrition-estimate-form';
import { NutritionSuggestion } from '../../../core/api/generated/models/nutrition-suggestion';
import { Toaster } from '../../../core/notifications/toaster';
import {
  NutriScoreKind,
  UNUSUAL_SERVING_KCAL,
  formatGrams,
  formatKcal,
  missingReason,
  proteinClaimLabel,
} from '../../../shared/format/nutrition';
import { formatQuantity } from '../../../shared/format/units';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import { PartDraft } from './recipe-draft';

const ESTIMATE_DELAY_MS = 600;
const MAX_NAME = 100;
const MAX_COOKED_GRAMS = 100_000;

/**
 * What the API accepts of the form being typed: lines without a name left out, a quantity it would refuse
 * (zero, too many decimals) sent without quantity, so that typing never shows an error; the weight once cooked
 * only when it is one. Null without any line.
 */
export function estimateForm(
  parts: PartDraft[],
  servings: number | null,
  cookedGrams: number | null = null,
  nutriScoreKind: NutriScoreKind = 'GENERAL',
): NutritionEstimateForm | null {
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
  return {
    servings: servings && servings > 0 && Number.isInteger(servings) ? servings : undefined,
    cookedGrams:
      cookedGrams && Number.isInteger(cookedGrams) && cookedGrams >= 1 && cookedGrams <= MAX_COOKED_GRAMS ? cookedGrams : undefined,
    nutriScoreKind,
    parts: sent,
  };
}

/**
 * Under "Valeurs nutritionnelles" of the editor: the facts of the recipe as typed, the ingredients bringing the most
 * energy (a quantity typed wrong shows there), what they leave out and why, and a fix in one click for each: a Ciqual
 * food for an ingredient without values, the usual weight of a piece for one counted in pieces.
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
        @if (claim(); as claim) {
          <span class="summary__claim">{{ claim }} · {{ nutrition.proteinEnergyPercent }} % de l'énergie</span>
        }
        <span class="admin-row__meta">
          Protéines {{ formatGrams((nutrition.perServing ?? nutrition.total).proteins) }} · Glucides
          {{ formatGrams((nutrition.perServing ?? nutrition.total).carbohydrates) }} · Lipides
          {{ formatGrams((nutrition.perServing ?? nutrition.total).fat) }}
        </span>
        <span class="admin-row__meta">
          {{ nutrition.countedLines }} ingrédient{{ nutrition.countedLines > 1 ? 's' : '' }} compté{{ nutrition.countedLines > 1 ? 's' : '' }},
          {{ formatGrams(nutrition.grams) }} mangés en tout · {{ formatKcal(nutrition.per100g.kcal) }} pour 100 g
          {{ nutrition.cookedGrams ? 'du plat cuit' : 'cru' }} · {{ nutrition.ciqualVersion }}
        </span>
      </div>
      @if (nutrition.contributors.length) {
        <div class="contributors">
          <p class="missing__title">Ce qui apporte le plus d'énergie</p>
          <ol class="contributors__list">
            @for (item of nutrition.contributors; track item.name) {
              <li class="contributor">
                <span class="contributor__name">{{ item.name }}</span>
                <span class="contributor__bar" aria-hidden="true"><span [style.width.%]="item.percent"></span></span>
                <span class="admin-row__meta">{{ formatKcal(item.kcal) }} · {{ item.percent }} %</span>
              </li>
            }
          </ol>
        </div>
      }
      @if (unusual()) {
        <p class="state state--incomplete" role="status">
          <svg yonaIcon="triangle-alert" [size]="16"></svg>
          Plus de {{ formatKcal(unusualKcal) }} par portion : vérifiez les quantités ci-dessus et le nombre de portions
        </p>
      }
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
                  @if (weighable(item.name); as ingredient) {
                    <button yonaButton variant="secondary" type="button" [disabled]="linking()" (click)="usePiece(ingredient)">
                      <svg yonaIcon="calculator"></svg>{{ pieceLabel(ingredient) }}
                    </button>
                    <a class="link-button" routerLink="/admin/ingredients" [queryParams]="{ q: item.name }">Autre poids</a>
                  } @else {
                    <a class="link-button" routerLink="/admin/ingredients" [queryParams]="{ q: item.name }">Indiquer le poids d'une pièce</a>
                  }
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

    .summary__grade,
    .summary__claim {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      box-shadow: inset 0 0 0 1px var(--color-line);
      font-size: var(--text-sm);
      font-weight: 700;
    }

    .summary__claim {
      font-weight: 600;
      color: var(--color-accent);
    }

    .contributors {
      display: grid;
      gap: var(--space-2);
    }

    .contributors__list {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* The name, a bar of its share of the energy, its kcal: aligned from one row to the next */
    .contributor {
      display: grid;
      grid-template-columns: minmax(0, 12rem) minmax(4rem, 1fr) auto;
      align-items: center;
      gap: var(--space-3);
    }

    .contributor__name {
      overflow: hidden;
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .contributor__bar {
      height: 0.5rem;
      overflow: hidden;
      border-radius: var(--radius-pill);
      background-color: color-mix(in srgb, var(--color-line) 60%, transparent);

      span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background-color: var(--color-accent);
      }
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
  /** The whole recipe weighed once cooked, in grams. */
  readonly cookedGrams = input<number | null>(null);
  readonly nutriScoreKind = input<NutriScoreKind>('GENERAL');
  /** "Afficher les valeurs nutritionnelles" ticked. */
  readonly shown = input(false);

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly formatKcal = formatKcal;
  protected readonly formatGrams = formatGrams;
  protected readonly reason = missingReason;
  protected readonly unusualKcal = UNUSUAL_SERVING_KCAL;

  /** Asked again once the typing pauses, and only when what is sent changes. */
  protected readonly form = toSignal(
    toObservable(computed(() => estimateForm(this.parts(), this.servings(), this.cookedGrams(), this.nutriScoreKind()))).pipe(
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

  protected readonly claim = computed(() => proteinClaimLabel(this.estimate.value()?.proteinClaim));
  /** A serving heavier than a meal of a whole day, or nearly: probably a quantity typed wrong. */
  protected readonly unusual = computed(() => (this.estimate.value()?.perServing?.kcal ?? 0) > UNUSUAL_SERVING_KCAL);

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

  /** The ingredients counted in pieces without the weight of one: their usual weight offered. */
  private readonly withoutWeight = computed(() =>
    (this.estimate.value()?.missing ?? []).filter((item) => item.reason === 'NO_WEIGHT').map((item) => item.name),
  );
  private readonly pieces = resource({
    params: () => {
      const names = this.withoutWeight();
      return names.length ? { names, reload: this.reloads() } : undefined;
    },
    loader: async ({ params }) => {
      const found = await Promise.all(params.names.map((name) => this.api.invoke(searchIngredients, { q: name.slice(0, 100) })));
      return found.flat();
    },
  });
  protected readonly linking = signal(false);

  protected suggestionOf(name: string): NutritionSuggestion | null {
    const folded = fold(name);
    return (this.suggestions.value() ?? []).find((suggestion) => fold(suggestion.ingredient.name) === folded) ?? null;
  }

  /** The ingredient of that name, when the site knows the usual weight of one piece of it. */
  protected weighable(name: string): IngredientResponse | null {
    const folded = fold(name);
    return (this.pieces.value() ?? []).find((ingredient) => fold(ingredient.name) === folded && ingredient.usual?.piece) ?? null;
  }

  /** "1 rouleau = 230 g". */
  protected pieceLabel(ingredient: IngredientResponse): string {
    const piece = ingredient.usual!.piece!;
    return `1 ${piece.singular} = ${formatQuantity(piece.grams)} g`;
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

  /** Its usual weight, for every recipe counting it in pieces. */
  protected async usePiece(ingredient: IngredientResponse): Promise<void> {
    this.linking.set(true);
    const saved = await attempt(this.api.invoke(setIngredientPiece, { id: ingredient.id, body: { piece: ingredient.usual!.piece! } }));
    this.linking.set(false);
    if (saved.ok) {
      this.toaster.success(`${this.pieceLabel(ingredient)} : « ${ingredient.name} » compte désormais dans toutes ses recettes`);
      this.reloads.update((count) => count + 1);
    }
  }
}

function fold(name: string): string {
  return name.toLocaleLowerCase('fr').replace(/œ/g, 'oe').normalize('NFD').replace(/\p{M}/gu, '').trim();
}
