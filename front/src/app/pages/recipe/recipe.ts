import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideChefHat,
  LucideClock,
  LucideCookingPot,
  LucideGauge,
  LucideShare2,
} from '@lucide/angular';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { Toaster } from '../../core/notifications/toaster';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { formatMinutes } from '../../shared/format/units';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION } from '../../shared/motion/view-transitions';
import { RECIPES_PATH, categoryQueryParams, mainCategory } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { DifficultyStars } from '../../shared/ui/difficulty-stars/difficulty-stars';
import { YoutubeVideo } from '../../shared/ui/youtube-video/youtube-video';
import { IngredientList } from './ingredient-list/ingredient-list';
import { RecipeIngredients } from './ingredients/recipe-ingredients';
import { hasParts, shownIngredients, totalIngredients } from './recipe-parts';
import { RecipeSteps } from './steps/recipe-steps';

@Component({
  selector: 'yona-recipe',
  imports: [
    RouterLink,
    Button,
    CoverImage,
    DifficultyStars,
    YoutubeVideo,
    ParisDatePipe,
    IngredientList,
    RecipeIngredients,
    RecipeSteps,
    Reveal,
    LucideArrowLeft,
    LucideArrowRight,
    LucideChefHat,
    LucideClock,
    LucideCookingPot,
    LucideGauge,
    LucideShare2,
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
  protected readonly mainCategory = computed(() => mainCategory(this.recipe()));

  /** Servings chosen by the visitor; back to the recipe's own when the recipe changes. */
  protected readonly servings = linkedSignal(() => this.recipe().servings ?? null);
  /** Applied to every quantity, in the total and in the parts. */
  private readonly ratio = computed(() => {
    const base = this.recipe().servings;
    const chosen = this.servings();
    return base && chosen ? chosen / base : 1;
  });
  protected readonly hasParts = computed(() => hasParts(this.recipe().parts));
  protected readonly ingredients = computed(() => totalIngredients(this.recipe().parts, this.ratio()));
  protected readonly parts = computed(() =>
    this.recipe().parts.map((part, index) => ({
      title: part.title ?? '',
      anchor: `partie-${index + 1}`,
      ingredients: shownIngredients(part.ingredients, this.ratio()),
      steps: part.steps,
    })),
  );

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly toaster = inject(Toaster);

  /**
   * The phone's own share sheet (messages, WhatsApp…) where there is one; otherwise the link is
   * copied. The canonical address is shared, without the query of the page the visitor came from.
   */
  protected async share(): Promise<void> {
    const url = `${window.location.origin}${window.location.pathname}`;
    const title = this.recipe().title;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title}, une recette des créations de Yona`, url });
      } catch {
        // Closed without sharing (AbortError), nothing to report
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toaster.success('Lien de la recette copié : collez-le où vous voulez le partager.');
    } catch {
      this.toaster.error(`Copie impossible. Voici le lien : ${url}`);
    }
  }

  /** Back to the previous page of the site if there is one; otherwise the link leads to the category. */
  protected goBack(event: MouseEvent): void {
    const openedFromTheSite = this.router.lastSuccessfulNavigation()?.previousNavigation != null;
    if (openedFromTheSite && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      this.location.back();
    }
  }
}
