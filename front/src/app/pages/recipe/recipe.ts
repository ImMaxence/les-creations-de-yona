import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideChefHat, LucideClock, LucideCookingPot } from '@lucide/angular';
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
    LucideArrowLeft,
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

  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Back to the previous page of the site if there is one; otherwise the link leads to the category. */
  protected goBack(event: MouseEvent): void {
    const openedFromTheSite = this.router.lastSuccessfulNavigation()?.previousNavigation != null;
    if (openedFromTheSite && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      this.location.back();
    }
  }
}
