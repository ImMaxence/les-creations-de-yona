import { Params } from '@angular/router';

export const RECIPES_PATH = '/recettes';
export const INSTALL_PATH = '/installer';
export const LEGAL_NOTICE_PATH = '/mentions-legales';
export const PRIVACY_POLICY_PATH = '/politique-de-confidentialite';
export const ADMIN_PATH = '/admin';

/** The first category of a recipe: the one in its URL, and its "Retour" link. */
export function mainCategory<T>(recipe: { categories: T[] }): T {
  return recipe.categories[0]!;
}

/** Canonical, SEO friendly URL of a recipe: /recettes/{main-category-slug}/{recipe-slug}. */
export function recipeLink(recipe: { slug: string; categories: { slug: string }[] }): string[] {
  return [RECIPES_PATH, mainCategory(recipe).slug, recipe.slug];
}

/** Query params of the recipes page filtered on a category: /recettes?categorie={slug}. */
export function categoryQueryParams(category: { slug: string }): Params {
  return { categorie: category.slug };
}
