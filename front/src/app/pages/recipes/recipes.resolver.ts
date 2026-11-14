import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ParamMap, ResolveFn } from '@angular/router';
import { Api } from '../../core/api/generated/api';
import { listPublishedIngredients } from '../../core/api/generated/fn/ingredients/list-published-ingredients';
import { listPublishedRecipes } from '../../core/api/generated/fn/recipes/list-published-recipes';
import { listTags } from '../../core/api/generated/fn/tags/list-tags';
import { TagSummary } from '../../core/api/generated/models/tag-summary';
import { PageResponseRecipeCard } from '../../core/api/generated/models/page-response-recipe-card';
import { WEBSITE_ID, itemList } from '../../core/seo/json-ld';
import { PageSeo, absoluteUrl, excerpt, markdownPathOf } from '../../core/seo/page-seo';
import { SiteData } from '../../core/site/site-data';
import { Theme, themeOfSlug } from '../../shared/format/themes';
import { RECIPES_PATH, recipeLink } from '../../shared/routing/links';

/** All divide into 1, 2, 3 or 4 columns: a page always ends on a full row. */
export const RECIPES_PER_PAGE = 12;

/** Query parameters of the recipes page, in French as the rest of the URLs. */
export const RECIPES_QUERY = {
  search: 'q',
  category: 'categorie',
  ingredient: 'ingredient',
  tag: 'tag',
  time: 'temps',
  difficulty: 'difficulte',
  theme: 'theme',
  /** Léger or riche en protéines, among the recipes showing their nutrition facts. */
  nutrition: 'nutrition',
  /** Not a filter: the number of people the recipes opened from the list show their quantities for. */
  servings: 'portions',
  page: 'page',
} as const;

/** "Qu'est-ce que je peux faire avec…": ingredients combined, at most (as the API). */
export const MAX_INGREDIENTS = 5;

/** "Prêt en…": preparation and cooking together, at most. */
export const TIME_FILTERS = [15, 30, 60] as const;

/** Difficulty filter: the URL's French word, the API's level. */
export const DIFFICULTY_FILTERS = {
  facile: 'EASY',
  moyenne: 'MEDIUM',
  difficile: 'HARD',
} as const;
export type DifficultyFilter = keyof typeof DIFFICULTY_FILTERS;

/** Nutrition filter: the URL's French word, the API's filter. */
export const NUTRITION_FILTERS = {
  leger: 'LIGHT',
  proteines: 'HIGH_PROTEIN',
} as const;
export type NutritionFilter = keyof typeof NUTRITION_FILTERS;

export interface RecipeFilters {
  search: string;
  category: string | null;
  /** Names of ingredients it must all have, chosen in the list one by one. */
  ingredients: string[];
  /** Slug of one of its tags. */
  tag: string | null;
  /** Ready in at most this many minutes. */
  maxMinutes: number | null;
  difficulty: DifficultyFilter | null;
  /** Sucré or salé (?theme=sucre). */
  theme: Theme | null;
  /** 500 kcal a serving at most, or rich in proteins: recipes showing their nutrition facts only. */
  nutrition: NutritionFilter | null;
  /** Where the list starts, from 1: ?page=2 is for search engines, the visitor scrolls. */
  page: number;
}

export interface RecipesPageData {
  filters: RecipeFilters;
  result: PageResponseRecipeCard;
  /** Ingredients of the published recipes, for the ingredient filter. */
  ingredients: string[];
  /** Tags carried by at least one published recipe, for the tag filter. */
  tags: TagSummary[];
}

/** Reads the filters from the URL; anything invalid falls back to its default. */
export function readFilters(params: ParamMap): RecipeFilters {
  const page = Number(params.get(RECIPES_QUERY.page));
  const time = Number(params.get(RECIPES_QUERY.time));
  const difficulty = params.get(RECIPES_QUERY.difficulty);
  const nutrition = params.get(RECIPES_QUERY.nutrition);
  return {
    search: (params.get(RECIPES_QUERY.search) ?? '').trim().slice(0, 100),
    category: params.get(RECIPES_QUERY.category) || null,
    ingredients: readIngredients(params.getAll(RECIPES_QUERY.ingredient)),
    tag: params.get(RECIPES_QUERY.tag) || null,
    maxMinutes: (TIME_FILTERS as readonly number[]).includes(time) ? time : null,
    difficulty: difficulty && difficulty in DIFFICULTY_FILTERS ? (difficulty as DifficultyFilter) : null,
    theme: themeOfSlug(params.get(RECIPES_QUERY.theme)),
    nutrition: nutrition && nutrition in NUTRITION_FILTERS ? (nutrition as NutritionFilter) : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Repeated in the URL (?ingredient=Œufs&ingredient=Chocolat): blanks and repeats dropped. */
function readIngredients(values: string[]): string[] {
  const names: string[] = [];
  for (const value of values) {
    const name = value.trim().slice(0, 100);
    if (name && !names.some((known) => sameName(known, name))) {
      names.push(name);
    }
  }
  return names.slice(0, MAX_INGREDIENTS);
}

export function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');
}

/** What the API is asked for these filters, whichever the page. */
export function recipesApiQuery(filters: RecipeFilters) {
  return {
    q: filters.search || undefined,
    category: filters.category ?? undefined,
    ingredient: filters.ingredients.length ? filters.ingredients : undefined,
    tag: filters.tag ?? undefined,
    maxMinutes: filters.maxMinutes ?? undefined,
    difficulty: filters.difficulty ? DIFFICULTY_FILTERS[filters.difficulty] : undefined,
    theme: filters.theme ?? undefined,
    nutrition: filters.nutrition ? NUTRITION_FILTERS[filters.nutrition] : undefined,
    size: RECIPES_PER_PAGE,
  };
}

export const recipesResolver
: ResolveFn<RecipesPageData> = async (route) => {
  const api = inject(Api);
  const filters = readFilters(route.queryParamMap);
  const [result, ingredients, tags] = await Promise.all([
    api.invoke(listPublishedRecipes, { ...recipesApiQuery(filters), page: filters.page - 1 }),
    api.invoke(listPublishedIngredients, {}),
    api.invoke(listTags),
  ]);
  return { filters, result, ingredients, tags: tags.filter((tag) => tag.recipeCount > 0) };
};

/** What the page holds, for search engines and its Markdown version: all the recipes, or those of a category. */
export function recipesDescription(category?: { name: string }): string {
  return category
    ? `Toutes les recettes de la catégorie ${category.name.toLowerCase()} : des recettes maison, simples et gourmandes`
    : 'Toutes les recettes maison de Yona : plats, desserts, pâtisseries, à refaire chez soi';
}

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
  const canonicalPath = query ? `${RECIPES_PATH}?${query}` : RECIPES_PATH;
  const title = category ? `${category.name} · Recettes` : 'Recettes';

  return {
    title,
    description: excerpt(recipesDescription(category)),
    canonicalPath,
    image: category?.imageId ? `/api/images/${category.imageId}/1600.webp` : undefined,
    markdownPath: markdownPathOf(canonicalPath),
    // The recipes of this page, each with its address
    jsonLd: [
      {
        '@type': 'CollectionPage',
        '@id': absoluteUrl(canonicalPath),
        url: absoluteUrl(canonicalPath),
        name: title,
        inLanguage: 'fr-FR',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: itemList(result.content.map((recipe) => ({ name: recipe.title, path: recipeLink(recipe).join('/') }))),
      },
    ],
    // Search results and pages past the end are not worth indexing
    noIndex:
      filters.search !== '' ||
      filters.ingredients.length > 0 ||
      filters.tag !== null ||
      filters.maxMinutes !== null ||
      filters.difficulty !== null ||
      filters.theme !== null ||
      filters.nutrition !== null ||
      result.content.length === 0,
  };
}
