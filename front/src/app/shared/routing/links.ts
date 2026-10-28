import { Params } from '@angular/router';

export const RECIPES_PATH = '/recettes';
export const INSTALL_PATH = '/installer';
export const GLOSSARY_PATH = '/glossaire';
export const MENUS_PATH = '/menus';
export const FAVORITES_PATH = '/favoris';
export const SHOPPING_LIST_PATH = '/liste-de-courses';
export const LEGAL_NOTICE_PATH = '/mentions-legales';
export const PRIVACY_POLICY_PATH = '/politique-de-confidentialite';
export const ADMIN_PATH = '/admin';
export const FEEDBACK_PATH = '/donner-mon-avis';

/** The first category of a recipe: the one in its URL, and its "Retour" link. */
export function mainCategory<T>(recipe: { categories: T[] }): T {
  return recipe.categories[0]!;
}

/** Canonical, SEO friendly URL of a recipe: /recettes/{main-category-slug}/{recipe-slug}. */
export function recipeLink(recipe: { slug: string; categories: { slug: string }[] }): string[] {
  return [RECIPES_PATH, mainCategory(recipe).slug, recipe.slug];
}

/** A menu put together by the admin: /menus/{slug}. */
export function menuLink(menu: { slug: string }): string[] {
  return [MENUS_PATH, menu.slug];
}

/** Query params of the recipes page filtered on a category: /recettes?categorie={slug}. */
export function categoryQueryParams(category: { slug: string }): Params {
  return { categorie: category.slug };
}

/** Query params of the recipes page filtered on a tag: /recettes?tag={slug}. */
export function tagQueryParams(tag: { slug: string }): Params {
  return { tag: tag.slug };
}
