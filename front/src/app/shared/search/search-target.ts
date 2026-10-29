import { Params } from '@angular/router';
import { Theme, themeSlug } from '../format/themes';
import { MENUS_PATH, RECIPES_PATH, categoryQueryParams, recipeLink, tagQueryParams } from '../routing/links';

/** Query parameter of a recipe (and of the recipes page) giving the servings to show it for. */
export const SERVINGS_PARAM = 'portions';

export const MAX_SERVINGS = 50;

/**
 * "8 personnes", "6 parts", or a number alone, not followed by a word ("gâteau 8", but not "3
 * chocolats"): as the API reads it (SearchWords). The words of people have no accent: matched on
 * the text as typed, so that the place of the number is the one in the search box.
 */
const SERVINGS =
  /(?<![\p{L}\p{N}])(\d{1,2})(?:\s*(?:personnes?|pers\.?|parts?|portions?|couverts?|gourmands?|enfants?)(?![\p{L}])|(?![\p{L}\p{N}])(?!\s*\p{L}))/u;

/** The number of people in a search, and where its digits are; null for none. */
export function servingsMatch(text: string | null | undefined): { servings: number; start: number; end: number } | null {
  const match = SERVINGS.exec((text ?? '').toLowerCase());
  const servings = match ? Number(match[1]) : NaN;
  return match && servings >= 1 && servings <= MAX_SERVINGS
    ? { servings, start: match.index, end: match.index + match[1]!.length }
    : null;
}

/**
 * "tarte 8 personnes" → 8, "brioche pour 6 parts" → 6, "gâteau 4" → 4: the recipes opened from the
 * results show their quantities for that many. The API leaves these words out of the search.
 */
export function servingsIn(text: string | null | undefined): number | null {
  return servingsMatch(text)?.servings ?? null;
}

/** The search with another number of people: "gâteau 8 personnes" → "gâteau 10 personnes". */
export function withServings(text: string, servings: number): string {
  const match = servingsMatch(text);
  return match ? text.slice(0, match.start) + servings + text.slice(match.end) : text;
}

/** A suggestion of the search box, whatever it is. */
export type SearchPick =
  | { kind: 'recipe'; label: string; slug: string; categorySlug: string }
  | { kind: 'category' | 'tag' | 'menu'; label: string; slug: string }
  | { kind: 'ingredient'; label: string }
  | { kind: 'theme'; label: string; theme: Theme };

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
    case 'theme':
      return { commands: [RECIPES_PATH], queryParams: { theme: themeSlug(pick.theme), ...portions } };
  }
}
