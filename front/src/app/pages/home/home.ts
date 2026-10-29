import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewRecipeNotifications } from '../../core/pwa/new-recipe-notifications';
import { SiteData } from '../../core/site/site-data';
import { categoryNames } from '../../shared/format/categories';
import { themeLabel } from '../../shared/format/themes';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION, isSameTabClick } from '../../shared/motion/view-transitions';
import { MENUS_PATH, RECIPES_PATH, categoryQueryParams, recipeLink } from '../../shared/routing/links';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { NotifyButton } from '../../shared/ui/notify-button/notify-button';
import { MenuCard } from '../menus/menu-card';
import { HomeData } from './home.resolver';
import { Icon } from '../../shared/ui/icon/icon';
import { SiteSearch } from '../../shared/ui/site-search/site-search';

const HOME_MENUS_COUNT = 3;

@Component({
  selector: 'yona-home',
  imports: [Icon, RouterLink, Button, CoverImage, MenuCard, NotifyButton, RecipeCard, Reveal, SiteSearch],
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
  private readonly notifications = inject(NewRecipeNotifications);
  protected readonly showNotify = computed(() => !['unknown', 'unsupported'].includes(this.notifications.state()));
  protected readonly categories = this.siteData.categories;
  protected readonly content = this.siteData.content;
  /** A blank line in the text written in the back-office starts a new paragraph. */
  protected readonly aboutParagraphs = computed(() => paragraphs(this.content().aboutText));
  protected readonly link = recipeLink;
  protected readonly themeLabel = themeLabel;
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

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
