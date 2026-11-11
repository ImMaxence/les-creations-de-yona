import type { Request } from 'express';
import type { CategoryResponse } from '../app/core/api/generated/models/category-response';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuDetail } from '../app/core/api/generated/models/menu-detail';
import type { CapArticle } from '../app/core/api/generated/models/cap-article';
import type { CapArticleCard } from '../app/core/api/generated/models/cap-article-card';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { PageResponseRecipeCard } from '../app/core/api/generated/models/page-response-recipe-card';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import type { SocialLinkResponse } from '../app/core/api/generated/models/social-link-response';
import type { Theme } from '../app/shared/format/themes';

/** Largest page the API serves (spring.data.web.pageable.max-page-size). */
const API_PAGE_SIZE = 50;
const API_TIMEOUT_MS = 5_000;

/** The API answered something else than 200: 404 for a draft or an unknown recipe. */
export class ApiError extends Error {
  constructor(
    readonly url: URL,
    readonly status: number,
  ) {
    super(`GET ${url} answered ${status}`);
  }
}

/** Same origin as the SSR rendering: API_URL in Docker, else the site itself (dev server proxy). */
export function apiOrigin(req: Request): string {
  return process.env['API_URL'] || `${req.protocol}://${req.get('host')}`;
}

async function get<T>(origin: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, origin);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ApiError(url, response.status);
  }
  // 204: nothing to give (no featured recipe before the first publication)
  return response.status === 204 ? (null as T) : ((await response.json()) as T);
}

/** Every published recipe, the latest first, page after page; only those of a category when given. */
export async function fetchPublishedRecipes(origin: string, filters: { category?: string } = {}): Promise<RecipeCard[]> {
  const recipes: RecipeCard[] = [];
  let totalPages = 1;
  for (let page = 0; page < totalPages; page++) {
    const body = await get<PageResponseRecipeCard>(origin, '/api/recipes', {
      ...filters,
      page: String(page),
      size: String(API_PAGE_SIZE),
    });
    recipes.push(...body.content);
    totalPages = body.totalPages;
  }
  return recipes;
}

export function fetchRecipe(origin: string, slug: string): Promise<RecipeDetail> {
  return get<RecipeDetail>(origin, `/api/recipes/${encodeURIComponent(slug)}`);
}

/** The latest published recipes of a theme, as on the home page. */
export async function fetchLatestRecipes(origin: string, theme: Theme, count: number): Promise<RecipeCard[]> {
  const body = await get<PageResponseRecipeCard>(origin, '/api/recipes', { theme, size: String(count) });
  return body.content;
}

/** The recipe at the top of the home page (the latest one unless chosen); null before the first one. */
export function fetchFeaturedRecipe(origin: string): Promise<RecipeCard | null> {
  return get<RecipeCard | null>(origin, '/api/featured-recipe');
}

/** Categories with the themes of their published recipes. */
export function fetchCategories(origin: string): Promise<CategoryResponse[]> {
  return get<CategoryResponse[]>(origin, '/api/categories');
}

/** A published menu and its published recipes. */
export function fetchMenu(origin: string, slug: string): Promise<MenuDetail> {
  return get<MenuDetail>(origin, `/api/menus/${encodeURIComponent(slug)}`);
}

/** Words of the glossary; a failure only leaves them out. */
export function fetchGlossary(origin: string): Promise<GlossaryTermResponse[]> {
  return get<GlossaryTermResponse[]>(origin, '/api/glossary').catch(() => []);
}

/** Published menus; a failure only leaves them out. */
export function fetchMenus(origin: string): Promise<MenuSummary[]> {
  return get<MenuSummary[]>(origin, '/api/menus').catch(() => []);
}

/** Published articles of "Mon CAP", without their blocks; a failure only leaves them out. */
export function fetchCapEntries(origin: string): Promise<CapArticleCard[]> {
  return get<CapArticleCard[]>(origin, '/api/cap/entries').catch(() => []);
}

/** An article of "Mon CAP" with its blocks, for llms-full.txt. */
export function fetchCapArticle(origin: string, slug: string): Promise<CapArticle> {
  return get<CapArticle>(origin, `/api/cap/entries/${encodeURIComponent(slug)}`);
}

/** Texts of the home page ("À propos"…), edited in the back-office. */
export function fetchSiteContent(origin: string): Promise<SiteContentResponse> {
  return get<SiteContentResponse>(origin, '/api/site-content');
}

/** Yona's social networks; a failure only leaves them out. */
export function fetchSocialLinks(origin: string): Promise<SocialLinkResponse[]> {
  return get<SocialLinkResponse[]>(origin, '/api/social-links').catch(() => []);
}
