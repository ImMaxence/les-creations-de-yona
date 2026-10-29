import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getFeaturedRecipe } from '../../core/api/generated/fn/recipes/get-featured-recipe';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { RecipeCard } from '../../core/api/generated/models/recipe-card';
import { THEMES } from '../../shared/format/themes';

export const LATEST_RECIPES_COUNT = 3;

export interface HomeData {
  /**
   * The featured recipe of each theme, sweet then savory (its latest one when none is chosen); a
   * theme without any published recipe is left out (the API answers 204). Empty when nothing is
   * published yet.
   */
  featured: RecipeCard[];
  latest: RecipeCard[];
}

/**
 * Loaded before the page renders, on the server as in the browser: the page is complete from
 * the first paint, and hydration reuses the server responses (HTTP transfer cache).
 */
export const homeResolver: ResolveFn<HomeData> = async () => {
  const api = inject(Api);
  const [latest, featured] = await Promise.all([
    api.invoke(listPublishedRecipes, { size: LATEST_RECIPES_COUNT }),
    Promise.all(THEMES.map(({ value }) => api.invoke(getFeaturedRecipe, { theme: value }) as Promise<RecipeCard | null>)),
  ]);
  return { featured: featured.filter((recipe): recipe is RecipeCard => !!recipe), latest: latest.content };
};
