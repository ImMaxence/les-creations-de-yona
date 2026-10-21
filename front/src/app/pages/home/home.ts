import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { SiteData } from '../../core/site/site-data';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION, isSameTabClick } from '../../shared/motion/view-transitions';
import { RECIPES_PATH, categoryQueryParams, recipeLink } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { HomeData } from './home.resolver';

@Component({
  selector: 'yona-home',
  imports: [RouterLink, LucideArrowRight, Button, CoverImage, RecipeCard, Reveal],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Home {
  /** From homeResolver, bound by withComponentInputBinding. */
  readonly data = input.required<HomeData>();

  protected readonly categories = inject(SiteData).categories;
  protected readonly featuredLink = computed(() => {
    const featured = this.data().featured;
    return featured ? recipeLink(featured) : null;
  });
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly featuredTransition = signal<string | null>(null);

  protected onFeaturedClick(event: MouseEvent): void {
    if (isSameTabClick(event)) {
      this.featuredTransition.set(RECIPE_IMAGE_TRANSITION);
    }
  }
}
