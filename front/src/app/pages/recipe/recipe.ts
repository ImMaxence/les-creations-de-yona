import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RecipeViews } from '../../core/analytics/recipe-views';
import { GlossaryTermResponse } from '../../core/api/generated/models/glossary-term-response';
import { Mold } from '../../core/api/generated/models/mold';
import { RecipeCard as RecipeCardModel } from '../../core/api/generated/models/recipe-card';
import { RecipeDetail } from '../../core/api/generated/models/recipe-detail';
import { Favorites } from '../../core/kitchen/favorites';
import { RecipeNotes } from '../../core/kitchen/recipe-notes';
import { ShoppingList, shoppingRecipeOf } from '../../core/kitchen/shopping-list';
import { Toaster } from '../../core/notifications/toaster';
import { absoluteUrl } from '../../core/seo/page-seo';
import { glossaryMatcher } from '../../shared/format/glossary';
import { MarkdownPipe } from '../../shared/format/markdown.pipe';
import { ParisDatePipe } from '../../shared/format/paris-date.pipe';
import { formatMinutes } from '../../shared/format/units';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPE_IMAGE_TRANSITION } from '../../shared/motion/view-transitions';
import {
  RECIPES_PATH,
  SHOPPING_LIST_PATH,
  categoryQueryParams,
  mainCategory,
  recipeLink,
  tagQueryParams,
} from '../../shared/routing/links';
import { BrandIcon } from '../../shared/ui/brand-icon/brand-icon';
import { Button } from '../../shared/ui/button/button';
import { CoverImage } from '../../shared/ui/cover-image/cover-image';
import { DifficultyStars } from '../../shared/ui/difficulty-stars/difficulty-stars';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { YoutubeVideo } from '../../shared/ui/youtube-video/youtube-video';
import { CookingMode } from './cooking-mode/cooking-mode';
import { IngredientList } from './ingredient-list/ingredient-list';
import { RecipeIngredients } from './ingredients/recipe-ingredients';
import { RecipeNotesEditor } from './notes/recipe-notes';
import { RecipePlanner } from './planner/recipe-planner';
import { hasParts, moldArea, shownIngredients, totalIngredients } from './recipe-parts';
import { RecipeSteps } from './steps/recipe-steps';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'yona-recipe',
  imports: [
    Icon,
    RouterLink,
    BrandIcon,
    Button,
    CookingMode,
    CoverImage,
    DifficultyStars,
    YoutubeVideo,
    ParisDatePipe,
    IngredientList,
    MarkdownPipe,
    RecipeCard,
    RecipeIngredients,
    RecipeNotesEditor,
    RecipePlanner,
    RecipeSteps,
    Reveal,
  ],
  templateUrl: './recipe.html',
  styleUrl: './recipe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Recipe {
  /** From recipeResolver. */
  readonly recipe = input.required<RecipeDetail>();
  /** From relatedRecipesResolver: "Vous aimerez aussi". */
  readonly related = input<RecipeCardModel[]>([]);
  /** From glossaryResolver: the words underlined in the steps. */
  readonly glossary = input<GlossaryTermResponse[]>([]);

  protected readonly recipesPath = RECIPES_PATH;
  protected readonly shoppingListPath = SHOPPING_LIST_PATH;
  protected readonly categoryQueryParams = categoryQueryParams;
  protected readonly tagQueryParams = tagQueryParams;
  protected readonly formatMinutes = formatMinutes;
  protected readonly imageTransition = RECIPE_IMAGE_TRANSITION;

  protected readonly totalMinutes = computed(
    () => (this.recipe().prepMinutes ?? 0) + (this.recipe().restMinutes ?? 0) + (this.recipe().cookMinutes ?? 0),
  );
  /** "Total" is worth showing once two times at least are given. */
  protected readonly showTotal = computed(
    () => [this.recipe().prepMinutes, this.recipe().restMinutes, this.recipe().cookMinutes].filter(Boolean).length > 1,
  );
  protected readonly glossaryMatcher = computed(() => glossaryMatcher(this.glossary()));
  protected readonly mainCategory = computed(() => mainCategory(this.recipe()));
  /** Its route, for the timers of the cooking mode, found again from any page. */
  protected readonly recipeLink = computed(() => recipeLink(this.recipe()));

  /** Servings chosen by the visitor; back to the recipe's own when the recipe changes. */
  protected readonly servings = linkedSignal(() => this.recipe().servings ?? null);
  /** The visitor's mold, instead of the recipe's: quantities follow its area. */
  protected readonly chosenMold = linkedSignal<RecipeDetail, Mold | null>({
    source: this.recipe,
    computation: () => null,
  });
  /** Applied to every quantity, in the total and in the parts. */
  private readonly ratio = computed(() => {
    const mold = this.recipe().mold;
    const chosenMold = this.chosenMold();
    if (mold && chosenMold) {
      return moldArea(chosenMold) / moldArea(mold);
    }
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

  protected readonly hasSteps = computed(() => this.parts().some((part) => part.steps.length > 0));
  private readonly cookingMode = viewChild.required(CookingMode);

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly toaster = inject(Toaster);
  private readonly favorites = inject(Favorites);
  private readonly shoppingList = inject(ShoppingList);
  private readonly recipeNotes = inject(RecipeNotes);
  private readonly recipeViews = inject(RecipeViews);

  /** "Mes notes", shown again in the cooking mode. */
  protected readonly notes = computed(() => this.recipeNotes.of(this.recipe().slug));
  protected readonly isFavorite = computed(() => this.favorites.list().some((card) => card.slug === this.recipe().slug));
  protected readonly inShoppingList = computed(() =>
    this.shoppingList.recipes().some((recipe) => recipe.slug === this.recipe().slug),
  );

  /**
   * "Épingler": Pinterest's own page to save a pin, opened as a plain link (no script of theirs on
   * the site). The vertical photo when there is one, the recipe's photo otherwise.
   */
  protected readonly pinterestLink = computed(() => {
    const recipe = this.recipe();
    const imageId = recipe.pinterestImageId ?? recipe.imageId;
    const params = new URLSearchParams({ url: absoluteUrl(recipeLink(recipe).join('/')), description: recipe.title });
    if (imageId) {
      params.set('media', absoluteUrl(`/api/images/${imageId}/1600.webp`));
    }
    return `https://www.pinterest.com/pin/create/button/?${params}`;
  });

  constructor() {
    // A view of the site's page, not of the back-office preview, which shows this page too
    effect(() => {
      const slug = this.recipe().slug;
      untracked(() => {
        if (!this.router.url.startsWith('/admin')) {
          this.recipeViews.count(slug);
        }
      });
    });
  }

  protected toggleFavorite(): void {
    const added = this.favorites.toggle(this.recipe());
    this.toaster.success(added ? 'Ajoutée à vos favoris' : 'Retirée de vos favoris');
  }

  /** With the servings chosen: the quantities are those shown. Added again, it is updated. */
  protected addToShoppingList(): void {
    const recipe = this.recipe();
    const ratio = this.ratio();
    // With the visitor's mold: the servings it makes, roughly
    const servings =
      this.chosenMold() && recipe.servings ? Math.max(1, Math.round(recipe.servings * ratio)) : this.servings();
    this.shoppingList.add(shoppingRecipeOf(recipe, ratio, servings));
    this.toaster.success('Ingrédients ajoutés à votre liste de courses');
  }

  protected startCooking(): void {
    this.cookingMode().start();
  }

  protected print(): void {
    window.print();
  }

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
      this.toaster.success('Lien de la recette copié : collez-le où vous voulez le partager');
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
