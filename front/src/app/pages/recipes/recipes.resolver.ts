import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ParamMap, ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listPublishedIngredients } from '../../core/api/generated/fn/ingredients/list-published-ingredients';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { PageResponseRecipeCard } from '../../core/api/generated/models/page-response-recipe-card';
import { PageSeo, excerpt } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';
import { RECIPES_PATH } from '../../shared/routing/links';

export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Query parameters of the recipes page, in French as the rest of the URLs. */
export const RECIPES_QUERY = {
  search: 'q',
  category: 'categorie',
  ingredient: 'ingredient',
  page: 'page',
  pageSize: 'parPage',
} as const;

export interface RecipeFilters {
  search: string;
  category: string | null;
  /** Name of one of its ingredients, chosen in the list. */
  ingredient: string;
  /** Starts at 1, as displayed. */
  page: number;
  pageSize: number;
}

export interface RecipesPageData {
  filters: RecipeFilters;
  result: PageResponseRecipeCard;
  /** Ingredients of the published recipes, for the ingredient filter. */
  ingredients: string[];
}

/** Reads the filters from the URL; anything invalid falls back to its default. */
export function readFilters(params: ParamMap): RecipeFilters {
  const page = Number(params.get(RECIPES_QUERY.page));
  const pageSize = Number(params.get(RECIPES_QUERY.pageSize));
  return {
    search: (params.get(RECIPES_QUERY.search) ?? '').trim().slice(0, 100),
    category: params.get(RECIPES_QUERY.category) || null,
    ingredient: (params.get(RECIPES_QUERY.ingredient) ?? '').trim().slice(0, 100),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export const recipesResolver: ResolveFn<RecipesPageData> = async (route) => {
  const api = inject(Api);
  const filters = readFilters(route.queryParamMap);
  const [result, ingredients] = await Promise.all([
    api.invoke(listPublishedRecipes, {
      q: filters.search || undefined,
      category: filters.category ?? undefined,
      ingredient: filters.ingredient || undefined,
      page: filters.page - 1,
      size: filters.pageSize,
    }),
    api.invoke(listPublishedIngredients, {}),
  ]);
  return { filters, result, ingredients };
};

/** A category page is indexed on its own; search results and empty pages are not. */
export function recipesSeo(route: ActivatedRouteSnapshot): PageSeo {
  const { filters, result } = route.data['data'] as RecipesPageData;
  const category = inject(SiteData)
    .categories()
    .find((candidate) => candidate.slug === filters.category);

  const canonical = new URLSearchParams();
  if (category) {
    canonical.set(RECIPES_QUERY.category, category.slug);
  }
  if (filters.page > 1) {
    canonical.set(RECIPES_QUERY.page, String(filters.page));
  }
  const query = canonical.toString();

  return {
    title: category ? `${category.name} · Recettes` : 'Recettes',
    description: excerpt(
      category
        ? `Toutes les recettes de la catégorie ${category.name.toLowerCase()} : des recettes maison, simples et gourmandes.`
        : 'Toutes les recettes maison de Yona : plats, desserts, pâtisseries, à refaire chez soi.',
    ),
    canonicalPath: query ? `${RECIPES_PATH}?${query}` : RECIPES_PATH,
    // Search results and pages past the end are not worth indexing
    noIndex: filters.search !== '' || filters.ingredient !== '' || result.content.length === 0,
  };
}
