import type { Request } from 'express';
import type { GlossaryTermResponse } from '../app/core/api/generated/models/glossary-term-response';
import type { MenuSummary } from '../app/core/api/generated/models/menu-summary';
import type { PageResponseRecipeCard } from '../app/core/api/generated/models/page-response-recipe-card';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import type { RecipeDetail } from '../app/core/api/generated/models/recipe-detail';
import type { SiteContentResponse } from '../app/core/api/generated/models/site-content-response';
import type { SocialLinkResponse } from '../app/core/api/generated/models/social-link-response';

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
  return (await response.json()) as T;
}

/** Every published recipe, the latest first, page after page. */
export async function fetchPublishedRecipes(origin: string): Promise<RecipeCard[]> {
  const recipes: RecipeCard[] = [];
  let totalPages = 1;
  for (let page = 0; page < totalPages; page++) {
    const body = await get<PageResponseRecipeCard>(origin, '/api/recipes', {
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

/** Words of the glossary; a failure only leaves them out. */
export function fetchGlossary(origin: string): Promise<GlossaryTermResponse[]> {
  return get<GlossaryTermResponse[]>(origin, '/api/glossary').catch(() => []);
}

/** Published menus; a failure only leaves them out. */
export function fetchMenus(origin: string): Promise<MenuSummary[]> {
  return get<MenuSummary[]>(origin, '/api/menus').catch(() => []);
}

/** Texts of the home page ("À propos"…), edited in the back-office. */
export function fetchSiteContent(origin: string): Promise<SiteContentResponse> {
  return get<SiteContentResponse>(origin, '/api/site-content');
}

/** Yona's social networks; a failure only leaves them out. */
export function fetchSocialLinks(origin: string): Promise<SocialLinkResponse[]> {
  return get<SocialLinkResponse[]>(origin, '/api/social-links').catch(() => []);
}
