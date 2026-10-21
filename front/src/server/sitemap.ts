import type { Request, RequestHandler } from 'express';
import type { PageResponseRecipeCard } from '../app/core/api/generated/models/page-response-recipe-card';
import type { RecipeCard } from '../app/core/api/generated/models/recipe-card';
import { SITE_URL } from '../app/core/seo/page-seo';
import {
  INSTALL_PATH,
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
  RECIPES_PATH,
  categoryQueryParams,
  recipeLink,
} from '../app/shared/routing/links';

/** Largest page the API serves (spring.data.web.pageable.max-page-size). */
const API_PAGE_SIZE = 50;
const API_TIMEOUT_MS = 5_000;
const STATIC_PATHS = ['/', RECIPES_PATH, INSTALL_PATH, LEGAL_NOTICE_PATH, PRIVACY_POLICY_PATH];

/** Same origin as the SSR rendering: API_URL in Docker, else the site itself (dev server proxy). */
function apiOrigin(req: Request): string {
  return process.env['API_URL'] || `${req.protocol}://${req.get('host')}`;
}

async function fetchPublishedRecipes(origin: string): Promise<RecipeCard[]> {
  const recipes: RecipeCard[] = [];
  let totalPages = 1;
  for (let page = 0; page < totalPages; page++) {
    const url = new URL('/api/recipes', origin);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(API_PAGE_SIZE));
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`GET ${url} answered ${response.status}`);
    }
    const body = (await response.json()) as PageResponseRecipeCard;
    recipes.push(...body.content);
    totalPages = body.totalPages;
  }
  return recipes;
}

/** Indexable pages only: no search results, no empty category (both are noindex). */
function sitemapPaths(recipes: RecipeCard[]): string[] {
  const categories = new Set(recipes.map((recipe) => recipe.category.slug));
  return [
    ...STATIC_PATHS,
    ...[...categories].map(
      (slug) => `${RECIPES_PATH}?${new URLSearchParams(categoryQueryParams({ slug }))}`,
    ),
    ...recipes.map((recipe) => recipeLink(recipe).join('/')),
  ];
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
  );
}

function toXml(paths: string[]): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, SITE_URL).href)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * /sitemap.xml, built on each request from the published recipes: always up to date, cached one
 * hour. URLs use the production domain, the only one search engines should index.
 */
export const sitemap: RequestHandler = async (req, res) => {
  try {
    const recipes = await fetchPublishedRecipes(apiOrigin(req));
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(toXml(sitemapPaths(recipes)));
  } catch (error) {
    console.error('Sitemap unavailable', error);
    res
      .status(503)
      .set('Cache-Control', 'no-store')
      .set('Retry-After', '300')
      .type('text/plain')
      .send('Sitemap temporairement indisponible.');
  }
};
