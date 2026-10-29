import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SiteData } from '../../core/site/site-data';
import { Reveal } from '../../shared/motion/reveal';
import { keepScrollThroughNextNavigation } from '../../shared/routing/kept-scroll';
import { RECIPES_PATH } from '../../shared/routing/links';
import { THEMES, Theme, themeLabel, themeSlug } from '../../shared/format/themes';
import { MAX_SERVINGS, SearchChoice, searchTarget, servingsIn } from '../../shared/search/search-target';
import { Button } from '../../shared/ui/button/button';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { RecipeCard } from '../../shared/ui/recipe-card/recipe-card';
import { SearchBox } from '../../shared/ui/search-box/search-box';
import { Select, SelectOption } from '../../shared/ui/select/select';
import {
  DEFAULT_PAGE_SIZE,
  DifficultyFilter,
  MAX_INGREDIENTS,
  PAGE_SIZES,
  RECIPES_QUERY,
  RecipesPageData,
  TIME_FILTERS,
  sameName,
} from './recipes.resolver';
import { Icon } from '../../shared/ui/icon/icon';

/** "Pour combien de personnes ?": the usual numbers; any other one comes from the search. */
const SERVINGS_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20] as const;

@Component({
  selector: 'yona-recipes',
  imports: [
    Icon,
    RouterLink,
    Button,
    Pagination,
    RecipeCard,
    Reveal,
    SearchBox,
    Select,
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

  private readonly router = inject(Router);
  /** A change of page size keeps the visitor where they are; a change of page goes to the top. */
  private readonly keepScroll = keepScrollThroughNextNavigation();
  protected readonly categories = inject(SiteData).categories;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly pageSizeOptions: SelectOption<number>[] = PAGE_SIZES.map((size) => ({
    value: size,
    label: String(size),
  }));

  protected readonly filters = computed(() => this.data().filters);
  /**
   * "Pour 8 personnes", or "tarte 8 personnes" searched: each recipe opens with its quantities for
   * 8. Not a filter: every recipe adapts to any number of people.
   */
  protected readonly servings = computed(() => {
    const asked = Number(this.portions());
    return asked >= 1 && asked <= MAX_SERVINGS ? asked : servingsIn(this.filters().search);
  });
  protected readonly themes = THEMES;
  protected readonly themeLabel = themeLabel;
  protected readonly servingsOptions: SelectOption<number | null>[] = [
    { value: null, label: 'Comme la recette' },
    ...SERVINGS_CHOICES.map((count) => ({ value: count, label: `Pour ${count} personne${count > 1 ? 's' : ''}` })),
  ];
  protected readonly result = computed(() => this.data().result);
  protected readonly activeCategory = computed(
    () => this.categories().find((category) => category.slug === this.filters().category) ?? null,
  );
  protected readonly activeTag = computed(() => this.data().tags.find((tag) => tag.slug === this.filters().tag) ?? null);
  /** Tag, time and difficulty: shown on phones once asked for, or when one is in use. */
  protected readonly moreFiltersCount = computed(
    () =>
      Number(this.filters().tag !== null) +
      Number(this.filters().maxMinutes !== null) +
      Number(this.filters().difficulty !== null),
  );
  protected readonly showMoreFilters = signal(false);
  protected readonly hasFilters = computed(
    () =>
      this.filters().search !== '' ||
      this.filters().theme !== null ||
      this.servings() !== null ||
      this.filters().category !== null ||
      this.filters().ingredients.length > 0 ||
      this.moreFiltersCount() > 0,
  );
  /** "Effacer tous les filtres": every recipe again, keeping only the number per page chosen. */
  protected readonly clearedQuery = computed(() => ({
    [RECIPES_QUERY.pageSize]: this.filters().pageSize === DEFAULT_PAGE_SIZE ? null : this.filters().pageSize,
  }));
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

  /** Kept in the URL: the cards open their recipe for that many people. */
  protected changeServings(servings: number | null | undefined): void {
    this.keepScroll();
    this.updateQuery({ [RECIPES_QUERY.servings]: servings ?? null });
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

  protected changePageSize(pageSize: number | undefined): void {
    this.keepScroll();
    this.updateQuery({
      [RECIPES_QUERY.pageSize]: pageSize === DEFAULT_PAGE_SIZE ? null : (pageSize ?? null),
      [RECIPES_QUERY.page]: null,
    });
  }

  private updateQuery(queryParams: Record<string, string | string[] | number | null>): void {
    this.router.navigate([RECIPES_PATH], { queryParams, queryParamsHandling: 'merge' });
  }
}
