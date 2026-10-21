import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getFeaturedRecipe } from '../../core/api/generated/fn/recipes/get-featured-recipe';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { RecipeCard } from '../../core/api/generated/models/recipe-card';

export const LATEST_RECIPES_COUNT = 6;

export interface HomeData {
  /** null when nothing is published yet (the API answers 204). */
  featured: RecipeCard | null;
  latest: RecipeCard[];
}

/**
 * Loaded before the page renders, on the server as in the browser: the page is complete from
 * the first paint, and hydration reuses the server responses (HTTP transfer cache).
 */
export const homeResolver: ResolveFn<HomeData> = async () => {
  const api = inject(Api);
  const [featured, latest] = await Promise.all([
    api.invoke(getFeaturedRecipe) as Promise<RecipeCard | null>,
    api.invoke(listPublishedRecipes, { size: LATEST_RECIPES_COUNT }),
  ]);
  return { featured, latest: latest.content };
};
