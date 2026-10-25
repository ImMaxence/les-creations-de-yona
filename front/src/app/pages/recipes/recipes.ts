import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideSearchX } from '@lucide/angular';
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
    () => this.filters().search !== '' || this.filters().category !== null,
  );
  protected readonly countLabel = computed(() => {
    const count = this.result().totalElements;
    return count === 0 ? 'Aucune recette' : count === 1 ? '1 recette' : `${count} recettes`;
  });

  protected categoryParams(slug: string | null): Record<string, string | null> {
    return { [RECIPES_QUERY.category]: slug, [RECIPES_QUERY.page]: null };
  }

  protected search(search: string): void {
    this.updateQuery({ [RECIPES_QUERY.search]: search || null, [RECIPES_QUERY.page]: null });
  }

  protected openRecipe(suggestion: RecipeSuggestion): void {
    this.router.navigate(recipeLink({ slug: suggestion.slug, categories: [{ slug: suggestion.categorySlug }] }));
  }

  protected changePageSize(pageSize: number | undefined): void {
    this.updateQuery({
      [RECIPES_QUERY.pageSize]: pageSize === DEFAULT_PAGE_SIZE ? null : (pageSize ?? null),
      [RECIPES_QUERY.page]: null,
    });
  }

  private updateQuery(queryParams: Record<string, string | number | null>): void {
    this.router.navigate([RECIPES_PATH], { queryParams, queryParamsHandling: 'merge' });
  }
}
