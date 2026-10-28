import { Params } from '@angular/router';
import { MENUS_PATH, RECIPES_PATH, categoryQueryParams, recipeLink, tagQueryParams } from '../routing/links';

/** Query parameter of a recipe (and of the recipes page) giving the servings to show it for. */
export const SERVINGS_PARAM = 'portions';

const MAX_SERVINGS = 50;

/**
 * "tarte 8 personnes" → 8, "brioche pour 6 parts" → 6: the recipes opened from the results show
 * their quantities for that many. The API leaves these words out of the search (SearchWords).
 */
export function servingsIn(text: string | null | undefined): number | null {
  const folded = (text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const match = /(?:pour\s+)?(\d+)\s*(?:personnes?|pers\.?|parts?|portions?|couverts?|gourmands?|enfants?)(?![\p{L}])/u.exec(
    folded,
  );
  const servings = match ? Number(match[1]) : NaN;
  return servings >= 1 && servings <= MAX_SERVINGS ? servings : null;
}

/** A suggestion of the search box, whatever it is. */
export type SearchPick =
  | { kind: 'recipe'; label: string; slug: string; categorySlug: string }
  | { kind: 'category' | 'tag' | 'menu'; label: string; slug: string }
  | { kind: 'ingredient'; label: string };

/** A suggestion chosen, with the servings read in what was typed. */
export interface SearchChoice {
  pick: SearchPick;
  servings: number | null;
}

/** Where a suggestion leads, the servings asked for carried along. */
export function searchTarget(pick: SearchPick, servings: number | null): { commands: string[]; queryParams: Params } {
  const portions: Params = servings ? { [SERVINGS_PARAM]: servings } : {};
  switch (pick.kind) {
    case 'recipe':
      return { commands: recipeLink({ slug: pick.slug, categories: [{ slug: pick.categorySlug }] }), queryParams: portions };
    case 'category':
      return { commands: [RECIPES_PATH], queryParams: { ...categoryQueryParams(pick), ...portions } };
    case 'tag':
      return { commands: [RECIPES_PATH], queryParams: { ...tagQueryParams(pick), ...portions } };
    case 'menu':
      return { commands: [MENUS_PATH, pick.slug], queryParams: {} };
    case 'ingredient':
      return { commands: [RECIPES_PATH], queryParams: { ingredient: pick.label, ...portions } };
  }
}
