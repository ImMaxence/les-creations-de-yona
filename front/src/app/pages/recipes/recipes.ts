import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, Scroll } from '@angular/router';
import { filter } from 'rxjs';
import { RecipeSuggestion } from '../../core/api/generated/models/recipe-suggestion';
import { SiteData } from '../../core/site/site-data';
import { Reveal } from '../../shared/motion/reveal';
import { RECIPES_PATH, recipeLink } from '../../shared/routing/links';
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

  private readonly router = inject(Router);
  /** Scroll position kept through the next navigation: a change of page size, not of page. */
  private keptScroll: number | null = null;
  protected readonly categories = inject(SiteData).categories;
  protected readonly recipesPath = RECIPES_PATH;
  protected readonly pageSizeOptions: SelectOption<number>[] = PAGE_SIZES.map((size) => ({
    value: size,
    label: String(size),
  }));

  protected readonly filters = computed(() => this.data().filters);
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

  protected openRecipe(suggestion: RecipeSuggestion): void {
    this.router.navigate(recipeLink({ slug: suggestion.slug, categories: [{ slug: suggestion.categorySlug }] }));
  }

  constructor() {
    // The router scrolls back to the top on its Scroll event, after this subscriber has run: a
    // change of page size puts the visitor back in the next frame, still before it is painted.
    this.router.events
      .pipe(
        filter((event) => event instanceof Scroll),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const top = this.keptScroll;
        if (top !== null) {
          this.keptScroll = null;
          requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }));
        }
      });
  }

  protected changePageSize(pageSize: number | undefined): void {
    this.keptScroll = window.scrollY;
    this.updateQuery({
      [RECIPES_QUERY.pageSize]: pageSize === DEFAULT_PAGE_SIZE ? null : (pageSize ?? null),
      [RECIPES_QUERY.page]: null,
    });
  }

  private updateQuery(queryParams: Record<string, string | string[] | number | null>): void {
    this.router.navigate([RECIPES_PATH], { queryParams, queryParamsHandling: 'merge' });
  }
}
