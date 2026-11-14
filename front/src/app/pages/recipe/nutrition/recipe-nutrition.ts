import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RecipeNutrition as RecipeNutritionModel } from '../../../core/api/generated/models/recipe-nutrition';
import {
  NUTRIENT_ROWS,
  NUTRI_SCORE_GRADES,
  estimateNote,
  formatKcal,
  missingNames,
  nutriScoreAs,
  nutritionSource,
  proteinClaimLabel,
} from '../../../shared/format/nutrition';
import { Icon } from '../../../shared/ui/icon/icon';
import { RecipeDailyNeeds } from './recipe-daily-needs';

/** On the page of a recipe, the anchor of its nutrition facts (from the facts at the top). */
export const NUTRITION_ANCHOR = 'valeurs-nutritionnelles';

/**
 * "Valeurs nutritionnelles": what a serving holds and the Nutri-Score estimated by the site, then "Mes besoins
 * du jour" (RecipeDailyNeeds), which puts a serving against the energy the visitor needs.
 */
@Component({
  selector: 'yona-recipe-nutrition',
  imports: [Icon, RecipeDailyNeeds],
  templateUrl: './recipe-nutrition.html',
  styleUrl: './recipe-nutrition.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNutrition {
  readonly nutrition = input.required<RecipeNutritionModel>();

  protected readonly anchor = NUTRITION_ANCHOR;
  protected readonly grades = NUTRI_SCORE_GRADES;
  protected readonly rows = NUTRIENT_ROWS;
  protected readonly formatKcal = formatKcal;

  /** Per serving; the whole recipe when it gives no servings. */
  protected readonly byServing = computed(() => this.nutrition().perServing != null);
  protected readonly portion = computed(() => this.nutrition().perServing ?? this.nutrition().total);
  protected readonly missing = computed(() => missingNames(this.nutrition()));
  protected readonly source = computed(() => nutritionSource(this.nutrition()));
  /** Raw, or per 100 g of the dish once cooked. */
  protected readonly estimate = computed(() => estimateNote(this.nutrition()));
  /** "une boisson": the grid of its Nutri-Score. */
  protected readonly gradedAs = computed(() => nutriScoreAs(this.nutrition().nutriScoreKind));
  /** "Riche en protéines", by the European rules; null below 12 % of the energy. */
  protected readonly claim = computed(() => proteinClaimLabel(this.nutrition().proteinClaim));

  protected gradeLabel(grade: string): string {
    return `Nutri-Score estimé : ${grade}`;
  }
}
