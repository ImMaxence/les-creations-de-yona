import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideChefHat, LucideClock, LucideCookingPot } from '@lucide/angular';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { formatMinutes } from '../../shared/format/units';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION } from '../../shared/motion/view-transitions';
import { RECIPES_PATH, categoryQueryParams } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { RecipeIngredients } from './ingredients/recipe-ingredients';
import { RecipeSteps } from './steps/recipe-steps';

@Component({
  selector: 'yona-recipe',
  imports: [
    RouterLink,
    Button,
    CoverImage,
    ParisDatePipe,
    RecipeIngredients,
    RecipeSteps,
    Reveal,
    LucideArrowRight,
    LucideChefHat,
    LucideClock,
    LucideCookingPot,
  ],
  templateUrl: './recipe.html',
  styleUrl: './recipe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Recipe {
  /** From recipeResolver. */
  readonly recipe = input.required<RecipeDetail>();

  protected readonly recipesPath = RECIPES_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly formatMinutes = formatMinutes;
  protected readonly imageTransition = RECIPE_IMAGE_TRANSITION;

  protected readonly totalMinutes = computed(
    () => (this.recipe().prepMinutes ?? 0) + (this.recipe().cookMinutes ?? 0),
  );
}
