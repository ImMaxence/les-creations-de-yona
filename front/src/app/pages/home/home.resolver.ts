import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { getCapHighlight } from '../../core/api/generated/fn/mon-cap/get-cap-highlight';
import { getFeaturedRecipe } from '../../core/api/generated/fn/recipes/get-featured-recipe';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { CapHighlight } from '../../core/api/generated/models/cap-highlight';
import { RecipeCard } from '../../core/api/generated/models/recipe-card';
import { THEMES, Theme } from '../../shared/format/themes';

export const LATEST_RECIPES_COUNT = 3;

/** The latest recipes of a theme. */
export interface LatestOfTheme {
  theme: Theme;
  recipes: RecipeCard[];
}

export interface HomeData {
  /** The featured recipe, or the latest published one when none is chosen; null when nothing is published yet. */
  featured: RecipeCard | null;
  /** The 3 latest recipes of each theme, savory then sweet, the featured one left out; a theme without any is left out. */
  latest: LatestOfTheme[];
  /** "À lire en ce moment", under "À propos": the article put forward, or the latest; null without any. */
  article: CapHighlight | null;
}

/**
 * Loaded before the page renders, on the server as in the browser: the page is complete from
 * the first paint, and hydration reuses the server responses (HTTP transfer cache).
 */
export const homeResolver: ResolveFn<HomeData> = async () => {
  const api = inject(Api);
  const [featured, latest, article] = await Promise.all([
    // 204 without any published recipe
    api.invoke(getFeaturedRecipe, {}) as Promise<RecipeCard | null>,
    // One more than shown: the featured recipe, already above, is left out of its theme
    Promise.all(THEMES.map(({ value }) => api.invoke(listPublishedRecipes, { theme: value, size: LATEST_RECIPES_COUNT + 1 }))),
    // An extra: the home page still shows without it. 204 before the first article.
    (api.invoke(getCapHighlight) as Promise<CapHighlight | null>).catch(() => null),
  ]);
  return {
    featured: featured ?? null,
    latest: THEMES.map(({ value }, index) => ({
      theme: value,
      recipes: latest[index].content.filter((recipe) => recipe.slug !== featured?.slug).slice(0, LATEST_RECIPES_COUNT),
    })).filter((group) => group.recipes.length > 0),
    article: article ?? null,
  };
};
