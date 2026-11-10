import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteData } from '../../core/site/site-data';
import { categoryNames } from '../../shared/format/categories';
import { themeLabel, themeSlug } from '../../shared/format/themes';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION, isSameTabClick } from '../../shared/motion/view-transitions';
import { MENUS_PATH, RECIPES_PATH, SHOP_PATH, categoryQueryParams, recipeLink } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { MenuCard } from '../menus/menu-card';
import { AboutZone } from './about-zone';
import { HomeData } from './home.resolver';
import { Icon } from '../../shared/ui/icon/icon';
import { SiteSearch } from '../../shared/ui/site-search/site-search';

const HOME_MENUS_COUNT = 3;

@Component({
  selector: 'yona-home',
  imports: [AboutZone, Icon, RouterLink, Button, CoverImage, MenuCard, RecipeCard, Reveal, SiteSearch],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Home {
  /** From homeResolver, bound by withComponentInputBinding. */
  readonly data = input.required<HomeData>();

  protected readonly siteData = inject(SiteData);
  /** The three latest updated menus. */
  protected readonly menus = computed(() => this.siteData.menus().slice(0, HOME_MENUS_COUNT));
  protected readonly menusPath = MENUS_PATH;
  protected readonly shopPath = SHOP_PATH;
  protected readonly categories = this.siteData.categories;
  protected readonly content = this.siteData.content;
  protected readonly link = recipeLink;
  protected readonly themeLabel = themeLabel;
  protected readonly themeSlug = themeSlug;
  protected readonly imageTransition = RECIPE_IMAGE_TRANSITION;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly categoryNames = categoryNames;
  /** Slug of the featured recipe opened: its photo flies to the recipe page. */
  protected readonly featuredTransition = signal<string | null>(null);

  protected onFeaturedClick(event: MouseEvent, slug: string): void {
    if (isSameTabClick(event)) {
      this.featuredTransition.set(slug);
    }
  }
}
