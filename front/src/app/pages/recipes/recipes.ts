import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, Scroll } from '@angular/router';
import { LucideSearchX } from '@lucide/angular';
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
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, RECIPES_QUERY, RecipesPageData } from './recipes.resolver';

@Component({
  selector: 'yona-recipes',
  imports: [RouterLink, LucideSearchX, Button, Pagination, RecipeCard, Reveal, SearchBox, Select],
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
  protected readonly hasFilters = computed(
    () => this.filters().search !== '' || this.filters().category !== null || this.filters().ingredient !== '',
  );
  /** A drop-down rather than a row of chips: the categories grow in number. */
  protected readonly categoryOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes les catégories' },
    ...this.categories().map((category) => ({ value: category.slug, label: category.name })),
  ]);
  /** Ingredients of the published recipes; choosing one applies the filter at once. */
  protected readonly ingredientOptions = computed<SelectOption<string>[]>(() => {
    const names = this.data().ingredients;
    const chosen = this.filters().ingredient;
    // An old link may name an ingredient no longer in any recipe: still shown as chosen
    const all = chosen && !names.some((name) => name.toLocaleLowerCase('fr') === chosen.toLocaleLowerCase('fr'))
      ? [...names, chosen]
      : names;
    return [{ value: '', label: 'Tous les ingrédients' }, ...all.map((name) => ({ value: name, label: name }))];
  });
  protected readonly countLabel = computed(() => {
    const count = this.result().totalElements;
    return count === 0 ? 'Aucune recette' : count === 1 ? '1 recette' : `${count} recettes`;
  });

  protected changeCategory(slug: string | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.category]: slug || null, [RECIPES_QUERY.page]: null });
  }

  protected changeIngredient(name: string | undefined): void {
    this.updateQuery({ [RECIPES_QUERY.ingredient]: name || null, [RECIPES_QUERY.page]: null });
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

  private updateQuery(queryParams: Record<string, string | number | null>): void {
    this.router.navigate([RECIPES_PATH], { queryParams, queryParamsHandling: 'merge' });
  }
}
