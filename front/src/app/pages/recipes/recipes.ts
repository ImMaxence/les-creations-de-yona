import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { SiteData } from '../../core/site/site-data';
import { Reveal } from '../../shared/motion/reveal';
import { keepScrollThroughNextNavigation } from '../../shared/routing/kept-scroll';
import { RECIPES_PATH } from '../../shared/routing/links';
import { THEMES, Theme, themeLabel, themeSlug } from '../../shared/format/themes';
import { MAX_SERVINGS, SearchChoice, searchTarget, servingsIn } from '../../shared/search/search-target';
import { Button } from '../../shared/ui/button/button';
import { InfiniteList } from '../../shared/ui/infinite-scroll/infinite-list';
import { InfiniteScroll } from '../../shared/ui/infinite-scroll/infinite-scroll';
import { VirtualItem } from '../../shared/ui/infinite-scroll/virtual-item';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { SearchBox } from '../../shared/ui/search-box/search-box';
import { Select, SelectOption } from '../../shared/ui/select/select';
import {
  DifficultyFilter,
  MAX_INGREDIENTS,
  NutritionFilter,
  RECIPES_QUERY,
  RecipesPageData,
  TIME_FILTERS,
  recipesApiQuery,
  sameName,
} from './recipes.resolver';
import { Icon } from '../../shared/ui/icon/icon';
import { Segmented } from '../../shared/ui/segmented/segmented';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { SlowNavigation, pathOf } from '../../core/layout/page-skeleton/slow-navigation';

/** The first tap on + from nothing: a meal for two, then one more at each tap. */
const FIRST_SERVINGS = 2;

/** Taps and typing on the counter are written to the URL once the visitor pauses. */
const SERVINGS_DELAY_MS = 500;

@Component({
  selector: 'yona-recipes',
  imports: [
    Icon,
    RouterLink,
    Button,
    InfiniteScroll,
    RecipeCard,
    Reveal,
    SearchBox,
    Segmented,
    Select,
    Skeleton,
    VirtualItem,
  ],
  templateUrl: './recipes.html',
  styleUrl: './recipes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Recipes {
  /** From recipesResolver, run again on every query parameter change. */
  readonly data = input.required<RecipesPageData>();
  /** ?portions=8, chosen on the page or from the search: carried to the recipes opened. */
  readonly portions = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  /** A change of the number of people keeps the visitor where they are. */
  private readonly keepScroll = keepScrollThroughNextNavigation();
  private readonly siteData = inject(SiteData);
  protected readonly categories = this.siteData.categories;
  protected readonly recipesPath = RECIPES_PATH;

  protected readonly filters = computed(() => this.data().filters);
  private readonly slowNavigation = inject(SlowNavigation);
  /** Other filters, slow to apply: the cards to come, in grey, in place of the old ones. */
  protected readonly filtering = computed(() => {
    const target = this.slowNavigation.target();
    return !!target && pathOf(target) === RECIPES_PATH;
  });
  /** The first page comes with the resolver (rendered by the server), the next ones as the visitor goes down. */
  protected readonly list = new InfiniteList({
    first: () => this.data().result,
    params: () => this.filters(),
    load: (page, filters) => this.api.invoke(listPublishedRecipes, { ...recipesApiQuery(filters), page }),
    key: (recipe) => recipe.slug,
  });
  /**
   * "Pour 8 personnes", or "tarte 8 personnes" searched: each recipe opens with its quantities for
   * 8. Not a filter: every recipe adapts to any number of people.
   */
  protected readonly servings = computed(() => {
    const asked = Number(this.portions());
    return asked >= 1 && asked <= MAX_SERVINGS ? asked : servingsIn(this.filters().search);
  });
  /**
   * The counter "Nombre de personnes": changed at once on screen (and on the cards' links), written
   * to the URL a moment later, so that each tap does not load the list again.
   */
  protected readonly chosenServings = linkedSignal(() => this.servings());
  protected readonly maxServings = MAX_SERVINGS;
  private servingsTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly themes = THEMES;
  protected readonly themeLabel = themeLabel;
  protected readonly result = computed(() => this.data().result);
  protected readonly activeCategory = computed(
    () => this.categories().find((category) => category.slug === this.filters().category) ?? null,
  );
  protected readonly activeTag = computed(() => this.data().tags.find((tag) => tag.slug === this.filters().tag) ?? null);
  /** Tag, time, difficulty and nutrition: shown on phones once asked for, or when one is in use. */
  protected readonly moreFiltersCount = computed(
    () =>
      Number(this.filters().tag !== null) +
      Number(this.filters().maxMinutes !== null) +
      Number(this.filters().difficulty !== null) +
      Number(this.filters().nutrition !== null),
  );
  /** Once a published recipe shows its nutrition facts per serving; kept while in use, to be taken off. */
  protected readonly showNutritionFilter = computed(() => this.siteData.nutritionFilters() || this.filters().nutrition !== null);
  protected readonly nutritionOptions: SelectOption<NutritionFilter | null>[] = [
    { value: null, label: 'Toutes les recettes' },
    { value: 'leger', label: 'Léger : 500 kcal max la portion' },
    { value: 'proteines', label: 'Riche en protéines' },
  ];
  protected readonly nutritionLabel = computed(() =>
    this.filters().nutrition === 'leger' ? 'léger' : this.filters().nutrition === 'proteines' ? 'riche en protéines' : null,
  );
  /** Phones: every filter is folded behind one button, which says how many are in use. */
  protected readonly filtersOpen = signal(false);
  protected readonly activeFiltersCount = computed(
    () =>
      Number(this.filters().theme !== null) +
      Number(this.chosenServings() !== null) +
      Number(this.filters().category !== null) +
      this.filters().ingredients.length +
      this.moreFiltersCount(),
  );
  protected readonly showMoreFilters = signal(false);
  /** Tag, time and difficulty: shown once asked for, or when one is in use. */
  protected readonly moreShown = computed(() => this.showMoreFilters() || this.moreFiltersCount() > 0);
  protected readonly hasFilters = computed(
    () =>
      this.filters().search !== '' ||
      this.filters().theme !== null ||
      this.chosenServings() !== null ||
      this.filters().category !== null ||
      this.filters().ingredients.length > 0 ||
      this.moreFiltersCount() > 0,
  );
  protected readonly tagOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Tous les tags' },
    ...this.data().tags.map((tag) => ({ value: tag.slug, label: tag.name })),
  ]);
  protected readonly timeOptions: SelectOption<number | null>[] = [
    { value: null, label: 'Tous les temps' },
    ...TIME_FILTERS.map((minutes) => ({
      value: minutes,
      label: minutes < 60 ? `Prêt en ${minutes} min max` : 'Prêt en 1 h max',
    })),
  ];
  protected readonly difficultyOptions: SelectOption<DifficultyFilter | null>[] = [
    { value: null, label: 'Toutes difficultés' },
    { value: 'facile', label: 'Facile (1 à 2 étoiles)' },
    { value: 'moyenne', label: 'Moyenne (2,5 à 3,5)' },
    { value: 'difficile', label: 'Difficile (4 à 5)' },
  ];
  /** A drop-down rather than a row of chips: the categories grow in number. */
  protected readonly categoryOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes les catégories' },
    ...this.categories().map((category) => ({ value: category.slug, label: category.name })),
  ]);
  /**
   * The ingredients of the search, from the URL; changed at once on a pick or a removal, before
   * the results arrive, so that the chips and the list do not wait for them.
   */
  protected readonly chosenIngredients = linkedSignal(() => this.filters().ingredients);
  /** Ingredients of the published recipes, but those already chosen: picked one after the other. */
  protected readonly ingredientOptions = computed<SelectOption<string>[]>(() => {
    const chosen = this.chosenIngredients();
    return this.data()
      .ingredients.filter((name) => !chosen.some((known) => sameName(known, name)))
      .map((name) => ({ value: name, label: name }));
  });
  protected readonly maxIngredients = MAX_INGREDIENTS;
  /** « œufs » et « chocolat ». */
  protected readonly ingredientsLabel = computed(() => {
    const quoted = this.filters().ingredients.map((name) => `« ${name} »`);
    return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} et ${quoted.at(-1)}` : (quoted[0] ?? '');
  });
  protected readonly countLabel = computed(() => {
    const count = this.result().totalElements;
    return count === 0 ? 'Aucune recette' : count === 1 ? '1 recette' : `${count} recettes`;
  });

  protected changeTheme(theme: Theme | null): void {
    this.updateQuery({ [RECIPES_QUERY.theme]: theme ? themeSlug(theme) : null, [RECIPES_QUERY.page]: null });
  }

  /** − and +: from nothing, + starts at 2. */
  protected stepServings(step: number): void {
    const current = this.chosenServings();
    this.setServings(current ? current + step : step > 0 ? FIRST_SERVINGS : null);
  }

  /** Typed in the counter: a number from 1 to 50, or nothing (each recipe's own quantities). */
  protected typeServings(event: Event): void {
    const typed = Math.round(Number((event.target as HTMLInputElement).value));
    this.setServings(typed >= 1 ? typed : null);
  }

  /** Kept in the URL: the cards open their recipe for that many people. Null: as each recipe is written. */
  protected setServings(servings: number | null): void {
    const count = servings === null ? null : Math.min(MAX_SERVINGS, Math.max(1, servings));
    this.chosenServings.set(count);
    clearTimeout(this.servingsTimer);
    this.servingsTimer = setTimeout(() => {
      this.keepScroll();
      void this.router.navigate([RECIPES_PATH], {
        queryParams: { [RECIPES_QUERY.servings]: count },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }, SERVINGS_DELAY_MS);
  }

  protected changeCategory(slug: string | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.category]: slug || null, [RECIPES_QUERY.page]: null });
  }

  protected changeTag(slug: string | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.tag]: slug || null, [RECIPES_QUERY.page]: null });
  }

  protected changeTime(minutes: number | null | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.time]: minutes ?? null, [RECIPES_QUERY.page]: null });
  }

  protected changeDifficulty(difficulty: DifficultyFilter | null | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.difficulty]: difficulty ?? null, [RECIPES_QUERY.page]: null });
  }

  protected changeNutrition(nutrition: NutritionFilter | null | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.nutrition]: nutrition ?? null, [RECIPES_QUERY.page]: null });
  }

  protected addIngredient(name: string): void {
    this.changeIngredients([...this.chosenIngredients(), name]);
  }

  protected removeIngredient(name: string): void {
    this.changeIngredients(this.chosenIngredients().filter((known) => known !== name));
  }

  private changeIngredients(names: string[]): void {
    this.chosenIngredients.set(names);
    this.updateQuery({ [RECIPES_QUERY.ingredient]: names.length ? names : null, [RECIPES_QUERY.page]: null });
  }

  protected search(search: string): void {
    this.updateQuery({ [RECIPES_QUERY.search]: search || null, [RECIPES_QUERY.page]: null });
  }

  /** A recipe, a category, a tag, an ingredient or a menu suggested by the search. */
  protected open(choice: SearchChoice): void {
    const { commands, queryParams } = searchTarget(choice.pick, choice.servings);
    this.router.navigate(commands, { queryParams });
  }

  private updateQuery(queryParams: Record<string, string | string[] | number | null>): void {
    this.router.navigate([RECIPES_PATH], { queryParams, queryParamsHandling: 'merge' });
  }
}
